# 导航与预取分工

Swup 由 `astro.config.mjs` 中的 `loadOnIdle: false` 提前启动，不再等待
`window.load` 与空闲时段。缓存、悬停/触摸/聚焦预取、现有动画与容器配置保留。

`src/utils/swup-preload.ts` 是当前 Swup 预取插件的兼容层，随 Swup 的初始化
模块安装。正式导航同时查找相对路径与完整 URL 对应的预取 Promise；预取失败时
重新执行正常请求。已取消的切页不会因预取失败再次启动请求。
后续升级 `@swup/astro` / `@swup/preload-plugin` 时，需复查插件的
`preloadPromises` 和 `page:load` 接口，再决定是否保留此兼容层。

## 浏览器预取与 Speed Brain

保留 Cloudflare 侧 Speed Brain 开关，通过 `public/_headers` 提供本站自己的
`Speculation-Rules` 响应头。Cloudflare 不覆盖源站已提供的同名响应头：
<https://developers.cloudflare.com/speed/optimization/content/speed-brain/>

规则位于 `public/navigation-speculation-rules.json`：

- Swup 管理的链接由 Swup 预取和缓存，浏览器不再独立预取同一目标。
- 明确标注 `data-no-swup`（包含祖先元素）的同源普通链接，可使用浏览器预取。
- 下载、指定 target 和页内锚点链接不参与上述浏览器预取。
- 保留 `conservative` 时机，不进行全站批量预取或预渲染。

例如需要普通跳转的独立 HTML 页面可以写成：

```html
<a href="/standalone/" data-no-swup>独立页面</a>
```

不要将有副作用的 GET 入口加入预取范围。修改规则只影响此博客的部署，不修改
Cloudflare 区域中其它网站的 Speed Brain 设置。若将来切回全量浏览器预取，
应先调整 Swup 的预取范围，避免两套规则再次同时读取同一页面。

## 切页 Loading 与截止时间

`src/utils/navigation-loading.ts` 随 Swup 初始化模块安装，界面是所有页面共用、
位于 Swup 替换容器外的 `src/components/navigationLoading.astro`。

| 从点击开始 | 表现 |
|---|---|
| 0–300 ms | 保持当前页面，不展示额外提示 |
| 超过 300 ms | 顶部轻量进度条 |
| 超过 6 s 且新内容尚未替换 | 显示可取消的 Loading，覆盖取页或必要样式等待 |
| HTML 已取得 | 执行原有 Swup 退场、内容替换和入场动画 |
| 整次切页超过 17 s | 停止未完成的取页或切换阶段并恢复可操作状态，包括响应头或响应正文传输挂起 |

进度条由每次导航的独立计时从起点缓慢推进，17 秒到达终点；属于等待反馈，
不代表实际下载百分比。新内容替换时立即补满并淡出；成功、取消或失败后清理
动画帧。减少动态效果模式保留真实的进度值，不再将等待进度写死为满格。
所有使用 GridLayout / BaseLayout 的 HTML 页面均共用此机制：包括首页分页、
文章、归档分类标签、相册详情、日记、友链、关于及订阅说明页。
首次整页加载沿用首屏 Loading；页内锚点、外站、新标签页、下载和
`data-no-swup` 链接不属于 Swup 切页。

明确的 HTTP 错误或页面内容不完整会立即提示，不空等 17 秒。
错误提示提供重试、新标签页打开（`target="_blank"`，跳过 Swup）和关闭提示，
正文末尾展示简短错误原因。关闭按钮显示 10 秒倒计时，归零自动收起提示；
手动关闭、重试、新导航都会清除旧倒计时。没有强制自动刷新。
取消可使用按钮或 Escape；更换目标、成功、失败均清理相应计时器和界面。
图片、字体及站点统计不属于上述 HTML 等待条件。

为保留旧正文，设置 `visit.animation.wait = true`；Banner 与布局变化延后到
真正开始退场时。首屏 Loading 保留原来的独立退场/兜底机制，但其控制器只运行
一次，不在 Swup 切页时重播首屏入场动画。

Swup 4.8.2 没有公开的完整取消恢复 API。恢复适配集中在这个模块中：中止当前
visit、清理导航类与内部占用标记，通过原有历史记录回到实际显示的页面；回退
事件从 Swup 的 `skipPopStateHandling` 入口消费，不触发多余的 page:view。
已被替换的页面则保留新内容并结束切换效果。升级 Swup 后，应重新测试取消、
前进后退、连续点击和迟到响应，复查该恢复适配。
