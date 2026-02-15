<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import { fade, fly } from "svelte/transition";

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

let album = null;
let loading = true;
let error = "";

// 查看器状态
let viewerOpen = false;
let currentIndex = 0;
let showControls = true;
let controlsTimer: any;

const API_BASE = "https://gallery.blog.ybjun.com";

onMount(async () => {
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

	window.addEventListener("keydown", handleKeydown);
	return () => {
		window.removeEventListener("keydown", handleKeydown);
	};
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

// --- 查看器交互 ---
function openViewer(index: number) {
	currentIndex = index;
	viewerOpen = true;
	resetControlsTimer();
	document.body.style.overflow = "hidden"; // 锁定滚动
	document.body.classList.add("lightbox-open"); // 🟢 添加全局类，用于隐藏 Navbar
}

function closeViewer() {
	viewerOpen = false;
	document.body.style.overflow = "";
	document.body.classList.remove("lightbox-open"); // 🟢 移除全局类
}
function nextPhoto(e?: Event) {
	e?.stopPropagation();
	if (album && currentIndex < album.photos.length - 1) currentIndex++;
	else currentIndex = 0;
}

function prevPhoto(e?: Event) {
	e?.stopPropagation();
	if (currentIndex > 0) currentIndex--;
	else if (album) currentIndex = album.photos.length - 1;
}

function handleKeydown(e: KeyboardEvent) {
	if (!viewerOpen) return;
	if (e.key === "Escape") closeViewer();
	if (e.key === "ArrowRight") nextPhoto();
	if (e.key === "ArrowLeft") prevPhoto();
	resetControlsTimer();
}

function resetControlsTimer() {
	showControls = true;
	if (controlsTimer) clearTimeout(controlsTimer);
	controlsTimer = setTimeout(() => {
		showControls = false;
	}, 3000);
}

function handleMouseMove() {
	if (viewerOpen) resetControlsTimer();
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

            <div class="columns-1 md:columns-2 gap-4 space-y-4">
                {#each album.photos as photo, index}
                    <div 
                        class="break-inside-avoid relative group rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-zoom-in"
                        on:click={() => openViewer(index)}
                        role="button"
                        tabindex="0"
                    >
                        <img 
                            src={photo.url} 
                            alt={photo.caption}
                            class="w-full h-auto object-cover transition-opacity duration-300 hover:opacity-90"
                            loading="lazy"
                        />
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    {#if viewerOpen && album}
        <div 
            class="fixed inset-0 z-100000] bg-black text-white flex items-center justify-center"
            transition:fade={{ duration: 200 }}
            on:mousemove={handleMouseMove}
            on:click={handleMouseMove}
        >
            <div class="relative w-full h-full flex items-center justify-center p-0 md:p-4">
                {#key currentIndex}
                    <img 
                        src={album.photos[currentIndex].url} 
                        alt="" 
                        class="max-w-full max-h-full object-contain shadow-2xl select-none"
                        in:fly={{ x: 20, duration: 300, opacity: 0 }}
                    />
                {/key}
            </div>

            <div class="absolute inset-0 pointer-events-none flex items-center justify-between px-2 md:px-8 transition-opacity duration-300 {showControls ? 'opacity-100' : 'opacity-0'}">
                <button class="p-4 rounded-full bg-black/20 hover:bg-black/50 text-white pointer-events-auto transition backdrop-blur-sm cursor-pointer" on:click={prevPhoto}>
                    <Icon icon="material-symbols:chevron-left" class="text-4xl" />
                </button>
                <button class="p-4 rounded-full bg-black/20 hover:bg-black/50 text-white pointer-events-auto transition backdrop-blur-sm cursor-pointer" on:click={nextPhoto}>
                    <Icon icon="material-symbols:chevron-right" class="text-4xl" />
                </button>
            </div>

            <div class="absolute inset-0 pointer-events-none transition-opacity duration-500 {showControls ? 'opacity-100' : 'opacity-0'}">
                
                <button 
                    class="absolute top-6 right-6 p-2 rounded-full bg-black/30 hover:bg-red-500/80 backdrop-blur-md text-white pointer-events-auto transition cursor-pointer z-50"
                    on:click={closeViewer}
                >
                    <Icon icon="material-symbols:close" class="text-3xl" />
                </button>

                <div class="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto">
                    <div class="max-w-[90vw] mx-auto relative flex items-end justify-between">
                        
                        <div class="text-xl font-bold text-white/90 font-mono tracking-widest">
                            {currentIndex + 1} <span class="text-white/50 text-base">/ {album.photos.length}</span>
                        </div>

                        <div class="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center gap-2 pb-1 text-sm md:text-base text-white/90 whitespace-nowrap">
                            
                            <div class="flex items-center gap-6 opacity-90">
                                {#if album.photos[currentIndex].shot_time}
                                    <div class="flex items-center gap-2">
                                        <Icon icon="material-symbols:schedule" class="text-lg opacity-80" />
                                        <span class="font-mono">{formatDateTime(album.photos[currentIndex].shot_time)}</span>
                                    </div>
                                {/if}
                                {#if album.photos[currentIndex].exif_camera}
                                    <div class="flex items-center gap-2">
                                        <Icon icon="material-symbols:photo-camera" class="text-lg opacity-80" />
                                        <span>{album.photos[currentIndex].exif_camera}</span>
                                    </div>
                                {/if}
                            </div>

                            <div class="flex items-center gap-4 font-mono text-white/80 text-xs md:text-sm">
                                {#if album.photos[currentIndex].exif_focal}
                                    <span>{album.photos[currentIndex].exif_focal}</span>
                                    <span class="opacity-30">|</span>
                                {/if}
                                {#if album.photos[currentIndex].exif_aperture}
                                    <span>{formatAperture(album.photos[currentIndex].exif_aperture)}</span>
                                    <span class="opacity-30">|</span>
                                {/if}
                                {#if album.photos[currentIndex].exif_shutter}
                                    <span>{formatShutter(album.photos[currentIndex].exif_shutter)}</span>
                                    <span class="opacity-30">|</span>
                                {/if}
                                {#if album.photos[currentIndex].exif_iso}
                                    <span>{formatISO(album.photos[currentIndex].exif_iso)}</span>
                                {/if}
                            </div>
                        </div>

                        <div class="w-10"></div> 
                    </div>
                </div>
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
</style>