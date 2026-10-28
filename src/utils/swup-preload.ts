/**
 * Compatibility for @swup/astro 1.7 / @swup/preload-plugin 3.2.11.
 * The plugin stores hovered URLs as absolute hrefs, while page:load receives a
 * local path. Reuse either pending key without changing its link eligibility,
 * priority queue, hover/touch/focus listeners or cache implementation.
 */
interface PageData {
	url: string;
	html: string;
}

interface Visit {
	to: { url: string };
	from: { url: string };
	cache: { read: boolean };
	readonly done: boolean;
}

interface PageLoadArguments {
	options: unknown;
	page?: PageData;
	cache?: boolean;
}

interface PreloadPlugin {
	preloadPromises?: Map<string, Promise<PageData | void>>;
}

interface SwupInstance {
	findPlugin(name: string): PreloadPlugin | undefined;
	cache: { get(url: string): PageData | undefined };
	fetchPage(url: string, options: unknown): Promise<PageData>;
	hooks: {
		replace(
			name: "page:load",
			handler: (visit: Visit, args: PageLoadArguments) => Promise<PageData>,
			options: { priority: number },
		): unknown;
	};
}

const installed = new WeakSet<SwupInstance>();

export function installSwupPreloadCompatibility(): void {
	const install = () => {
		const swup = window.swup as SwupInstance | undefined;
		if (!swup || installed.has(swup)) return;
		const plugin = swup.findPlugin("SwupPreloadPlugin");
		if (!plugin?.preloadPromises) return;
		installed.add(swup);

		// Replace only page selection. All surrounding Swup lifecycle hooks and
		// fetch/cache hooks still run. The final branch mirrors Swup's core loader.
		swup.hooks.replace(
			"page:load",
			async (visit, args) => {
				const url = visit.to.url;
				if (visit.cache.read) {
					const cached = swup.cache.get(url);
					if (cached) {
						args.page = cached;
						args.cache = true;
						return cached;
					}

					const absoluteURL = new URL(url, window.location.href).href;
					let pending =
						plugin.preloadPromises?.get(url) ??
						plugin.preloadPromises?.get(absoluteURL);
					if (!pending) {
						// Cross-page anchor links may have a hash in the preload key.
						// Compare the document URL while retaining its query string.
						for (const [key, promise] of plugin.preloadPromises ?? []) {
							const candidate = new URL(key, document.baseURI);
							candidate.hash = "";
							if (candidate.href === absoluteURL) {
								pending = promise;
								break;
							}
						}
					}
					// A failed speculative request must not make navigation resolve to
					// undefined (the old plugin swallows speculative fetch failures).
					const preloaded = await pending?.catch(() => undefined);
					if (visit.done) {
						// Cancellation must not turn a failed preload into another fetch.
						return {
							url: visit.from.url,
							html: "<!doctype html><html><head></head><body></body></html>",
						};
					}
					if (preloaded?.html) {
						args.page = preloaded;
						args.cache = false;
						return preloaded;
					}
				}

				args.page = await swup.fetchPage(url, args.options);
				args.cache = false;
				return args.page;
			},
			{ priority: 100 },
		);
	};

	install();
	document.addEventListener("swup:enable", install);
}
