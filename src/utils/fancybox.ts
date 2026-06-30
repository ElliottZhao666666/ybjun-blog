import { getFancybox, loadFancybox } from "./fancybox-loader";

let fancyboxSelectors: string[] = [];
let pendingClickListenerAdded = false;

// 相册图片选择器 (只绑定不在 a 标签内的图片，避免与链接绑定冲突)
const albumImagesSelector =
	".custom-md img:not(a *), #post-cover img:not(a *), .moment-images img:not(a *), .photo-gallery img:not(a *)";
// 相册链接选择器
const albumLinksSelector =
	".moment-images a[data-fancybox], .photo-gallery a[data-fancybox]";
// 单张图片选择器
const singleFancyboxSelector =
	"[data-fancybox]:not(.moment-images a):not(.photo-gallery a)";

const commonConfig = {
	Thumbs: {
		autoStart: true,
		showOnStart: "yes",
	},
	Toolbar: {
		display: {
			left: ["infobar"],
			middle: [
				"zoomIn",
				"zoomOut",
				"toggle1to1",
				"rotateCCW",
				"rotateCW",
			],
			right: ["slideshow", "thumbs", "close"],
		},
	},
	animated: true,
	dragToClose: true,
	keyboard: {
		Escape: "close",
		Delete: "close",
		Backspace: "close",
		PageUp: "next",
		PageDown: "prev",
		ArrowUp: "next",
		ArrowDown: "prev",
		ArrowRight: "next",
		ArrowLeft: "prev",
	},
	fitToView: true,
	preload: 3,
	infinite: true,
	Panzoom: {
		maxScale: 3,
		minScale: 1,
	},
	caption: false,
};

function getFancyboxTrigger(event: Event) {
	const path = event.composedPath();
	for (const item of path) {
		if (!(item instanceof HTMLElement)) continue;
		if (
			item.matches(albumImagesSelector) ||
			item.matches(albumLinksSelector) ||
			item.matches(singleFancyboxSelector)
		) {
			return item;
		}
	}
	return null;
}

function openFromTrigger(Fancybox: any, trigger: HTMLElement) {
	if (typeof Fancybox?.fromTriggerEl === "function") {
		Fancybox.fromTriggerEl(trigger);
		return;
	}
	trigger.click();
}

function addPendingClickFallback() {
	if (pendingClickListenerAdded || typeof document === "undefined") return;
	pendingClickListenerAdded = true;

	document.addEventListener(
		"click",
		async (event) => {
			if (fancyboxSelectors.length > 0) return;

			const trigger = getFancyboxTrigger(event);
			if (!trigger) return;

			event.preventDefault();
			event.stopImmediatePropagation();

			await initFancybox();
			const Fancybox = getFancybox();
			if (Fancybox && fancyboxSelectors.length > 0) {
				openFromTrigger(Fancybox, trigger);
			}
		},
		{ capture: true },
	);
}

// 图片灯箱按需加载
export async function initFancybox() {
	if (typeof document === "undefined") return;
	// 检查是否有图片需要绑定
	const hasImages =
		document.querySelector(albumImagesSelector) ||
		document.querySelector(albumLinksSelector) ||
		document.querySelector(singleFancyboxSelector);
	if (!hasImages) return;
	addPendingClickFallback();
	// 检查是否已初始化 Fancybox
	const Fancybox = await loadFancybox();
	if (!Fancybox) return;
	if (fancyboxSelectors.length > 0) {
		return; // 已经初始化，直接返回
	}
	// 绑定相册/文章图片
	Fancybox.bind(albumImagesSelector, {
		...commonConfig,
		groupAll: true,
		Carousel: {
			transition: "slide",
			preload: 2,
		},
	});
	fancyboxSelectors.push(albumImagesSelector);
	// 绑定相册链接
	Fancybox.bind(albumLinksSelector, {
		...commonConfig,
		source: (el: any) => {
			return el.getAttribute("data-src") || el.getAttribute("href");
		},
	});
	fancyboxSelectors.push(albumLinksSelector);
	// 绑定单独的 fancybox 图片
	Fancybox.bind(singleFancyboxSelector, commonConfig);
	fancyboxSelectors.push(singleFancyboxSelector);
}

// 清理 Fancybox 实例
export function cleanupFancybox() {
	const Fancybox = getFancybox();
	if (!Fancybox) return; // 如果从未加载过，无需清理
	fancyboxSelectors.forEach((selector) => {
		Fancybox.unbind(selector);
	});
	fancyboxSelectors = [];
}
