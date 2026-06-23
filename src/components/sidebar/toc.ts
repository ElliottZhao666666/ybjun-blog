import { NAVBAR_HEIGHT } from "@constants/constants";
import { widgetManager } from "@utils/widget";

export class TableOfContents extends HTMLElement {
	tocEl: HTMLElement | null = null;
	visibleClass = "visible";
	inViewClass = "in-view";
	observer: IntersectionObserver;
	anchorNavTarget: HTMLElement | null = null;
	headingIdxMap = new Map<string, number>();
	headings: HTMLElement[] = [];
	tocEntries: HTMLAnchorElement[] = [];
	active: boolean[] = [];
	inView: boolean[] = [];
	activeIdx = -1;
	activeIndicator: HTMLElement | null = null;
	_retryCount = 0;
	_backToTopObserver: MutationObserver | null = null;
	_scrollRaf = 0;
	_hashSyncTimer: number | null = null;

	_handleBtnClick = (e: Event) => {
		e.stopPropagation();
		const panel = this.querySelector(".toc-floating-panel");
		const isHidden =
			panel?.classList.contains("hidden") ||
			panel?.classList.contains("opacity-0");
		this.toggleFloatingPanel(!!isHidden);
	};

	_handleDocClick = (e: Event) => {
		const panel = this.querySelector(".toc-floating-panel");
		if (
			panel &&
			!panel.classList.contains("hidden") &&
			!panel.contains(e.target as Node)
		) {
			this.toggleFloatingPanel(false);
		}
	};

	constructor() {
		super();
		this.observer = new IntersectionObserver(this.markVisibleSection);
	}

	getNavbarHeight() {
		return Number.parseInt(
			this.dataset.navbarHeight || NAVBAR_HEIGHT.toString(),
		);
	}

	isAtArticleTop = () => {
		const firstHeading = this.headings[0];
		if (!firstHeading) return window.scrollY <= this.getNavbarHeight();

		return firstHeading.getBoundingClientRect().top > this.getNavbarHeight() + 24;
	};

	markActiveHeading = (idx: number) => {
		this.active = new Array(this.headings.length).fill(false);
		if (idx >= 0 && idx < this.active.length) this.active[idx] = true;
		this.activeIdx = idx;
	};

	isInRange(value: number, min: number, max: number) {
		return min < value && value < max;
	}

	getCurrentHeadingIndex = () => {
		if (!this.headings.length) return;

		let activeIdx = -1;
		const threshold = this.getNavbarHeight() + 24;
		for (let i = 0; i < this.headings.length; i++) {
			const heading = this.headings[i];
			const rect = heading.getBoundingClientRect();
			if (rect.top <= threshold) {
				activeIdx = i;
			} else {
				break;
			}
		}
		if (activeIdx === -1) {
			activeIdx = 0;
		}
		return activeIdx;
	};

	fallback = () => {
		const activeIdx = this.getCurrentHeadingIndex();
		if (activeIdx === undefined) return;
		this.markActiveHeading(activeIdx);
	};

	scheduleHashSync = () => {
		if (!this.isPostPage()) return;
		if (this._hashSyncTimer !== null) {
			window.clearTimeout(this._hashSyncTimer);
		}

		this._hashSyncTimer = window.setTimeout(() => {
			if (this.isAtArticleTop()) {
				if (!window.location.hash) return;

				history.replaceState(
					history.state,
					"",
					`${window.location.pathname}${window.location.search}`,
				);
				return;
			}

			if (this.activeIdx < 0) return;
			const activeHeading = this.headings[this.activeIdx];
			if (!activeHeading?.id) return;

			const currentHash = decodeURIComponent(
				window.location.hash.substring(1),
			);
			if (currentHash === activeHeading.id) return;

			const nextUrl = `${window.location.pathname}${window.location.search}#${encodeURIComponent(activeHeading.id)}`;
			history.replaceState(history.state, "", nextUrl);
		}, 1000);
	};

	updateActiveHeading = (syncHash = true) => {
		const activeIdx = this.getCurrentHeadingIndex();
		if (activeIdx === undefined) return;

		const changed = activeIdx !== this.activeIdx;
		this.markActiveHeading(activeIdx);
		this.update();

		if (syncHash && (changed || (this.isAtArticleTop() && window.location.hash))) {
			this.scheduleHashSync();
		}
	};

	toggleActiveHeading = () => {
		let min = this.active.length,
			max = -1;

		for (let i = 0; i < this.active.length; i++) {
			if (this.active[i]) {
				this.tocEntries[i].classList.add(this.visibleClass);
				min = Math.min(min, i);
				max = Math.max(max, i);
			} else {
				this.tocEntries[i].classList.remove(this.visibleClass);
			}

			if (this.inView[i]) {
				this.tocEntries[i].classList.add(this.inViewClass);
			} else {
				this.tocEntries[i].classList.remove(this.inViewClass);
			}
		}

		if (max === -1) {
			this.activeIndicator?.setAttribute("style", "opacity: 0");
		} else {
			const top = this.tocEntries[min].offsetTop;
			const bottom =
				this.tocEntries[max].offsetTop + this.tocEntries[max].offsetHeight;
			this.activeIndicator?.setAttribute(
				"style",
				`top: ${top}px; height: ${bottom - top}px; opacity: 1`,
			);
		}
	};

	scrollToActiveHeading = () => {
		if (this.anchorNavTarget || !this.tocEl || this.activeIdx < 0) return;
		const activeEntry = this.tocEntries[this.activeIdx];
		if (!activeEntry) return;

		const entryTop = activeEntry.offsetTop;
		const entryBottom = entryTop + activeEntry.offsetHeight;
		const visibleTop = this.tocEl.scrollTop;
		const visibleBottom = visibleTop + this.tocEl.clientHeight;
		const padding = 32;

		if (
			entryTop >= visibleTop + padding &&
			entryBottom <= visibleBottom - padding
		) {
			return;
		}

		const top = Math.max(
			0,
			entryTop - this.tocEl.clientHeight * 0.45 + activeEntry.offsetHeight / 2,
		);

		this.tocEl.scrollTo({
			top,
			left: 0,
			behavior: "smooth",
		});
	};

	update = () => {
		requestAnimationFrame(() => {
			this.toggleActiveHeading();
			this.scrollToActiveHeading();
		});
	};

	markVisibleSection = (entries: IntersectionObserverEntry[]) => {
		entries.forEach((entry) => {
			const id = entry.target.getAttribute("id");
			const idx = id ? this.headingIdxMap.get(id) : undefined;
			if (idx != undefined) this.inView[idx] = entry.isIntersecting;

			if (entry.isIntersecting && this.anchorNavTarget == entry.target)
				this.anchorNavTarget = null;
		});

		if (!this.active.includes(true)) this.fallback();
		this.update();
	};

	handleScroll = () => {
		if (this._scrollRaf) return;
		this._scrollRaf = window.requestAnimationFrame(() => {
			this._scrollRaf = 0;
			this.updateActiveHeading();
		});
	};

	handleAnchorClick = (event: Event) => {
		const anchor = event
			.composedPath()
			.find((element) => element instanceof HTMLAnchorElement);

		if (anchor) {
			event.preventDefault();
			const id = decodeURIComponent(anchor.hash?.substring(1));
			const targetElement = document.getElementById(id);
			if (targetElement) {
				const targetTop =
					targetElement.getBoundingClientRect().top +
					window.scrollY -
					this.getNavbarHeight();
				window.scrollTo({
					top: targetTop,
					behavior: "smooth",
				});
				history.pushState(
					history.state,
					"",
					`${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`,
				);
			}
			const idx = this.headingIdxMap.get(id);
			if (idx !== undefined) {
				this.anchorNavTarget = this.headings[idx];
				this.markActiveHeading(idx);
				this.update();
			} else {
				this.anchorNavTarget = null;
			}
			// If floating, close the panel after click
			if (this.dataset.isFloating === "true") {
				this.toggleFloatingPanel(false);
			}
		}
	};

	isPostPage() {
		return (
			window.location.pathname.includes("/posts/") ||
			document.querySelector(".custom-md, .markdown-content") !== null
		);
	}

	updateFloatingPosition = () => {
		if (this.dataset.isFloating !== "true") return;
		const container = this.querySelector(
			".toc-floating-container",
		) as HTMLElement;
		const backToTopBtn = document.getElementById("back-to-top-btn");
		if (!container || !backToTopBtn) return;

		if (backToTopBtn.classList.contains("hide")) {
			container.classList.remove("move-up");
		} else {
			container.classList.add("move-up");
		}
	};

	toggleFloatingPanel(show: boolean) {
		const panel = this.querySelector(".toc-floating-panel");
		if (!panel) return;
		if (show) {
			panel.classList.remove("hidden");
			requestAnimationFrame(() => {
				panel.classList.remove(
					"opacity-0",
					"translate-y-4",
					"pointer-events-none",
				);
			});
		} else {
			panel.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
			setTimeout(() => {
				panel.classList.add("hidden");
			}, 300);
		}
	}

	regenerateTOC() {
		const isFloating = this.dataset.isFloating === "true";
		const tocWrapper = isFloating
			? (this.querySelector(".toc-floating-container") as HTMLElement)
			: (this.closest("widget-layout") as HTMLElement);

		if (!tocWrapper) return false;

		const headings = widgetManager.getPageHeadings();
		if (headings.length === 0 && this.isPostPage() && this._retryCount < 3) {
			this._retryCount++;
			setTimeout(() => this.init(), 120);
			return false;
		}
		this._retryCount = 0;

		const isPost = this.isPostPage();

		if (headings.length === 0 && !isPost) {
			if (!tocWrapper.classList.contains("toc-hide")) {
				if (!isFloating) {
					tocWrapper.style.maxHeight = tocWrapper.offsetHeight + "px";
					tocWrapper.offsetHeight;
					tocWrapper.classList.add("toc-hide");
					tocWrapper.style.maxHeight = "";
				} else {
					tocWrapper.classList.add("toc-hide");
				}
			}
			return true;
		}

		if (tocWrapper.classList.contains("toc-hide")) {
			tocWrapper.classList.remove("toc-hide");
			if (!isFloating) {
				const targetHeight = tocWrapper.scrollHeight;
				tocWrapper.style.maxHeight = "0px";
				tocWrapper.offsetHeight;
				tocWrapper.style.maxHeight = targetHeight + "px";
				setTimeout(() => {
					if (!tocWrapper.classList.contains("toc-hide")) {
						tocWrapper.style.maxHeight = "";
					}
				}, 300);
			}
		}

		const minDepth = Math.min(...headings.map((h) => h.depth));
		const maxLevel = Number.parseInt(this.dataset.depth || "3");
		let heading1Count = 1;
		const tocHTML = headings
			.filter((heading) => heading.depth < minDepth + maxLevel)
			.map((heading) => {
				const depthClass =
					heading.depth === minDepth
						? ""
						: heading.depth === minDepth + 1
							? "ml-4"
							: "ml-8";
				const badgeContent =
					heading.depth === minDepth
						? heading1Count++
						: heading.depth === minDepth + 1
							? '<div class="transition w-2 h-2 rounded-[0.1875rem] bg-(--toc-badge-bg)"></div>'
							: '<div class="transition w-1.5 h-1.5 rounded-xs bg-black/5 dark:bg-white/10"></div>';
				return `<a href="#${heading.slug}" class="px-2 flex gap-2 relative transition w-full min-h-9 rounded-xl hover:bg-(--toc-btn-hover) active:bg-(--toc-btn-active) py-2">
                    <div class="transition w-5 h-5 shrink-0 rounded-lg text-xs flex items-center justify-center font-bold ${depthClass} ${heading.depth === minDepth ? "bg-(--toc-badge-bg) text-(--btn-content)" : ""}">
                        ${badgeContent}
                    </div>
                    <div class="transition text-sm ${heading.depth <= minDepth + 1 ? "text-50" : "text-30"}">${heading.text}</div>
                </a>`;
			})
			.join("");

		const innerContent = this.querySelector(".toc-inner-content");
		if (innerContent) {
			innerContent.innerHTML =
				tocHTML +
				'<div class="active-indicator -z-10 absolute left-0 right-0 rounded-xl transition-all pointer-events-none bg-(--toc-btn-hover)" style="opacity: 0"></div>';
		}
		return true;
	}

	init() {
		this.observer.disconnect();
		this.headingIdxMap.clear();
		this.headings = [];
		this.active = [];
		this.inView = [];
		this.activeIdx = -1;

		if (!this.regenerateTOC()) return;

		this.tocEl =
			this.querySelector(".toc-scroll-container") ||
			this.querySelector(".toc-floating-panel");
		this.tocEl?.addEventListener("click", this.handleAnchorClick, {
			capture: true,
		});

		this.activeIndicator = this.querySelector(".active-indicator");

		if (this.dataset.isFloating === "true") {
			const btn = this.querySelector(".toc-floating-btn");
			btn?.removeEventListener("click", this._handleBtnClick);
			btn?.addEventListener("click", this._handleBtnClick);

			document.removeEventListener("click", this._handleDocClick);
			document.addEventListener("click", this._handleDocClick);

			// 监听 backToTop 按钮的状态
			const backToTopBtn = document.getElementById("back-to-top-btn");
			if (backToTopBtn) {
				this._backToTopObserver?.disconnect();
				this._backToTopObserver = new MutationObserver((mutations) => {
					mutations.forEach((mutation) => {
						if (
							mutation.type === "attributes" &&
							mutation.attributeName === "class"
						) {
							this.updateFloatingPosition();
						}
					});
				});
				this._backToTopObserver.observe(backToTopBtn, { attributes: true });
				this.updateFloatingPosition(); // 初始状态检查
			}
		}

		const allEntries = Array.from(
			this.querySelectorAll<HTMLAnchorElement>("a[href^='#']"),
		);
		const validHeadings: HTMLElement[] = [];
		const validEntries: HTMLAnchorElement[] = [];

		for (let i = 0; i < allEntries.length; i++) {
			const entry = allEntries[i];
			const id = decodeURIComponent(entry.hash?.substring(1));
			const heading = document.getElementById(id);
			if (heading instanceof HTMLElement) {
				validHeadings.push(heading);
				validEntries.push(entry);
				this.headingIdxMap.set(id, validEntries.length - 1);
			}
		}

		this.headings = validHeadings;
		this.tocEntries = validEntries;
		this.active = new Array(this.tocEntries.length).fill(false);
		this.inView = new Array(this.tocEntries.length).fill(false);

		if (this.tocEntries.length === 0) return;

		this.headings.forEach((heading) => this.observer.observe(heading));
		window.removeEventListener("scroll", this.handleScroll);
		window.addEventListener("scroll", this.handleScroll, { passive: true });
		this.updateActiveHeading(false);
	}

	connectedCallback() {
		const element =
			document.querySelector(".custom-md") ||
			document.querySelector(".prose") ||
			document.querySelector(".markdown-content");
		let initialized = false;
		const tryInit = () => {
			if (!initialized) {
				initialized = true;
				this.init();
			}
		};
		if (element) {
			element.addEventListener("animationend", tryInit, { once: true });
			setTimeout(tryInit, 300);
		} else {
			tryInit();
			setTimeout(tryInit, 300);
		}

		const setupSwup = () => {
			if (window.swup && window.swup.hooks) {
				if ((this as any)._swupListenersAdded) return;
				window.swup.hooks.on("visit:start", () => {
					if (this.isPostPage()) {
						const isFloating = this.dataset.isFloating === "true";
						const tocWrapper = isFloating
							? (this.querySelector(".toc-floating-container") as HTMLElement)
							: (this.closest("widget-layout") as HTMLElement);
						if (tocWrapper && !tocWrapper.classList.contains("toc-hide")) {
							if (!isFloating) {
								tocWrapper.style.maxHeight = tocWrapper.offsetHeight + "px";
								tocWrapper.offsetHeight;
								tocWrapper.classList.add("toc-hide");
								tocWrapper.style.maxHeight = "";
							} else {
								tocWrapper.classList.add("toc-hide");
							}
						}
					}
				});
				window.swup.hooks.on("content:replace", () => {
					const isFloating = this.dataset.isFloating === "true";
					const tocWrapper = isFloating
						? (this.querySelector(".toc-floating-container") as HTMLElement)
						: (this.closest("widget-layout") as HTMLElement);
					if (tocWrapper && !this.isPostPage()) {
						tocWrapper.classList.add("toc-hide");
						if (!isFloating) tocWrapper.style.maxHeight = "";
					}
					setTimeout(() => this.init(), 100);
				});
				(this as any)._swupListenersAdded = true;
			}
		};

		if (window.swup) setupSwup();
		else document.addEventListener("swup:enable", setupSwup);
		window.addEventListener("content-decrypted", () => this.init());
	}

	disconnectedCallback() {
		this.headings.forEach((heading) => this.observer.unobserve(heading));
		this.observer.disconnect();
		this._backToTopObserver?.disconnect();
		this.tocEl?.removeEventListener("click", this.handleAnchorClick);
		window.removeEventListener("scroll", this.handleScroll);
		if (this._scrollRaf) window.cancelAnimationFrame(this._scrollRaf);
		if (this._hashSyncTimer !== null) window.clearTimeout(this._hashSyncTimer);

		const btn = this.querySelector(".toc-floating-btn");
		btn?.removeEventListener("click", this._handleBtnClick);
		document.removeEventListener("click", this._handleDocClick);
	}
}

if (!customElements.get("table-of-contents")) {
	customElements.define("table-of-contents", TableOfContents);
}
