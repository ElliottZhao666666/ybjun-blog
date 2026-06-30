<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount, onDestroy, tick } from "svelte";
import { getFancybox, loadFancybox } from "../../utils/fancybox-loader";

interface Photo {
	id: string;
	url: string;
	width: number;
	height: number;
	caption?: string;
	shot_time?: number;
	exif_camera?: string;
	exif_lens?: string;
	exif_focal?: string;
	exif_aperture?: string;
	exif_shutter?: string;
	exif_iso?: string;
}

interface AlbumInfo {
	id: string;
	title: string;
	description: string;
	album_date: number;
	photos: Photo[];
}

let album: AlbumInfo | null = null;
let loading = true;
let error = "";

const fancyboxSelector = '[data-fancybox="album-detail"]';
let fancyboxReady = false;
const imageRetryCounts = new WeakMap<HTMLImageElement, number>();

const API_BASE = "https://galleryblog.ybjun.com";

onMount(async () => {
    preloadFancybox();

	const urlParams = new URLSearchParams(window.location.search);
	const albumId = urlParams.get("id");

	if (!albumId) {
		error = "无效的相册链接";
		loading = false;
		return;
	}

	try {
		const res = await fetch(`${API_BASE}/albums/${albumId}`);
		if (!res.ok) throw new Error(`API Error: ${res.status}`);
		album = await res.json();
	} catch (e) {
		console.error(e);
		error = "相册加载失败，请稍后重试";
	} finally {
		loading = false;
	}

    if (album) await initAlbumFancybox();
});

onDestroy(() => {
    cleanupAlbumFancybox();
    document.body.classList.remove("lightbox-open");
});

// --- 格式化函数 ---
function formatDate(ts: number) {
	return new Date(ts * 1000).toLocaleDateString("zh-CN", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

// 精确到秒的时间
function formatDateTime(ts: number | undefined) {
	if (!ts) return "未知时间";
	return new Date(ts * 1000).toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false, // 24小时制
	});
}

// 处理 EXIF 格式
function formatAperture(val?: string) {
	if (!val) return "";
	// 确保以 f/ 开头
	return val.startsWith("f/") ? val : `f/${val}`;
}

function formatShutter(val?: string) {
	if (!val) return "";
	// 确保以 s 结尾
	return val.endsWith("s") ? val : `${val}s`;
}

function formatISO(val?: string) {
	if (!val) return "";
	// 只保留数字，去掉可能存在的 ISO 前缀
	const num = val.replace(/ISO\s*/i, "");
	return `ISO ${num}`;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildPhotoCaption(photo: Photo) {
    const exifRows = [
        photo.shot_time ? ["拍摄时间", formatDateTime(photo.shot_time)] : null,
        photo.exif_camera ? ["相机", photo.exif_camera] : null,
        photo.exif_lens ? ["镜头", photo.exif_lens] : null,
        photo.exif_focal ? ["焦距", photo.exif_focal] : null,
        photo.exif_aperture ? ["光圈", formatAperture(photo.exif_aperture)] : null,
        photo.exif_shutter ? ["快门", formatShutter(photo.exif_shutter)] : null,
        photo.exif_iso ? ["感光度", formatISO(photo.exif_iso)] : null,
    ].filter(Boolean) as [string, string][];

    if (exifRows.length === 0) return "";

    return `<div class="album-fancybox-exif">${exifRows
        .map(
            ([label, value]) =>
                `<span class="album-fancybox-exif-item"><span class="album-fancybox-exif-label">${escapeHtml(label)}</span>${escapeHtml(value)}</span>`,
        )
        .join("")}</div>`;
}

async function preloadFancybox() {
    return loadFancybox();
}

async function initAlbumFancybox() {
    if (typeof document === "undefined" || fancyboxReady) return;
    await tick();

    if (!document.querySelector(fancyboxSelector)) return;

    const Fancybox = await preloadFancybox();
    if (!Fancybox) return;

    Fancybox.bind(fancyboxSelector, {
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
        on: {
            init: () => document.body.classList.add("lightbox-open"),
            destroy: () => document.body.classList.remove("lightbox-open"),
        },
    });
    fancyboxReady = true;
}

async function handlePhotoClick(event: MouseEvent) {
    if (fancyboxReady) return;

    event.preventDefault();
    event.stopPropagation();
    await initAlbumFancybox();
    const trigger = event.currentTarget as HTMLElement | null;
    const Fancybox = getFancybox();

    if (trigger && typeof Fancybox?.fromTriggerEl === "function") {
        Fancybox.fromTriggerEl(trigger);
    } else {
        trigger?.click();
    }
}

function handleImageError(event: Event) {
    const image = event.currentTarget as HTMLImageElement | null;
    if (!image) return;

    const retryCount = imageRetryCounts.get(image) ?? 0;
    if (retryCount >= 2) return;

    imageRetryCounts.set(image, retryCount + 1);
    const url = new URL(image.currentSrc || image.src);
    url.searchParams.set("retry", String(Date.now()));
    image.src = url.toString();
}

function cleanupAlbumFancybox() {
    const Fancybox = getFancybox();
    if (!Fancybox || !fancyboxReady) return;
    Fancybox.unbind(fancyboxSelector);
    fancyboxReady = false;
}
</script>

<div class="w-full relative">
    {#if loading}
        <div class="animate-pulse space-y-6">
            <div class="h-10 bg-black/5 dark:bg-white/5 w-1/3 rounded-lg"></div>
            <div class="grid grid-cols-2 gap-4 mt-8">
                <div class="aspect-square bg-black/5 dark:bg-white/5 rounded-xl"></div>
            </div>
        </div>
    {:else if error}
        <div class="text-center py-20 text-red-500">
            <Icon icon="material-symbols:error-outline" class="text-4xl mx-auto mb-2" />
            <p>{error}</p>
        </div>
    {:else if album}
        <div class="mb-8 relative onload-animation-up">
            <div class="flex flex-row text-black/30 dark:text-white/30 gap-5 mb-3 transition">
                <div class="flex flex-row items-center">
                    <div class="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 flex items-center justify-center mr-2">
                        <Icon icon="material-symbols:photo-library-rounded" />
                    </div>
                    <div class="text-sm">{album.photos.length} 张照片</div>
                </div>
                <div class="flex flex-row items-center">
                    <div class="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 flex items-center justify-center mr-2">
                        <Icon icon="material-symbols:calendar-today-rounded" />
                    </div>
                    <div class="text-sm">{formatDate(album.album_date)}</div>
                </div>
                <a href="/gallery/" class="flex flex-row items-center hover:text-[var(--primary)] transition-colors cursor-pointer">
                    <div class="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 flex items-center justify-center mr-2">
                        <Icon icon="material-symbols:folder-open-rounded" />
                    </div>
                    <div class="text-sm">相册</div>
                </a>
            </div>

            <h1 class="transition w-full block font-bold mb-3 text-3xl md:text-[2.25rem] leading-snug text-black/90 dark:text-white/90 relative pl-4 md:pl-0">
                <span class="absolute left-[-16px] md:left-[-24px] top-[0.4em] w-1 h-[0.7em] rounded-md bg-[var(--primary)] block"></span>
                {album.title}
            </h1>

            {#if album.description}
                <div class="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6 markdown-content">
                    {album.description}
                </div>
            {/if}

            <div class="border-b border-dashed border-[var(--line-divider)] mb-8"></div>

            <div class="album-detail-masonry columns-1 md:columns-2 gap-4">
                {#each album.photos as photo, index}
                    <a 
                        href={photo.url}
                        data-fancybox="album-detail"
                        data-caption={buildPhotoCaption(photo)}
                        class="album-detail-photo-card break-inside-avoid relative group block w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-zoom-in"
                        on:click={handlePhotoClick}
                    >
                        <img 
                            src={photo.url} 
                            alt={photo.caption || `相册照片 ${index + 1}`}
                            width={photo.width}
                            height={photo.height}
                            class="w-full h-auto object-cover transition-opacity duration-300 hover:opacity-90"
                            loading={index < 4 ? "eager" : "lazy"}
                            fetchpriority={index < 2 ? "high" : "auto"}
                            decoding="async"
                            on:error={handleImageError}
                        />
                    </a>
                {/each}
            </div>
        </div>
    {/if}
</div>
<style>
    /* 当灯箱打开时，隐藏页面上的顶栏、浮动元素以及粒子背景 */
    :global(body.lightbox-open header),       /* 顶栏 */
    :global(body.lightbox-open #navbar),      /* 导航栏 */
    :global(body.lightbox-open .navbar-wrapper), 
    :global(body.lightbox-open #banner-wrapper), /* Banner */
    :global(body.lightbox-open canvas) {      /* 👈 新增：隐藏所有 Canvas (粒子特效) */
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.3s ease-out;
    }

    .album-detail-masonry {
        column-gap: 1rem;
    }

    .album-detail-photo-card {
        margin-bottom: 1rem;
        page-break-inside: avoid;
        break-inside: avoid;
        transform: translateZ(0);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .album-detail-photo-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
    }

    :global(.album-fancybox-exif) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.35rem 0.8rem;
        max-width: min(92vw, 72rem);
        margin: 0 auto;
        padding: 0 0.75rem;
        font-size: clamp(0.75rem, 2.4vw, 0.875rem);
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.86);
    }

    :global(.album-fancybox-exif-item) {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        white-space: nowrap;
    }

    :global(.album-fancybox-exif-label) {
        color: rgba(255, 255, 255, 0.52);
    }

    @media (max-width: 640px) {
        .album-detail-masonry {
            column-gap: 0;
        }

        .album-detail-photo-card {
            margin-bottom: 0.875rem;
        }

        :global(.album-fancybox-exif) {
            justify-content: flex-start;
            gap: 0.3rem 0.65rem;
            max-width: 96vw;
            max-height: 22vh;
            overflow-y: auto;
            padding: 0 0.5rem;
            text-align: left;
        }

        :global(.album-fancybox-exif-item) {
            flex: 1 1 calc(50% - 0.65rem);
            min-width: 8.5rem;
            white-space: normal;
        }
    }

    @media (max-width: 380px) {
        :global(.album-fancybox-exif-item) {
            flex-basis: 100%;
        }
    }
</style>