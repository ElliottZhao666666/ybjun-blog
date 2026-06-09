---
title: 大幅提升！基于 CF 全家桶的博客国内提速与恶意反代防御全记录
published: '2026-06-09'
description: >-
  本文详细记录了基于 Astro 框架的博客在 CF 全家桶及国内环境下的进一步提速过程。从防范恶意反代镜像的黑帽 SEO，到边缘流式透传背景图、彻底剥离公共
  CDN 字体实现本地异步加载，再到关闭 HTTP/3 规避 UDP QoS 限速与解绑 Loading 动画，最终实现 DOM
  加载时间大幅缩短的优化全过程。
author: ''
cover: ''
pinned: false
tags:
  - 建站
  - 网络
category: 技术备忘
encrypted: false
draft: true
---

建站容易，优化不易。之前为了提升本站（基于 Astro + Svelte 构建，采用 Twilight 框架，属于类 Fuwari，结构比较重型）在国内的访问体验，博主特意给 Cloudflare 全家桶做了国内优选 IP。虽然在 ITDog 上测速一片青葱，看着非常唬人，**但实际在国内真实网络环境下访问时，博客加载依然需要很长时间**，有时候全屏的 Loading 动画甚至要转两到三分钟。

究竟是怎么回事？结合 Edge DevTools 的网络日志分析，博主意识到单纯的“网络线路优选”已经到了瓶颈，**真正的“性能杀手”可能藏在前端代码库的加载逻辑里**。下面，就是博主大刀阔斧对前端代码库进行分析、拆解和改造的全纪录。

## 1 恶意 SEO 镜像站防御

在着手优化速度之前，博主先发现了一个极其恶心但又及其搞笑的 SEO 问题。

### 1.1 遭遇“赛博缝合怪”

在例行检查 Bing Webmaster Tools (BWT) 的“反向链接”时，博主发现博客多出了大量来自` zhutiblog.com` 的反链。它甚至为我们贴心地创建了三级域 `ybjun.zhutiblog.com`，并极其拙劣地将本站部分链接给拼接了过去，例如 `http://ybjun.zhutiblog.com/com/posts/how-to-choose-tld`（多拼了一个子路径 `/com/`，盲猜是采集脚本的正则匹配失误，实在是太草台班子了）。
![img_1781006521121.png](./img_1781006521121.png)
直接在浏览器中打开这些页面可以看到，他疑似直接暴力扒取了本站 HTML 的纯文本，连基本的页面排版都没有保留。经过深度追踪，**这是一种典型的恶意镜像（自动采集建站）事件**。攻击者利用劣质的爬虫或反代技术实时克隆了本站的内容，试图建立内容农场，以此窃取博客的内容与搜索引擎权重。
![img_1781006911956.png](./img_1781006911956.png)

### 1.2 解决步骤 1：动态 Canonical URL 固权

这是对抗镜像站最釜底抽薪的一招。在 SEO 的权重规则中，规避重复内容是核心原则。即使对方通过反代篡改了域名，或者像这次一样暴力扒走了纯文本，只要我们 HTML `<head>` 中的**规范链接（Canonical URL）** 仍然指向原创站点，搜索引擎就会把该页面的所有权重全部分配给主站，镜像站最终只会沦为白干活的“无用索引”。

博主在 Astro 全局组件（如 Layout.astro）的 `<head>` 早期注入了动态生成逻辑。由于它是直接读取 `astro.config.mjs` 中的主站 `site` 域名配置，从根本上杜绝镜像站继承自身域名的可能性：

```javascript
// \src\layouts\base.astro
// Canonical URL：始终基于 astro.config.mjs 中配置的主站 site 生成，避免镜像站继承自身域名。
const canonicalURL = new URL(Astro.url.pathname, Astro.site).toString();
```

```html
// \src\layouts\base.astro
<head>
	<!-- 头部信息都改成规范链接 -->
  <link rel="canonical" href={canonicalURL} />
	<meta property="og:url" content={canonicalURL}>
</head>
```

### 1.3 解决步骤 2：Base64 混淆域名 + 前端异步反弹

反代镜像通常会用简单的正则表达式（如 `body.replace(/ybjun\.com/g, 'mirror.com')`）来暴力篡改 HTML 里的域名。为了防止我们的防御脚本被无脑替换，博主在 `<head>` 的最顶端注入了一段**基于 Base64 混淆的强力反弹脚本**。

它不仅巧妙避开了明文正则扫描，还完美兼容了 Cloudflare Pages 的 .pages.dev 分支预览环境、本地开发环境，以及博主的其他合法子域。只要这段代码位于 `<meta charset>` 和 `<title>` 之后，浏览器在遇到未授权域名时，甚至来不及加载庞大的 CSS 和图片资源，就会瞬间将用户（或支持 JS 渲染的爬虫）强行“弹”回 `www.ybjun.com`。

```html
// \src\layouts\base.astro
    <head>
        <meta charset="UTF-8" />
				<script is:inline>
						(() => {
								// 确保仅在客户端浏览器环境中执行，避免 Astro SSR 构建报错
								if (typeof window === "undefined") return;

								// Base64 解码函数，混淆域名以躲避静态正则替换爬虫
								const decodeHost = (value) => atob(value);
        
								const mainDomain = decodeHost("eWJqdW4uY29t"); // ybjun.com
								const pagesDomain = decodeHost("eWJqdW4tYmxvZy1kdm0ucGFnZXMuZGV2"); // ybjun-blog-dvm.pages.dev
        
								// 精确匹配的白名单
								const allowedHosts = new Set([
										mainDomain,
										decodeHost("d3d3LnlianVuLmNvbQ=="), // www.ybjun.com
										decodeHost("MTI3LjAuMC4x"),         // 127.0.0.1
										decodeHost("bG9jYWxob3N0"),         // localhost
										decodeHost("*****************"),         // 放入其他需要加入白名单的域名 Base64
								]);

								const host = window.location.hostname.toLowerCase();
        
								// 动态校验机制
								// 1. 允许所有合法的子域 (例如 dailywall.ybjun.com, lrc.ybjun.com)
								const isAllowedSubdomain = host.endsWith("." + mainDomain);
								// 2. 严格允许 Cloudflare Pages 分支预览环境 (例如 dev.ybjun-blog-dvm.pages.dev)
								const isAllowedPagesPreview = new RegExp(`^.+\\.${pagesDomain.replace(/\./g, '\\.')}$`).test(host) || host === pagesDomain;

								// 核心防御逻辑：如果当前域名不符合任何白名单规则，则触发重定向
								if (!allowedHosts.has(host) && !isAllowedSubdomain && !isAllowedPagesPreview) {
										// 使用 window.location.replace 避免污染用户的浏览器历史记录
										window.location.replace(
												"https://www." + mainDomain + window.location.pathname + window.location.search + window.location.hash
										);
								}
						})();
				</script>
    <head>
```

### 1.4 总结

动态 Canonical URL 确保了无论代码被复制到哪里，搜索引擎收录的“唯一真神”永远是主站。Base64 混淆反弹脚本 拦截了绝大部分依赖浏览器渲染的高级反代镜像，同时保护了 Cloudflare Pages 带宽不被恶意盗刷。

这种依靠大量垃圾内容拼接的所谓“AI导航系统”，由于排版混乱且缺乏实际价值，其生命周期往往极短，很快就会被 Google 和 Bing 的算法自动 K 站。将其防御妥当后，我们终于可以安心地继续推进博客的极致速度优化了。
![img_1781008912596.png](./img_1781008912596.png)

## 2 把必应每日一图作为背景图

### 2.1 问题和痛点

本站原本采用了多张博主精选的高清必应美图作为幻灯片轮播背景。这些图片存放在前端的本地仓库中，虽然已经通过 WebP 格式压缩到了 1M 以内，但在使用 CF 全家桶且未经国内分发的情况下，**动辄数十 MB 的初始图片请求会瞬间挤占首屏带宽，极易产生严重阻塞**。
![img_1781014084244.png](./img_1781014084244.png)

除此之外，多张背景图的幻灯片播放采用 Ken Burns 效果，也会造成极大的性能开销，拖慢加载速度，但关闭后幻灯片过渡会及其生硬，很难看。所以博主认为，有必要动代码了，大幅修改整个背景图片加载机制。
![img_1781014694642.png](./img_1781014694642.png)

至于如何精简，博主第一时间就想到了建站前的最初想法——**使用必应每日一图作为博客背景**，这样既可以在加载时避免幻灯片形式的网络资源和性能开销，还能确保每天有变化。之所以一开始建站时没这么做，是因为博主看到 Twilight 主题框架默认的背景加载机制本身很不错，并且似乎只支持网站本地的照片，所以就沿用原始框架采用精选图片幻灯片播放了。

### 2.2 必应今日美图边缘流式透传 API

众所周知，这个博客并非博主上线的第一个网站。真正的第一个网站应该是[胖哥必应美图库（dailywall.ybjun.com）](https://dailywall.ybjun.com/)。这也是个 CF 全家桶站点，使用 R2 存储桶储存每日图片，使用 Workers 作为 API 和核心处理层。
![img_1781015220712.png](./img_1781015220712.png)

所以，博主决定在这个 Worker 上做改造，使其新增一个能够直接返回当日壁纸图的 API 分支，并且**使用流式透传**，而非直接重定向到 R2 存储桶中对应的图片链接：
```javascript
// worker.js
async fetch(request, env, ctx) {
  try {
    // === 路由分发 (此处省略其它路由分支) ===
    // === 获取最新壁纸图片直链 (流式透传，直接返回图片本体) ===
    if (path.startsWith('/image/latest')) {
      const { results } = await env.DB.prepare(
        "SELECT * FROM wallpapers ORDER BY enddate DESC LIMIT 1"
      ).run();
      
      if (!results[0]) {
        return errorResponse("No wallpaper found", 404, origin);
      }
      
      const dbInfo = results[0];
      let targetUrl = dbInfo.pic_url_1080; // 默认获取 PC 横屏
      
      if (path === '/image/latest/v') {
        targetUrl = dbInfo.pic_url_1920; // 手机竖屏
      } else if (path === '/image/latest/uhd') {
        targetUrl = dbInfo.pic_url_uhd;  // 4K
      }
      
      // 关键 1：从数据库记录的 URL 中提取出 R2 存储桶里的真实文件名
      const fileName = targetUrl.split('/').pop();
      
      // 关键 2：通过绑定的 MY_BUCKET 直接走内网去拿图片对象
      const object = await env.MY_BUCKET.get(fileName);
      
      if (!object) {
        return errorResponse("Image file not found in R2 bucket", 404, origin);
      }
      
      // 关键 3：组装响应头，继承 R2 的元数据，并注入 CORS 和缓存控制
      const headers = new Headers({
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=7200", // 浏览器缓存 2 小时
        "ETag": object.httpEtag, // 帮助浏览器做 304 缓存协商
        ...getCorsHeaders(origin) // 注入跨域头，通杀所有预览分支
      });

      // 关键 4：直接将 R2 的 ReadableStream (object.body) 返回给前端
      return new Response(object.body, {
        status: 200,
        headers: headers
      });
    }
	}
}
```

这样，当访问`api域名/image/latest`时，Worker 会直接从 D1 壁纸数据库中查到 R2 存储桶中今天壁纸的`1920x1080`尺寸的原图链接，并直接将这个链接的图片原始数据返回。`api域名/image/latest/v`同理，只不过返回的是`1920x1080`尺寸的竖屏原图。

:::warning
**不建议在这里使用 302 直接跳转到直接获取的原图链接**，因为实际应用到网站中时，可能会触发 CF 的防盗链机制，导致一切正常，甚至不报错，就是无法获取图片。**实际上被 CF 无情地 403 了**。
:::

至此，API 已经准备好了，接下来，我们就把

### 2.3 代码库新增必应每日一图逻辑与无缝 Fallback

在前端代码（例如 `fullscreenWallpaper.astro` 和 `banner.astro`）中，博主将背景图片路径指向了自建的新 API，同时利用原生 `onerror` 属性植入了平滑的 fallback 逻辑。一旦 API 请求失败或网络异常，浏览器会自动回退到极小体积的默认图片，旧逻辑得以完美兜底，且前端渲染层毫无感知。

以下是 `fullscreenWallpaper.astro` 中的关键改造实现：

```
---
// 配置云端 API 资源地址与本地 Fallback 兜底图片地址
const dailyWallSources = {
    desktop: ["[https://api.bingpics.ybjun.com/image/latest](https://api.bingpics.ybjun.com/image/latest)"],
    mobile: ["[https://api.bingpics.ybjun.com/image/latest/v](https://api.bingpics.ybjun.com/image/latest/v)"],
};

const dailyWallFallback = {
    desktop: "/assets/images/wallpaper_fallback/desktopWallpaper_fallback.webp",
    mobile: "/assets/images/wallpaper_fallback/mobileWallpaper_fallback.webp",
};
---

<!-- 桌面端壁纸渲染逻辑 -->
<img
    src={dailyWallSources.desktop[0]}
    alt="Desktop Wallpaper"
    class="hidden md:block w-full h-full object-cover transition-opacity duration-700"
    data-original-src={dailyWallSources.desktop[0]}
    onerror={`
        console.error('[DailyWall] image error', {label: 'fullscreen-desktop-daily-wall', fallbackSrc: '${dailyWallFallback.desktop}'});
        // 检测是否已经应用过 Fallback，避免死循环
        if (!this.hasAttribute('data-fallback-applied')) {
            this.setAttribute('data-fallback-applied', 'true');
            this.src = '${dailyWallFallback.desktop}';
        }
    `}
/>
```

通过这一层修改，原本阻塞的本地多图加载被替换为轻量级 API 驱动，且具有极高的容错性。