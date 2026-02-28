---
title: 拯救收录问题，多种架构网站 SEO 优化踩坑实录
published: '2026-02-28'
description: >-
  记录一次酣畅淋漓的 SEO 优化实战。从纯静态页面的无障碍隐藏技术，到 Vue SPA 架构下的 Edge 边缘渲染劫持，再到 Astro 框架的组件级
  Meta 精准控制，彻底攻克现代前端框架的搜索引擎收录痛点。
author: ''
cover: ''
pinned: false
tags:
  - 网络
  - 计算机
  - 建站
  - SEO
category: 技术备忘
encrypted: false
draft: true
---

建站容易，优化不易。目前笔者一共维护着三个形态各异的网站：

* 月半菌的个人博客 ([www.ybjun.com](https://www.ybjun.com) ，本站)：基于 Astro 构建的 SSG（静态站点生成）项目，使用 [Twilight](https://github.com/Spr-Aachen/Twilight) 主题。
* 必应美图库 ([dailywall.ybjun.com](https://dailywall.ybjun.com))：基于 Vue 3 构建的 SPA（单页应用），后端结合 Cloudflare Workers + D1 数据库，提供动态的必应壁纸获取、交互与下载。
* 歌词大师 ([lrc.ybjun.com](https://dailywall.ybjun.com))：纯原生 HTML5/JS/CSS 构建的本地浏览器单页工具，主打极简 UI 、轻量与前端纯本地处理。

这三个站点全部托管在 Cloudflare 的 Pages + Workers 中。虽然 CF 赋予了网站极高的访问速度和稳定性，但在**进行 SEO 优化**，特别是向 Bing Webmaster Tools (BWT) 和 Google Search Console 提交站点地图时，笔者却收到了各式各样奇葩的报错警告。

经过连续几天的深度排查与外科手术级的部分代码重构，笔者终于将这些痛点一一拔除。在此记录下全过程的踩坑与破局思路，希望能为同样使用现代前端框架建站的朋友们提供一些参考。

## 1 Cloudflare WAF 安全规则“误杀”爬虫

### 症状表现

在 BWT 后台中，爬虫一直提示抓取 Sitemap 失败，返回 403 Forbidden 错误。同时，平时访问博客主站有时也会莫名其妙触发 Cloudflare 的交互式质询验证。

```
️                                                        ️☁️
 □ 确认您是真人                CLOUDFLARE
                                           ꯭隐꯭私·条꯭款꯭
```

### 原因分析

为了保护部署在 IIS 上的一个资源站，笔者在 Cloudflare WAF 中写了一条安全拦截规则，意图拦截该子域下非亚洲 IP 或者请求特定文件后缀（如 .zip / .exe）的访问。
然而，由于理解错了 WAF 表达式逻辑编辑器的机制，导致“拦截非亚洲 IP”这个条件脱离了域名的绑定，变成了全局生效！
极其不巧的是，Bingbot 和 Googlebot 的爬虫服务器绝大多数都位于北美（NA）。当它们尽职尽责地来抓取笔者博客的 Sitemap 时，直接被当成境外恶意请求，无情地吃了一记 403 闭门羹。

### 解决方案

重新梳理 WAF 规则的运算逻辑，直接通过“分配律”的形式将括号拆开，虽然写着麻烦，但是能确保一定符合。然后引入了关键的**放行已知爬虫**机制。

所谓的“放行已知爬虫”，就是在 Cloudflare WAF 中，官方提供了一个专门的 cf.client.bot 字段，用于识别主流合规搜索引擎。在任何可能引起误伤的防护规则中，务必加上 not cf.client.bot 这个条件。

```
(http.host eq "dl.ybjun.com" and http.request.uri.path contains ".zip") or (http.host eq "dl.ybjun.com" and http.request.uri.path contains ".exe") or (http.host contains "dl.ybjun.com" and http.request.uri.path contains ".rar") or (ip.src.continent ne "AS" and not cf.client.bot and http.host eq "dl.ybjun.com")
```

## 2 VUE单页应用的“快照时间差”