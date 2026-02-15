<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";

// 接收来自 Astro 的静态数据
export let postCount: number;
export let wordCountStr: string;
export let lastUpdatedTime: number;

export let className = "";
export let style = "";

// === ⚙️ 配置区域 ===
const SITE_START_DATE = "2026-02-12"; // 你的建站日期
const API_BASE = "https://comment.blog.ybjun.com"; // 你的 Worker 地址

// === 📊 状态变量 ===
let runDays = 0;
let lastUpdateStr = "";

// 流量数据 (默认显示占位符)
let sitePV = "--";
let siteUV = "--";

onMount(async () => {
	// 1. 计算已运行时间
	const start = new Date(SITE_START_DATE).getTime();
	const now = new Date().getTime();
	const diff = now - start;
	runDays = Math.floor(diff / (1000 * 60 * 60 * 24));

	// 2. 计算"最后更新"的相对时间
	lastUpdateStr = timeAgo(lastUpdatedTime);

	// 3. 与后端 Worker 交互 (获取 PV/UV)
	try {
		// A. 上报一次访问 (增加 PV/UV)
		await fetch(`${API_BASE}/site/visit`, { method: "POST" });

		// B. 获取最新统计数据
		const res = await fetch(`${API_BASE}/site/stats`);
		if (res.ok) {
			const data = await res.json();
			sitePV = data.site_pv?.toString() || "0";
			siteUV = data.site_uv?.toString() || "0";
		}
	} catch (e) {
		console.error("统计服务连接失败:", e);
		sitePV = "Err";
		siteUV = "Err";
	}
});

// 相对时间计算函数
function timeAgo(timestamp: number) {
	if (!timestamp) return "未知";
	const now = Date.now();
	const diff = (now - timestamp) / 1000; // 秒

	if (diff < 60) return "刚刚";
	if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
	if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
	if (diff < 31536000) return `${Math.floor(diff / 2592000)} 个月前`;
	return `${Math.floor(diff / 31536000)} 年前`;
}
</script>

<div class={"card-base p-4 ${className}"} style={`style`}>
  <div class="font-bold mb-4 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
    <div class="w-1 h-4 rounded-md bg-[var(--primary)]"></div>
    <span>站点数据</span>
  </div>

  <div class="grid grid-cols-2 gap-3">

    <div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 transition-colors text-blue-500 bg-blue-50 dark:bg-blue-500/10">
        <Icon icon="material-symbols:article-outline" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0">
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight">{postCount}</div>
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">文章数目</div>
      </div>
    </div>

    <div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 transition-colors text-green-500 bg-green-50 dark:bg-green-500/10">
        <Icon icon="material-symbols:timer-outline" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0">
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight">
          {runDays} <span class="text-[10px] font-normal opacity-70">天</span>
        </div>
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">已运行</div>
      </div>
    </div>

    <div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 transition-colors text-orange-500 bg-orange-50 dark:bg-orange-500/10">
        <Icon icon="material-symbols:edit-note" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0">
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight">{wordCountStr}</div>
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">总字数</div>
      </div>
    </div>

    <div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 transition-colors text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10">
        <Icon icon="material-symbols:person-outline" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0">
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight">{siteUV}</div>
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">本站访客数</div>
      </div>
    </div>

    <div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 transition-colors text-red-500 bg-red-50 dark:bg-red-500/10">
        <Icon icon="material-symbols:visibility-outline" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0">
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight">{sitePV}</div>
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">总访问量</div>
      </div>
    </div>

    <div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 transition-colors text-purple-500 bg-purple-50 dark:bg-purple-500/10">
        <Icon icon="material-symbols:update" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0">
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight">{lastUpdateStr}</div>
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">最后更新</div>
      </div>
    </div>

  </div>
</div>