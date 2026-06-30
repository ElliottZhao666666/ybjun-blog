let Fancybox: any;
let fancyboxLoading: Promise<any> | null = null;

export async function loadFancybox() {
	if (typeof document === "undefined") return null;
	if (Fancybox) return Fancybox;

	if (!fancyboxLoading) {
		fancyboxLoading = (async () => {
			const mod = await import("@fancyapps/ui");
			Fancybox = mod.Fancybox;
			return Fancybox;
		})();
	}

	return fancyboxLoading;
}

export function getFancybox() {
	return Fancybox;
}