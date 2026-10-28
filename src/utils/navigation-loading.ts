import type Swup from "@swup/astro/client/Swup";

const VISIT_TIMEOUT = 17_000;
const PAGE_TIMEOUT = VISIT_TIMEOUT;
const PROGRESS_DELAY = 300;
const LOADING_DELAY = 6_000;
const ERROR_DISMISS_DELAY = 10_000;
const installed = new WeakSet<Swup>();
type Visit = Swup["visit"];
type Snapshot = {
	url: string;
	state: Record<string, unknown> | null;
	index: number;
	head: Node[];
	home: boolean;
	navbarHome: string | null;
	navbarHidden: boolean;
	bannerTextHidden: boolean;
};
type Session = {
	visit: Visit;
	origin: Snapshot;
	timers: ReturnType<typeof setTimeout>[];
	stop: (reason: Error) => void;
	stopped: Promise<never>;
	settled: boolean;
	committed: boolean;
	transitioning: boolean;
	progressFrame?: number;
};
// Swup 4.8 has no public cancel/reset API. Keep the small recovery bridge here;
// ordinary navigation, animation, content replacement and history remain Swup's.
type RecoveryState = {
	navigating: boolean;
	currentHistoryIndex: number;
	onVisitEnd?: () => Promise<unknown>;
};

export function installNavigationLoading(): void {
	const install = () => {
		const swup = window.swup as Swup | undefined;
		const ui = document.getElementById("navigation-loading");
		if (!swup || !ui || installed.has(swup)) return;
		installed.add(swup);
		ui.dataset.ready = "true";
		const recovery = swup as unknown as RecoveryState;
		const title = document.getElementById("navigation-loading-title")!;
		const detail = document.getElementById("navigation-loading-detail")!;
		const ordinary = document.getElementById(
			"navigation-open-normally",
		) as HTMLAnchorElement;
		const close = ui.querySelector<HTMLButtonElement>(
			'[data-navigation-action="close"]',
		)!;
		const progress = ui.querySelector<HTMLElement>('[role="progressbar"]')!;
		const setProgress = (value: number) => {
			ui.style.setProperty("--navigation-progress", String(value));
			progress.setAttribute("aria-valuenow", String(Math.round(value * 100)));
		};
		const requests = new Map<string, Set<AbortController>>();
		let active: Session | undefined;
		let failedTarget = "";
		let dismissTimer: ReturnType<typeof setTimeout> | undefined;
		let countdownTimer: ReturnType<typeof setInterval> | undefined;
		let rollback: Promise<void> | undefined;
		let pendingRollback:
			| { snapshot: Snapshot; resolve: () => void }
			| undefined;
		const localURL = (value: string) => {
			const url = new URL(value, location.href);
			return url.pathname + url.search;
		};
		const snapshot = (): Snapshot => ({
			url: location.pathname + location.search + location.hash,
			state: history.state,
			index: Number(history.state?.index ?? recovery.currentHistoryIndex),
			head: [...document.head.childNodes],
			home: document.body.classList.contains("is-home"),
			navbarHome:
				document.getElementById("navbar")?.getAttribute("data-is-home") ?? null,
			navbarHidden:
				document
					.getElementById("navbar-wrapper")
					?.classList.contains("navbar-hidden") ?? false,
			bannerTextHidden:
				document
					.querySelector(".banner-text-overlay")
					?.classList.contains("hidden") ?? false,
		});
		let displayed = snapshot();
		const setState = (state: string) => {
			if (state !== "error") {
				clearTimeout(dismissTimer);
				clearInterval(countdownTimer);
				dismissTimer = undefined;
				countdownTimer = undefined;
				close.textContent = "关闭提示";
			}
			ui.dataset.state = state;
		};
		const startErrorCountdown = () => {
			clearTimeout(dismissTimer);
			clearInterval(countdownTimer);
			const expires = Date.now() + ERROR_DISMISS_DELAY;
			const update = () => {
				const seconds = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
				close.textContent = `关闭提示（${seconds}秒）`;
			};
			update();
			countdownTimer = setInterval(update, 250);
			dismissTimer = setTimeout(() => {
				if (ui.dataset.state === "error") setState("idle");
			}, ERROR_DISMISS_DELAY);
		};
		const errorSummary = (error: unknown): string => {
			const message = error instanceof Error ? error.message : "";
			const status = message.match(/Navigation HTTP (\d{3})/);
			if (status) return `HTTP ${status[1]}`;
			if (message === "Navigation containers missing") return "页面内容不完整";
			if (error instanceof DOMException && error.name === "AbortError")
				return "请求超时或中断";
			return "网络连接异常";
		};
		const setBusy = (busy: boolean) => {
			const content = document.getElementById("swup-container");
			if (busy) content?.setAttribute("aria-busy", "true");
			else content?.removeAttribute("aria-busy");
		};
		const syncLocation = (saved: Snapshot) => {
			history.replaceState(saved.state, "", saved.url);
			const Location = swup.location.constructor as new (
				url: string,
			) => typeof swup.location;
			swup.location = new Location(saved.url);
			recovery.currentHistoryIndex = saved.index;
		};
		// Use Swup's own gate: its window listener can run before a later window
		// listener even when that listener requests capture on the target itself.
		const shouldSkipPopState = swup.options.skipPopStateHandling;
		swup.options.skipPopStateHandling = (event) => {
			if (!pendingRollback) return shouldSkipPopState(event);
			const pending = pendingRollback;
			pendingRollback = undefined;
			syncLocation(pending.snapshot);
			pending.resolve();
			return true;
		};
		const restoreHistory = (session: Session): Promise<void> => {
			const saved = session.origin;
			const offset = saved.index - Number(history.state?.index ?? saved.index);
			if (!offset) {
				syncLocation(saved);
				return Promise.resolve();
			}
			const promise = new Promise<void>((resolve) => {
				let fallback: ReturnType<typeof setTimeout>;
				const finish = () => {
					clearTimeout(fallback);
					resolve();
				};
				pendingRollback = { snapshot: saved, resolve: finish };
				fallback = setTimeout(() => {
					if (pendingRollback?.snapshot !== saved) return;
					pendingRollback = undefined;
					syncLocation(saved);
					resolve();
				}, 1000);
				history.go(offset);
			});
			rollback = promise;
			void promise.then(() => {
				if (rollback === promise) rollback = undefined;
			});
			return promise;
		};
		const abortRequest = (url: string) => {
			requests.get(localURL(url))?.forEach((controller) => controller.abort());
		};
		const clear = (session: Session) => {
			session.timers.forEach(clearTimeout);
			session.timers.length = 0;
			if (session.progressFrame !== undefined)
				cancelAnimationFrame(session.progressFrame);
			setBusy(false);
		};
		const stop = async (
			session: Session,
			reason: "cancel" | "superseded" | "timeout" | "error",
			error?: unknown,
		) => {
			if (session.settled) return;
			session.settled = true;
			const cancellable = session.visit as Visit & {
				abort?: () => void;
				state: number;
			};
			if (cancellable.abort) cancellable.abort();
			else cancellable.state = 8; // VisitState.ABORTED in Swup 4.8.
			session.stop(new Error(reason));
			abortRequest(session.visit.to.url);
			clear(session);
			if (active !== session) return;
			active = undefined;
			swup.classes.clear();
			if (swup.visit === session.visit) recovery.navigating = false;
			document.getElementById("page-height-extend")?.classList.add("hidden");
			if (reason === "cancel" || reason === "superseded") setState("idle");
			else {
				setProgress(1);
				failedTarget = session.visit.to.url + (session.visit.to.hash || "");
				ordinary.href = failedTarget;
				title.textContent = session.committed
					? "页面已打开"
					: "页面暂时未能打开";
				detail.textContent = session.committed
					? "切换效果未能及时完成，您可以继续浏览（切换超时）。"
					: reason === "timeout"
						? "等待时间较长，已结束本次等待。您可以重试，或从新标签页打开（等待超时）。"
						: `连接未能完成，当前页面已保留。您可以重试，或从新标签页打开（${errorSummary(error)}）。`;
				setState("error");
				startErrorCountdown();
			}
			if (!session.committed) {
				if (session.transitioning)
					document.head.replaceChildren(...session.origin.head);
				document.body.classList.toggle("is-home", session.origin.home);
				const navbar = document.getElementById("navbar");
				if (session.origin.navbarHome === null)
					navbar?.removeAttribute("data-is-home");
				else navbar?.setAttribute("data-is-home", session.origin.navbarHome);
				document
					.getElementById("navbar-wrapper")
					?.classList.toggle("navbar-hidden", session.origin.navbarHidden);
				document
					.querySelector(".banner-text-overlay")
					?.classList.toggle("hidden", session.origin.bannerTextHidden);
				await restoreHistory(session);
			}
			const queued = recovery.onVisitEnd;
			if (queued && !recovery.navigating) {
				recovery.onVisitEnd = undefined;
				void queued();
			}
		};

		// Keep the deadline armed through response.text(), not just response headers.
		swup.hooks.replace("fetch:request", async (visit, args, defaultHandler) => {
			const controller = new AbortController();
			const sourceSignal = args.options.signal;
			const sourceAbort = () => controller.abort();
			if (sourceSignal?.aborted) controller.abort();
			else sourceSignal?.addEventListener("abort", sourceAbort, { once: true });
			const key = localURL(args.url);
			const group = requests.get(key) ?? new Set<AbortController>();
			requests.set(key, group);
			group.add(controller);
			const deadline = setTimeout(() => controller.abort(), PAGE_TIMEOUT);
			const cleanup = () => {
				clearTimeout(deadline);
				sourceSignal?.removeEventListener("abort", sourceAbort);
				group.delete(controller);
				if (!group.size && requests.get(key) === group) requests.delete(key);
			};
			try {
				const response = await defaultHandler!(visit, {
					...args,
					options: { ...args.options, signal: controller.signal },
				});
				if (!response.ok) {
					void response.body?.cancel().catch(() => {});
					throw new Error(`Navigation HTTP ${response.status}`);
				}
				const readText = response.text.bind(response);
				response.text = async () => {
					try {
						return await readText();
					} finally {
						cleanup();
					}
				};
				return response;
			} catch (error) {
				cleanup();
				throw error;
			}
		});

		swup.hooks.on(
			"visit:start",
			async (visit) => {
				await rollback;
				const origin = visit.history.popstate ? displayed : snapshot();
				const from = new URL(origin.url, location.href);
				visit.from = { url: from.pathname + from.search, hash: from.hash };
				visit.animation.wait = true;
				let reject!: (error: Error) => void;
				const stopped = new Promise<never>((_, rejectPromise) => {
					reject = rejectPromise;
				});
				void stopped.catch(() => {});
				const session: Session = {
					visit,
					origin,
					timers: [],
					stop: reject,
					stopped,
					settled: false,
					committed: false,
					transitioning: false,
				};
				active = session;
				setProgress(0);
				setState("idle");
				setBusy(true);
				title.textContent = "正在打开页面";
				detail.textContent = "请稍候，当前页面仍然保留。";
				const started = performance.now();
				// Elapsed-wait feedback, not a claim about downloaded bytes. Keep the
				// value independent of CSS animation and reduced-motion preferences.
				const advance = () => {
					if (active !== session || session.settled || session.committed) return;
					const elapsed = performance.now() - started - PROGRESS_DELAY;
					setProgress(
						Math.min(1, 0.05 + (0.95 * elapsed) / (VISIT_TIMEOUT - PROGRESS_DELAY)),
					);
					session.progressFrame = requestAnimationFrame(advance);
				};
				session.timers.push(
					setTimeout(() => {
						if (active === session && !session.committed) {
							setState("progress");
							advance();
						}
					}, PROGRESS_DELAY),
					setTimeout(() => {
						if (active === session && !session.committed)
							setState("waiting");
					}, LOADING_DELAY),
					setTimeout(() => {
						void stop(session, "timeout");
					}, VISIT_TIMEOUT),
				);
			},
			{ priority: -100 },
		);

		swup.hooks.replace(
			"page:load",
			async (visit, args, defaultHandler) => {
				const session = active;
				if (!session || session.visit !== visit)
					return defaultHandler!(visit, args);
				const deadline = setTimeout(() => {
					void stop(session, "timeout");
				}, PAGE_TIMEOUT);
				try {
					const page = await Promise.race([
						defaultHandler!(visit, args),
						session.stopped,
					]);
					if (!session.settled) {
						const next = new DOMParser().parseFromString(
							page.html,
							"text/html",
						);
						if (
							!visit.containers.every((selector) =>
								next.querySelector(selector),
							)
						)
							throw new Error("Navigation containers missing");
					}
					return page;
				} catch (error) {
					if (!session.settled) await stop(session, "error", error);
					// Swup awaits this promise before animating and then checks visit.done.
					// Resolve an inert page for an aborted visit to avoid its automatic hard
					// redirect and the unhandled rejection in Swup 4.8's page.then().
					return {
						url: session.origin.url,
						html: "<!doctype html><html><head></head><body></body></html>",
					};
				} finally {
					clearTimeout(deadline);
				}
			},
			{ priority: 200 },
		);
		const beginTransition = (visit: Visit) => {
			if (active?.visit !== visit) return;
			active.transitioning = true;
			document.documentElement.classList.remove("show-initial-animation");
		};
		swup.hooks.on("animation:out:start", beginTransition, { priority: -100 });
		swup.hooks.on("animation:skip", beginTransition, { priority: -100 });
		swup.hooks.on(
			"content:replace",
			(visit) => {
				if (active?.visit === visit) {
					active.committed = true;
					if (active.progressFrame !== undefined)
						cancelAnimationFrame(active.progressFrame);
					setProgress(1);
					if (ui.dataset.state !== "idle") setState("transition");
				}
			},
			{ priority: 100 },
		);
		swup.hooks.on(
			"page:view",
			() => {
				displayed = snapshot();
			},
			{ priority: 100 },
		);
		swup.hooks.on("visit:end", (visit) => {
			if (active?.visit !== visit) return;
			active.settled = true;
			clear(active);
			active = undefined;
			setState("idle");
		});
		swup.hooks.on("visit:abort", async (visit) => {
			if (active?.visit === visit) await stop(active, "superseded");
		});
		ui.addEventListener("click", (event) => {
			const action = (event.target as Element).closest<HTMLElement>(
				"[data-navigation-action]",
			)?.dataset.navigationAction;
			if (action === "cancel" && active) void stop(active, "cancel");
			if (action === "close") setState("idle");
			if (action === "retry" && failedTarget) {
				void (async () => {
					await rollback;
					swup.navigate(failedTarget, { cache: { read: false, write: true } });
				})();
			}
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && active && ui.dataset.state === "waiting") {
				event.preventDefault();
				void stop(active, "cancel");
			}
		});
	};
	install();
	document.addEventListener("swup:enable", install);
}
