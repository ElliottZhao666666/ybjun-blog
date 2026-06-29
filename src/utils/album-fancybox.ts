let Fancybox: any;
let fancyboxLoading: Promise<any> | null = null;

export async function loadAlbumFancybox() {
	if (typeof document === "undefined") return null;
	if (Fancybox) return Fancybox;
	if (fancyboxLoading) return fancyboxLoading;

	fancyboxLoading = (async () => {
		const mod = await import("@fancyapps/ui");
		await import("@fancyapps/ui/dist/fancybox/fancybox.css");
		Fancybox = mod.Fancybox;
		return Fancybox;
	})();

	return fancyboxLoading;
}

export function getAlbumFancybox() {
	return Fancybox;
}