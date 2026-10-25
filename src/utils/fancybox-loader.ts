let Fancybox: any;
let fancyboxLoading: Promise<any> | null = null;
let fancyboxStyles = "";

function applyFancyboxStyles() {
	if (!fancyboxStyles || document.getElementById("fancybox-styles")) return;
	const style = document.createElement("style");
	style.id = "fancybox-styles";
	style.textContent = fancyboxStyles;
	document.head.append(style);
}

export async function loadFancybox() {
	if (typeof document === "undefined") return null;
	if (Fancybox) {
		applyFancyboxStyles();
		return Fancybox;
	}

	if (!fancyboxLoading) {
		fancyboxLoading = (async () => {
			// Keep the lightbox styles out of the initial document, but wait for
			// them before opening a dialog (including an early image click).
			const [mod, baseStyles, customStyles] = await Promise.all([
				import("@fancyapps/ui"),
				// ?inline prevents Astro from merging this async CSS back into
				// every page's head. Vite puts the string in a cached lazy chunk.
				import("@fancyapps/ui/dist/fancybox/fancybox.css?inline"),
				import("@styles/fancybox.css?inline"),
			]);
			fancyboxStyles = `${baseStyles.default}\n${customStyles.default}`;
			applyFancyboxStyles();
			Fancybox = mod.Fancybox;
			return Fancybox;
		})().catch((error) => {
			fancyboxLoading = null;
			throw error;
		});
	}

	return fancyboxLoading;
}

export function getFancybox() {
	return Fancybox;
}
