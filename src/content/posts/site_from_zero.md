---
title: 无服务器，CF全托管，从零开始的建站全流程
published: 2026-02-12
description: "本文档详细记录了“胖哥必应美图库”网站从需求分析、架构设计到最终部署上线的全过程。本项目采用完全的Serverless架构，利用 Cloudflare 全家桶实现了低成本、高可用、免运维的现代化网站构建。"
pinned: false
tags: ["网络","计算机"]
category: 技术备忘
draft: false
---

# 

本文档详细记录了“胖哥必应美图库”网站从需求分析、架构设计到最终部署上线的全过程。本项目采用完全的 **Serverless（无服务器）** 架构，利用 Cloudflare 全家桶（Pages, Workers, D1, R2）实现了低成本、高可用、免运维的现代化网站构建。

## 1. 总述

### 1.1 主要需求

本项目旨在构建一个自动化采集、展示和下载微软必应（Bing）每日壁纸的网站。

**核心功能需求**：

1. **后端自动化采集**：
   - 每天凌晨自动访问必应官网接口。
   - 获取当日壁纸的高清图片及元数据（标题、作者、版权链接等）。
   - 解析并下载 4 种不同尺寸（4K 原图 `UHD`、桌面 `1920x1200`、桌面 `1920x1080`、手机竖屏 `1080x1920`）的图片资源。
   - 将图片转存至自建对象存储，将元数据存入数据库。
2. **前端展示与交互**：
   - **首页**：沉浸式首屏展示今日壁纸（带飞入动画的信息卡片），下方提供“最新壁纸”和“热门壁纸”两个维度的瀑布流列表。
   - **详情页**：展示壁纸详细信息，提供多尺寸下载，支持横竖屏预览切换，并自动记录浏览量。
   - **历史回溯**：瀑布流展示所有历史壁纸，支持无限加载（Load More）。
   - **随机探索**：全屏沉浸式随机展示一张库中壁纸，支持“上一张/下一张”浏览历史栈。
   - **搜索功能**：支持按标题、描述、作者模糊搜索壁纸。
3. **UI/UX 设计**：
   - **风格**：全站采用 **毛玻璃（Glassmorphism）** 拟态风格，界面通透现代。
   - **动态背景**：全局背景随当前鼠标悬停或选中的壁纸实时切换，并应用高斯模糊效果。
   - **响应式**：完美适配 PC 端宽屏与移动端竖屏，包括顶栏的自动收纳和图片的自适应加载。

### 1.2 整体架构

本项目放弃了传统的 VPS（服务器）架构，完全基于 **Cloudflare Serverless** 生态构建：

- **前端托管**：Cloudflare Pages (托管 Vue 3 生成的静态 HTML/CSS/JS 文件)。
- **计算/API**：Cloudflare Workers (运行 JavaScript 代码，作为 API 网关和定时任务调度器)。
- **数据库**：Cloudflare D1 (基于 SQLite 的边缘 SQL 数据库，存储元数据)。
- **文件存储**：Cloudflare R2 (兼容 S3 的对象存储，存储壁纸图片文件)。

### 1.3 无服务器建站与有服务器建站的区别

如果我们要将这个项目部署在传统的 **VPS (Virtual Private Server，如阿里云 ECS、腾讯云 CVM)** 上，操作流程会有巨大差异。

| 特性         | **无服务器 (Cloudflare Serverless)**                         | **有服务器 (传统 VPS)**                                      |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **基础设施** | **无需管理**。代码直接上传到边缘节点运行，像“寄生”在云端一样。 | **需全权管理**。你需要购买一台 Linux 服务器，SSH 登录，安装 OS 更新。 |
| **环境配置** | 开箱即用 (Node.js/V8 环境已就绪)。                           | **手动配置**。需安装 Nginx (Web服务器), MySQL/SQLite (数据库), Python/Node (运行时), 配置防火墙 (iptables/UFW)。 |
| **后端实现** | 上传一个 `worker.js` 文件即可。                              | 需编写 Python (Flask/Django) 或 Node (Express) 服务，并使用 `Systemd` 或 `PM2` 守护进程让其后台常驻。 |
| **定时任务** | 在 CF 控制台设置 Cron Triggers。                             | 需在 Linux 系统中使用 `crontab -e` 编写定时脚本命令。        |
| **HTTPS**    | 自动配置，免费赠送。                                         | 需手动申请 SSL 证书 (如 Let's Encrypt)，并配置 Nginx 开启 443 端口。 |
| **运维成本** | **极低**。不用担心服务器宕机、磁盘写满。                     | **高**。需监控 CPU/内存/磁盘，定期备份数据库，防范黑客扫描端口。 |
| **网络**     | 全球 Anycast 加速，就近访问。                                | 取决于机房物理位置（如北京），跨国访问慢，需额外购买 CDN。   |

### 1.4 域名列表

本项目涉及的自定义域名如下（均解析至 Cloudflare）：

1. **前端主站域名**: `dailywall.ybjun.com`
   - **用途**：用户访问的网站入口，绑定在 Cloudflare Pages。
2. **API 服务域名**: `api.bingpcs.ybjun.com`
   - **用途**：后端接口地址，绑定在 Cloudflare Workers。
   - **原因**：Worker 默认的 `*.workers.dev` 域名在中国大陆被阻断，绑定自定义域名可绕过此限制，实现国内直连访问。
3. **图床资源域名**: `bingpics.ybjun.com`
   - **用途**：R2 存储桶的公开访问链接，用于加载图片资源。

## 2. 后端构建

### 2.1 Cloudflare D1 后端数据库及其构建过程

D1 是 Cloudflare 提供的原生 Serverless SQL 数据库，本质是分布式的 SQLite。

**构建步骤**：

1. 在 CF 控制台 -> Workers & Pages -> D1 中创建数据库 `bing-wallpaper-db`。
2. 进入 Console，执行建表语句：

```
CREATE TABLE IF NOT EXISTS wallpapers (
    enddate TEXT PRIMARY KEY,  -- 日期作为主键 (YYYYMMDD)，防止同一天重复插入
    urlbase TEXT,              -- Bing 原始路径 ID
    title TEXT,                -- 标题
    description TEXT,          -- 描述
    author TEXT,               -- 作者
    copyrightlink TEXT,        -- 版权链接
    wp BOOLEAN,                -- 是否可做壁纸
    pic_url_uhd TEXT,          -- 4K 原图链接
    pic_url_1200 TEXT,         -- 1920x1200 链接
    pic_url_1080 TEXT,         -- 1920x1080 链接
    pic_url_1920 TEXT,         -- 1080x1920 竖屏链接
    views INTEGER DEFAULT 0,   -- 浏览量 (默认0)
    downloads INTEGER DEFAULT 0, -- 下载量 (默认0)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**常用 SQL 维护指令 (备忘)**：

- **查询指定日期的条目**：

  ```
  SELECT * FROM wallpapers WHERE enddate = '20260119';
  ```

- **手动修改某项的值**（例如修正标题）：

  ```
  UPDATE wallpapers SET title = '修正后的标题' WHERE enddate = '20260119';
  ```

- **手动添加一条壁纸信息**：

  ```
  INSERT INTO wallpapers (enddate, title, pic_url_uhd) VALUES ('20260120', '测试壁纸', 'https://...');
  ```

- **查询数据库内条目总数**：

  ```
  SELECT COUNT(*) FROM wallpapers;
  ```

- **查询浏览量最高的前 5 张**：

  ```
  SELECT title, views FROM wallpapers ORDER BY views DESC LIMIT 5;
  ```

### 2.2 Cloudflare R2 存储桶及数据初始化

R2 提供了海量的存储空间且**免出口流量费**，非常适合做图床。

**构建步骤**：

1. 创建 Bucket `ybjun-bing-pics`。
2. 在 Settings 中连接自定义域名 `bingpics.ybjun.com`。
3. 允许公开访问。

**数据初始化（Python 脚本）**： 为了将“胖哥每日壁纸”原有系统中的历史数据迁移到新架构，我们编写了一个 Python 脚本。

**数据源形式**：

- **图片文件**：按日期命名的本地图片（如 `20240101_UHD.jpg`）。
- **元数据文件**：`wallpaperinfo.txt`，由原系统导出，每行一条，格式为： `日期|urlbase|标题|描述|作者|版权链接`

**Python 脚本 (`migrate.py`) 逻辑**：

1. **读取** `wallpaperinfo.txt`，解析每一行数据。
2. **遍历**对应的本地图片文件。
3. **生成随机文件名**：为了防止爬虫通过遍历日期盗链，使用 `uuid` 为每张图生成随机后缀（如 `20240101_a1b2c3d4_UHD.jpg`）。
4. **上传 R2**：使用 `boto3` 库将图片上传，并添加 `Cache-Control: public, max-age=31536000` 头（这一步至关重要，它强制 CDN 缓存图片一年，大幅提升国内访问速度）。
5. **生成 SQL**：根据上传后的 R2 链接，拼接出 `INSERT` SQL 语句，打印到控制台，供我们去 D1 执行。

## 3. Workers 构建

### 3.1 Workers 介绍

Cloudflare Workers 是基于 V8 引擎的边缘计算服务。它不是一直运行的服务器，而是**“按需唤醒”的事件处理器**。没有请求时它不占用资源，有请求（或定时触发）时毫秒级启动，处理完立即销毁。

### 3.2 核心作用与需求

本项目只需要**一个** `worker.js` 文件，就承担了传统架构中后端服务 + 定时任务脚本的全部职责：

1. **定时采集器 (Cron Job)**：
   - 每日凌晨自动唤醒。
   - 访问 Bing API，伪装 User-Agent 防止被拦截。
   - 正则提取图片 ID，重构下载链接。
   - 并发下载 4 种尺寸图片，上传 R2（带随机文件名和缓存头）。
   - 将元数据和 R2 链接写入 D1 数据库。
2. **API 网关 (RESTful API)**：
   - 响应前端请求，提供 `/api/latest` (今日), `/api/list` (历史), `/api/search` (搜索), `/api/detail` (详情) 接口。
   - **CORS 处理**：动态允许多个域名（主站 + 本地调试）跨域访问。
   - **Sitemap 生成**：动态生成 `/sitemap.xml` 供搜索引擎抓取。
   - **统计功能**：处理下载计数埋点。

### 3.3 Workers 配置全流程

1. 创建 Worker `bing-wallpaper-station`。
2. **绑定资源 (Settings -> Variables)**：
   - `DB`: 绑定 D1 数据库 `bing-wallpaper-db`。
   - `MY_BUCKET`: 绑定 R2 存储桶 `ybjun-bing-pics`。
3. **配置触发器 (Triggers)**：
   - **Cron**: 设置为 `2 16 * * *` (UTC 16:02，即北京时间次日 **0:02**)。*注：曾尝试过 0:22 等时间，最终选定 0:02 避开 Bing 0点缓存更新延迟。*
   - **Custom Domain**: 绑定 `api.bingpcs.ybjun.com`。

### 3.4 Worker.js 代码构建 (完整版)

```
// ================= 配置区域 =================
const ALLOWED_ORIGINS = [
    "[https://dailywall.ybjun.com](https://dailywall.ybjun.com)", // 主站
    "http://localhost:5173",       // 本地调试
    "[http://127.0.0.1:5173](http://127.0.0.1:5173)"
];
const R2_DOMAIN = "[https://bingpics.ybjun.com](https://bingpics.ybjun.com)"; 
const SIZES = { uhd: 'UHD', w1200: '1920x1200', w1080: '1920x1080', mobile: '1080x1920' };

export default {
  // === 模块 1: 定时任务入口 ===
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleSchedule(env));
  },

  // === 模块 2: API 请求入口 ===
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get("Origin"); // 获取请求来源用于CORS

    // 处理 CORS 预检
    if (method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(origin) });
    }

    try {
      // 路由：获取今日壁纸
      if (path === '/api/latest') {
        const { results } = await env.DB.prepare(
          "SELECT * FROM wallpapers ORDER BY enddate DESC LIMIT 1"
        ).run();
        return jsonResponse(results[0], origin);
      }

      // 路由：获取列表 (支持分页和排序)
      if (path === '/api/list') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = 13; // 多取一张用于前端判断逻辑
        const offset = (page - 1) * limit;
        const sort = url.searchParams.get('sort') || 'date';
        
        let query = "SELECT * FROM wallpapers";
        if (sort === 'popular') {
          query += " ORDER BY downloads DESC, views DESC, enddate DESC";
        } else {
          query += " ORDER BY enddate DESC";
        }
        query += " LIMIT ? OFFSET ?";
        
        const { results } = await env.DB.prepare(query).bind(limit, offset).run();
        return jsonResponse(results, origin);
      }

      // 路由：随机壁纸
      if (path === '/api/random') {
        const { results } = await env.DB.prepare("SELECT * FROM wallpapers ORDER BY RANDOM() LIMIT 1").run();
        return jsonResponse(results[0], origin);
      }

      // 路由：搜索
      if (path === '/api/search') {
        const keyword = url.searchParams.get('q');
        if (!keyword) return jsonResponse([], origin);
        const searchStr = `%${keyword}%`;
        const { results } = await env.DB.prepare(
          "SELECT * FROM wallpapers WHERE title LIKE ? OR description LIKE ? OR author LIKE ? ORDER BY enddate DESC"
        ).bind(searchStr, searchStr, searchStr).run();
        return jsonResponse(results, origin);
      }

      // 路由：详情 (浏览量+1)
      if (path === '/api/detail') {
        const date = url.searchParams.get('date');
        if (!date) return errorResponse("Missing date", 400, origin);
        // 异步更新浏览量，不阻塞响应
        ctx.waitUntil(env.DB.prepare("UPDATE wallpapers SET views = views + 1 WHERE enddate = ?").bind(date).run());
        const { results } = await env.DB.prepare("SELECT * FROM wallpapers WHERE enddate = ?").bind(date).run();
        return jsonResponse(results[0], origin);
      }

      // 路由：下载 (下载量+1)
      if (path === '/api/download' && method === 'POST') {
        const date = url.searchParams.get('date');
        if (date) {
           await env.DB.prepare("UPDATE wallpapers SET downloads = downloads + 1 WHERE enddate = ?").bind(date).run();
           return jsonResponse({ status: "ok" }, origin);
        }
        return errorResponse("Missing date", 400, origin);
      }

      // 路由：Sitemap XML 生成
      if (path === '/sitemap.xml') {
        const { results } = await env.DB.prepare("SELECT enddate FROM wallpapers ORDER BY enddate DESC").run();
        const SITE_URL = "[https://dailywall.ybjun.com](https://dailywall.ybjun.com)";
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
        // ... (省略 XML 拼接细节) ...
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      }
      
      return errorResponse("Endpoint not found", 404, origin);
    } catch (e) {
      return errorResponse(e.message, 500, origin);
    }
  }
};

// === 模块 3: 核心采集逻辑 ===
async function handleSchedule(env) {
  // 加时间戳防止缓存
  const bingApi = `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN&_=${Date.now()}`;
  try {
    const resp = await fetch(bingApi, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..." } // 伪装浏览器
    });
    if (!resp.ok) throw new Error(`Bing API Error: ${resp.status}`);
    const data = await resp.json();
    for (const img of data.images) {
        await processImage(img, env);
    }
  } catch (e) { console.error(e); }
}

async function processImage(img, env) {
    const date = img.enddate;
    // 1. 查重
    const { results } = await env.DB.prepare("SELECT * FROM wallpapers WHERE enddate = ?").bind(date).run();
    if (results.length > 0) return;

    // 2. 正则提取 ID (OHR.xxx)
    const idMatch = img.urlbase.match(/id=([^&]+)/);
    const cleanId = idMatch ? idMatch[1] : null;
    
    // 3. 并发下载并上传 R2
    const uploadTasks = []; 
    const urls = {};        
    // ... 遍历 SIZES ...
    for (const item of sizeList) {
        const randomStr = crypto.randomUUID().split('-')[0]; // 生成随机文件名防爬虫
        const fileName = `${date}_${randomStr}_${item.suffix}.jpg`;
        const downloadUrl = `https://www.bing.com/th?id=${cleanId}_${item.suffix}.jpg&pid=hp...`;
        
        // 使用立即执行函数封装 Promise，确保任务真正启动
        const task = (async () => {
             const imgResp = await fetch(downloadUrl, { headers: { ... } }); // 带 Referer 头
             if(imgResp.ok) {
                 await env.MY_BUCKET.put(fileName, imgResp.body, {
                    httpMetadata: { cacheControl: "public, max-age=31536000, immutable" } // 强制缓存
                 });
                 urls[item.key] = `${R2_DOMAIN}/${fileName}`;
             }
        })();
        uploadTasks.push(task);
    }
    await Promise.all(uploadTasks);

    // 4. 入库 (使用 || null 防止 undefined 报错)
    await env.DB.prepare(`INSERT INTO wallpapers ...`).bind(..., urls.pic_url_uhd || null, ...).run();
}

// ... 辅助函数 (jsonResponse, getCorsHeaders) ...
```

### 3.5 Workers 中路由的配置

Worker 本身不使用传统 Web 框架的路由表，而是通过原生 JS 的 `if (path === '...')` 进行逻辑分发。 这种方式虽然原始，但执行效率最高，没有任何框架开销，非常适合 Serverless 环境。

## 4. 前端构建

### 4.1 Vue + Node.js + Tailwind 介绍

- **Node.js**: 前端的运行环境（相当于建筑工地），负责运行构建工具 Vite。
- **npm**: 包管理器（相当于建材市场），用于下载 Vue、Router 等依赖。
- **Vue 3**: **组件化**开发框架。不同于传统 HTML/JS 混写，Vue 将页面拆分为独立的组件（如 `Card.vue`, `TopBar.vue`），数据变了界面自动更新（响应式），无需手动操作 DOM。
- **Tailwind CSS**: **原子化** CSS 框架。直接在 HTML `class` 中写样式（如 `flex justify-center`），不再需要写笨重的 `.css` 文件，开发效率极高。

### 4.2 前端需求整理 (基于设计文档)

- **首页 (Home)**:
  - **Hero 区域**: 满屏展示今日壁纸，鼠标移动唤醒底部信息卡片（带毛玻璃效果），右下角 V 型箭头引导下滑。
  - **双列表**: 分别展示“最新”和“热门”壁纸，卡片采用 16:9 比例，鼠标悬停显示遮罩和详细数据。
  - **背景联动**: 鼠标划过任意壁纸缩略图，全局大背景无缝切换至该图的高斯模糊版本。
- **详情页 (Detail)**:
  - **左右布局**: 左侧大图预览（点击可切换横/竖屏文件），右侧信息与操作。
  - **下载矩阵**: 提供 4K、1080P、1200P、手机版 4 个明确的下载按钮。
  - **导航**: 自动计算前一天/后一天的日期进行跳转。
- **历史页 (History)**: 瀑布流布局，底部“加载更多”按钮实现分页读取。
- **随机心情 (Mood)**: 全屏独占模式，图片按高度自适应，左右大按钮切换，具备浏览历史栈（可回退上一张）。
- **搜索页 (Search)**: 居中超大透明搜索框，输入关键词回车即搜。

### 4.3 基础环境与依赖

**核心依赖说明**：

- `vue`: 核心框架。
- `vue-router`: **大堂经理**，负责管理 URL 与页面组件的对应关系，实现 SPA 无刷新跳转。
- `tailwindcss`: 样式引擎。
- `@vueuse/core`: 一个强大的工具库，我们用它来实现**鼠标空闲检测 (`useIdle`)**、**窗口滚动检测 (`useWindowScroll`)** 和 **响应式窗口尺寸 (`useWindowSize`)**。
- `dayjs`: 轻量级日期处理库，用于计算“前一天/后一天”以及格式化日期显示。
- `axios` / `fetch`: 用于发起 API 请求。

### 4.4 项目文件结构

- `public/_redirects`: Cloudflare Pages 的路由规则文件。
- `src/App.vue`: 根组件，包含全局背景层、顶栏、底栏和 `<router-view>`。
- `src/router/index.js`: 路由定义表。
- `src/stores/appState.js`: 全局状态管理 (Store)，用于在不同组件间共享“当前背景图”和“深色模式”状态。
- `src/views/`: 页面组件 (Home, Detail, History, Mood, Search)。
- `src/components/`: 公共组件 (TopBar)。

### 4.5 重点功能实现逻辑

**A. 全局动态模糊背景 (App.vue)**

```
<!-- 使用 transition 实现背景切换时的丝滑淡入淡出 -->
<transition name="bg-fade">
  <img 
    v-if="appState.currentWallpaper"
    :key="appState.currentWallpaper" 
    :src="appState.currentWallpaper" 
    class="absolute inset-0 w-full h-full object-cover"
  />
</transition>
<!-- 覆盖一层 backdrop-blur 实现模糊效果，无需处理图片本身 -->
<div class="absolute inset-0 backdrop-blur-[30px] bg-white/30 dark:bg-black/40"></div>
```

**B. 首页 Hero 卡片智能显隐 (Home.vue)** 利用 `@vueuse/core` 的 `useIdle` 和 `useWindowScroll`。

- 逻辑：只有当页面在顶部 (`y < 100`) **且** 用户处于活跃状态 (`!idle`) 时，才显示信息卡片；否则显示呼吸灯箭头或隐藏。

```
const { idle } = useIdle(3000)
const { y } = useWindowScroll()
const showHeroControls = computed(() => y.value > 100 ? true : !idle.value)
```

**C. 横竖屏资源自适应 (Home/Detail)** 自动检测屏幕比例，决定加载横版还是竖版图片，节省流量并提升体验。

```
const { width, height } = useWindowSize()
const isLandscape = computed(() => width.value > height.value)

const getWallpaperUrl = (paper) => {
  // 如果是横屏，优先用 1080p 横图；否则用竖图
  return isLandscape.value 
    ? (paper.pic_url_1080 || paper.pic_url_uhd)
    : (paper.pic_url_1920 || paper.pic_url_uhd)
}
```

### 4.6 路由机制深度解析

本项目涉及三层路由，协同工作：

1. **第一层：门卫 (_redirects)**
   - **位置**：Cloudflare Pages 服务器端。
   - **作用**：防止 SPA 刷新 404。配置 `/* /index.html 200`，表示无论用户访问什么路径，服务器都返回 `index.html`，把控制权交给前端。同时配置 `/sitemap.xml` 重定向到 API。
2. **第二层：大堂经理 (Vue Router)**
   - **位置**：用户浏览器端。
   - **作用**：根据 URL（如 `/detail/20260119`）动态替换页面组件 (`<router-view>`)，实现页面切换**无网络请求**，极速响应。
3. **第三层：后厨调度员 (Worker API)**
   - **位置**：Cloudflare Edge 节点。
   - **作用**：根据 API 路径（如 `/api/list`）执行不同的数据库查询逻辑，返回 JSON 数据。

### 4.7 编译和发布

1. 在本地终端执行 `npm run build`，Vite 会将 Vue 代码编译为浏览器可识别的静态文件，输出到 `dist` 目录。
2. 在 Cloudflare Pages 控制台，创建项目，选择 **“上传资产 (Upload Assets)”**。
3. 直接拖入 `dist` 文件夹部署。
4. 绑定自定义域名 `dailywall.ybjun.com`。

## 5. SEO 优化

### 5.1 index.html 优化

Vue 是动态渲染的，但为了让爬虫一眼看到核心信息，我们在 `index.html` 中硬编码了 Meta 标签：

```
<head>
  <title>胖哥必应美图库 - 每日必应壁纸高清下载</title>
  <meta name="description" content="收录微软必应每日高清壁纸，提供4K原图、1080P及手机竖屏壁纸免费下载..." />
  <meta name="keywords" content="必应壁纸, Bing Wallpaper, 4K壁纸, 每日一图" />
  <!-- Open Graph 协议，优化微信/推特分享卡片 -->
  <meta property="og:title" content="胖哥必应美图库" />
  <meta property="og:image" content="[https://bingpics.ybjun.com/icon.png](https://bingpics.ybjun.com/icon.png)" />
</head>
```

### 5.2 网站地图 (Sitemap)

我们实现了**动态 Sitemap**。

- **后端**：Worker 增加 `/sitemap.xml` 接口，查询 D1 所有 ID，拼接成标准 XML 格式返回。
- **前端**：
  - `public/robots.txt` 指明 Sitemap 地址：`Sitemap: https://api.bingpcs.ybjun.com/sitemap.xml`。
  - `public/_redirects` 设置 301 重定向，让主站 `/sitemap.xml` 跳转到 API。

### 5.3 & 5.4 搜索引擎提交

前往 **Google Search Console** 和 **Bing Webmaster Tools**，验证域名所有权（通过 DNS TXT 记录），并提交 Sitemap 地址，加速收录。

## 6. 错误和故障排除 (Troubleshooting)

### 6.1 定时任务 "Success" 但无数据 (核心错误)

- **现象**：Cron 日志显示成功，但 R2 和 D1 均无数据。
- **原因**：**异步执行陷阱**。在早期的 Worker 代码中，我们使用了 `uploadTasks.push(async () => { ... })`。这实际上是将一个**函数定义**推入了数组，而不是**正在执行的 Promise**。`Promise.all` 认为任务已完成瞬间结束，而下载函数根本没来得及跑。
- **解决**：使用立即执行函数 `(async () => { ... })()` 或直接调用封装好的 `download()` 函数，确保将执行中的 Promise 推入数组。

### 6.2 D1 报错 "Type 'undefined' not supported"

- **现象**：Worker 报错，数据库写入失败。
- **原因**：图片下载失败导致链接变量为 `undefined`，JS 将其传给 SQL `bind` 时引发类型错误（SQL 只认 `null`）。
- **解决**：在 `bind` 参数中使用短路逻辑 `urls.pic_url || null`。

### 6.3 图片下载失败 (403 Forbidden)

- **现象**：Worker 运行成功，数据库有记录但链接为 NULL。
- **原因**：Bing 图片服务器拦截了没有 `User-Agent` 的请求（反爬策略）。
- **解决**：在 `fetch` 请求中添加模拟浏览器的 `User-Agent` 和 `Referer` 头。

### 6.4 跨域错误 (CORS)

- **现象**：本地 `localhost` 调试报错 `Blocked by CORS policy`。
- **原因**：Worker 默认只允许线上域名访问。
- **解决**：在 Worker 中获取 `request.headers.get("Origin")`，并根据白名单数组动态设置 `Access-Control-Allow-Origin`。

### 6.5 大陆访问 D1 接口连接失败

- **现象**：前端能打开，但无数据，API 请求超时。
- **原因**：Worker 默认域名 `*.workers.dev` 在国内被阻断。
- **解决**：为 Worker 绑定自定义域名 `api.bingpcs.ybjun.com`，并替换前端所有 API 地址。

## 7. 总结

通过本项目，我们成功构建了一个**高颜值、全自动化、零成本**的壁纸站。从后端的定时抓取、数据清洗，到前端的交互设计、性能优化，再到最后的 SEO 与安全防护，完整实践了现代 **Serverless 全栈开发** 的标准流程。这不仅是一个实用的工具站，更是学习 Cloudflare 生态与 Vue 3 开发的绝佳案例。