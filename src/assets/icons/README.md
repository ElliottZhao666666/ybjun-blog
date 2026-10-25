# 本地图标资源

Astro 图标在构建时输出内联 SVG；Svelte 图标使用 Iconify 的离线渲染器，数据打包进本站缓存资源，不调用外部 Iconify API，也没有外部备用地址。

`runtime-icons.json` 在 Astro 启动/构建时由 `scripts/generate-runtime-icons.mjs` 生成，只保留组件和 `twilight.config.yaml` 实际引用的图标。图标名不存在时构建报错；添加新图标后重启开发服务，或运行 `node scripts/generate-runtime-icons.mjs`。新增图标集时，先安装相应的 `@iconify-json/<prefix>` 包。

常用图标来自已安装的官方 `@iconify-json` 数据包，各图标集的作者、许可和来源保存在 JSON 的 `info` 中。背景音乐功能使用的 `eos-icons:loading` 单独保存在 `eos-loading.json`，取自 [Iconify 官方图标仓库](https://github.com/iconify/icon-sets/blob/master/json/eos-icons.json)，遵循其中的 MIT 许可。
