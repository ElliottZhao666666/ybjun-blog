# 霞鹜文楷屏幕阅读版 Web 字体

- 字体：`LXGW WenKai Screen`，Regular / 400，版本 **1.530**。
- 官方发布：<https://github.com/lxgw/LxgwWenKai-Screen/releases/tag/v1.530>。
- 分片来源：<https://github.com/CMBill/lxgw-wenkai-screen-web>，npm 包 `lxgw-wenkai-screen-web@1.530.0` 中的 `lxgwwenkaiscreen/` 目录。
- 许可：SIL Open Font License 1.1，见同目录 `OFL.txt`。

本站沿用 `twilight.config.yaml` → `fontLoader.astro` → 本地 `result.css` → WOFF2 分片的调用链，保留异步样式加载、无脚本兜底、`local()` 优先和 `font-display: swap`。

本次同步了完整的 253 个分片及其配套 CSS、报告和演示文件。字体二进制文件与上述 npm 包完全一致；两个 CSS 文件中的分片 URL 及站点配置中的 CSS 入口统一添加 `?v=1.530`，以适配本站静态资源的一年缓存策略。升级时需同时更新两处版本参数。

构建 OG 图片使用的完整 TTF 单独位于 `src/assets/og/`，其来源和校验信息见该目录的说明。
