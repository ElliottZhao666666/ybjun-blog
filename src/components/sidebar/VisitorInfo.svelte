<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import { UAParser } from "ua-parser-js";

  export let className = "";
  export let style = "";

  // === 配置 ===
  const INFO_API = "https://info.blog.ybjun.com"; // 你的 Info Worker 地址

  // === 状态变量 ===
  let loading = true;
  let greeting = "你好！";
  let info = {
  os: "...",
  browser: "...",
  ip: "...",
  location: "...",
  isp: "...",
  ping: 0,
  pingColor: "text-green-500",
  };

  onMount(async () => {
  // 1. 设置问候语
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) greeting = "上午好！";
	else if (hour >= 12 && hour < 18) greeting = "下午好！";
	else if (hour >= 18 && hour < 22) greeting = "晚上好！";
	else greeting = "夜深了";

	// 2. 解析本地环境 (OS & Browser)
	const parser = new UAParser();
	const result = parser.getResult();
	let osName = result.os.name || "Unknown";
	let osVersion = result.os.version || "";
	// 如果检测出是 Windows 10，尝试进一步区分
	if (osName === "Windows" && osVersion === "10") {
    // 默认兜底显示
    osVersion = "10/11";

    // 尝试使用 Client Hints 获取真实版本
    // @ts-expect-error
    if (navigator.userAgentData) {
    try {
    // @ts-expect-error
    const ua = await navigator.userAgentData.getHighEntropyValues([
    "platformVersion",
    ]);
    const major = Number.parseInt(ua.platformVersion.split(".")[0]);
    if (major >= 13) {
    osVersion = "11";
    } else {
    osVersion = "10";
    }
    } catch (e) {
    // 忽略错误
    }
    }
    }

    info.os = `${osName} ${osVersion}`;
    info.browser = `${result.browser.name || "Unknown"} ${result.browser.version?.split(".")[0] + "." + result.browser.version?.split(".")[1] || ""}`;

    // 3. 请求 Worker 获取网络信息 & 测速
  try {
  const start = performance.now();
  const res = await fetch(INFO_API);
  const end = performance.now();

  // 计算 Ping
  info.ping = Math.round(end - start);
  if (info.ping > 100) info.pingColor = "text-yellow-500";
  if (info.ping > 300) info.pingColor = "text-red-500";

  if (res.ok) {
  const data = await res.json();
  info.ip = data.ip || "未知 IP";
  // 组合显示：IP (城市)
  const cityLoc = data.city ? `(${data.city})` : "";
  info.location = `${data.ip} ${cityLoc}`;
  info.isp = data.isp || "未知网络";
  }
  } catch (e) {
  console.error("访客信息获取失败", e);
  info.location = "数据获取失败";
  info.isp = "连接超时";
  } finally {
  loading = false;
  }
  });
</script>

<div class={"card-base p-4 ${className}"} style={`style`}>
  <div class="font-bold mb-4 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
    <div class="w-1 h-4 rounded-md bg-[var(--primary)]"></div>
    <span>{greeting}</span>
    <span class="text-xs font-normal text-neutral-400 ml-auto">欢迎访问</span>
  </div>

  <div class="flex flex-col gap-3">

    <div class="flex items-center gap-3 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-700/30 transition-all duration-300 hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 text-blue-500 bg-blue-50 dark:bg-blue-500/10">
        <Icon icon="material-symbols:laptop-mac-outline" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0 flex-1">
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">操作系统</div>
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight mt-0.5 cursor-help" title="{info.os}">
          {info.os}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-700/30 transition-all duration-300 hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 text-orange-500 bg-orange-50 dark:bg-orange-500/10">
        <Icon icon="material-symbols:chrome-reader-mode-outline" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0 flex-1">
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">浏览器</div>
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight mt-0.5 cursor-help" title="{info.browser}">
          {info.browser}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-700/30 transition-all duration-300 hover:bg-neutral-100 hover:dark:bg-neutral-800">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 text-purple-500 bg-purple-50 dark:bg-purple-500/10">
        <Icon icon="material-symbols:location-on-outline" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0 flex-1">
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">您的IP</div>
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight mt-0.5 cursor-help" title="{info.location}">
          {info.location}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-700/30 transition-all duration-300 hover:bg-neutral-100 hover:dark:bg-neutral-800 border-none">
      <div class="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0 text-green-500 bg-green-50 dark:bg-green-500/10">
        <Icon icon="material-symbols:wifi" />
      </div>
      <div class="flex flex-col justify-center overflow-hidden min-w-0 flex-1">
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">网络接入</div>
        <div class="font-bold text-neutral-900 dark:text-neutral-100 text-sm truncate leading-tight mt-0.5 flex items-center justify-between w-full">
          <span class="truncate max-w-[8rem] cursor-help" title="{info.isp}">{info.isp}</span>
          <span class={"text-[10px] font-mono ${info.pingColor} bg-neutral-100 dark:bg-neutral-800 px-1.5 rounded"}>
            {loading ? '...' : `${info.ping}ms`}
          </span>
        </div>
      </div>
    </div>

  </div>

  <div class="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-700/50 text-[10px] text-center text-neutral-400">
    * 信息仅在本地展示，不涉及隐私存储
  </div>
</div>