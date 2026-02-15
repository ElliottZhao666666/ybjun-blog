<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import { fade } from "svelte/transition";

interface Album {
	id: string;
	title: string;
	description: string;
	album_date: number;
	cover_url: string;
}

interface TimelineGroup {
	year: number;
	items: {
		dateStr: string;
		fullDate: Date;
		albums: Album[];
	}[];
}

let loading = true;
let error = "";
let timelineGroups: TimelineGroup[] = [];

const API_BASE = "https://gallery.blog.ybjun.com";

onMount(async () => {
	try {
		// 1. 先获取所有相册的基本信息
		const res = await fetch(`${API_BASE}/albums`);
		if (!res.ok) throw new Error("Failed to fetch albums");
		let albums: Album[] = await res.json();

		// 2. 🟢 新增逻辑：并行获取每个相册的详情，提取第一张照片作为封面
		// Promise.all 可以同时发起请求，速度很快
		albums = await Promise.all(
			albums.map(async (album) => {
				try {
					// 只有当封面为空时，才去尝试获取
					if (!album.cover_url) {
						const detailRes = await fetch(`${API_BASE}/albums/${album.id}`);
						if (detailRes.ok) {
							const detail = await detailRes.json();
							// 如果相册里有照片，取第一张的 url
							if (detail.photos && detail.photos.length > 0) {
								return { ...album, cover_url: detail.photos[0].url };
							}
						}
					}
				} catch (err) {
					console.warn(`无法获取相册 ${album.id} 的封面`, err);
				}
				// 如果获取失败或没有照片，返回原始对象
				return album;
			}),
		);

		console.log("API返回相册数据(已修复封面):", albums); // 调试日志
		timelineGroups = groupAlbumsByTimeline(albums);
	} catch (e) {
		console.error(e);
		error = "加载相册失败，请稍后再试...";
	} finally {
		loading = false;
	}
});

function groupAlbumsByTimeline(albums: Album[]): TimelineGroup[] {
	const groups: Record<number, Record<string, Album[]>> = {};

	albums.forEach((album) => {
		const date = new Date(album.album_date * 1000);
		const year = date.getFullYear();
		const dateKey = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

		if (!groups[year]) groups[year] = {};
		if (!groups[year][dateKey]) groups[year][dateKey] = [];
		groups[year][dateKey].push(album);
	});

	return Object.keys(groups)
		.map(Number)
		.sort((a, b) => b - a)
		.map((year) => {
			const dateItems = Object.keys(groups[year])
				.sort((a, b) => b.localeCompare(a))
				.map((dateStr) => ({
					dateStr,
					fullDate: new Date(groups[year][dateStr][0].album_date * 1000),
					albums: groups[year][dateStr],
				}));
			return { year, items: dateItems };
		});
}

// 图片加载失败处理
function handleImageError(e: Event) {
	console.warn("图片加载失败:", (e.target as HTMLImageElement).src);
	const target = e.currentTarget as HTMLImageElement;
	// 隐藏破损图片，显示父级背景
	target.style.opacity = "0";
}
</script>

<div class="w-full min-h-[50vh]">
    {#if loading}
        <div class="animate-pulse space-y-8 p-4">
            {#each Array(3) as _}
                <div class="flex gap-4">
                    <div class="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div class="flex-1 h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>
            {/each}
        </div>
    {:else if error}
        <div class="text-center py-20 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-2xl">
            <Icon icon="material-symbols:error-outline" class="text-4xl mx-auto mb-2" />
            <p>{error}</p>
        </div>
    {:else if timelineGroups.length === 0}
        <div class="text-center py-20 text-gray-400">
            <Icon icon="material-symbols:photo-library-outline" class="text-5xl mx-auto mb-3 opacity-50" />
            <p>暂时还没有相册哦 ~</p>
        </div>
    {:else}
        <div class="mb-8 mx-0 md:mx-2 p-4 bg-amber-50 dark:bg-orange-900/10 border border-amber-100 dark:border-orange-900/20 rounded-xl flex items-start gap-3 text-sm text-amber-700 dark:text-orange-200/80 leading-relaxed shadow-sm" transition:fade>
            <Icon icon="material-symbols:warning-rounded" class="text-xl shrink-0 mt-0.5 text-amber-500 dark:text-orange-400" />
            <div>
                <p>该板块包含大量图片，如果您在使用移动网络请注意流量费用。</p>
                <p>部分未经压缩的图片体积较大，加载较慢请耐心等待。</p>
                <p>建议使用中国大陆以外的网络节点以加速访问，建议使用PC访问。</p>
            </div>
        </div>
        <div class="relative pl-6 md:pl-10" transition:fade>
            <div class="absolute left-[11px] md:left-[19px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

            {#each timelineGroups as group}
                <div class="relative mb-12">
                    <div class="relative z-10 mb-6 flex items-center">
                        <div class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 pr-4 py-1 rounded-lg">
                            {group.year}
                        </div>
                    </div>

                    <div class="space-y-10">
                        {#each group.items as item}
                            <div class="relative flex flex-col md:flex-row gap-6 group/item">
                            <div class="md:w-15 shrink-0 flex md:flex-col items-start md:items-end pt-1 gap-3 md:gap-1">
                                    <div class="absolute -left-[18px] md:-left-[26px] top-2.5 w-3 h-3 rounded-full bg-[var(--primary)] ring-4 ring-[var(--card-bg)] z-10"></div>
                                    
                                    <div class="ml-8 md:ml-0 flex flex-col md:items-end">
                                        <span class="text-lg font-bold text-gray-800 dark:text-gray-200 leading-none">{item.dateStr}</span>
                                        <span class="text-xs text-gray-400 mt-1">{item.fullDate.toLocaleDateString('zh-CN', { weekday: 'long' })}</span>
                                    </div>
                            </div>

                                <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 ml-8 md:ml-0">
                                    {#each item.albums as album}
                                        <a href={`/gallery/detail/?id=${album.id}`} class="block group/card">
                                            <div class="card-base overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-white dark:bg-[#2a2a2a]">
                                                <div class="aspect-[16/10] w-full overflow-hidden relative bg-gray-200 dark:bg-gray-800">
                                                    {#if album.cover_url}
                                                        <img 
                                                            src={album.cover_url} 
                                                            alt={album.title}
                                                            class="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                                                            loading="lazy"
                                                            on:error={handleImageError}
                                                        />
                                                    {:else}
                                                        <div class="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                                            <Icon icon="material-symbols:image-not-supported" class="text-4xl" />
                                                            <span class="text-xs">暂无封面</span>
                                                        </div>
                                                    {/if}
                                                    <div class="absolute inset-0 bg-black/0 group-hover/card:bg-black/10 transition-colors"></div>
                                                </div>
                                                
                                                <div class="p-4">
                                                    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 group-hover/card:text-[var(--primary)] transition-colors">
                                                        {album.title}
                                                    </h3>
                                                    {#if album.description}
                                                        <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                            {album.description}
                                                        </p>
                                                    {/if}
                                                </div>
                                            </div>
                                        </a>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>