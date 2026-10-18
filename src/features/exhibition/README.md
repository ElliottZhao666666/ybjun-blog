# 展柜能力（未启用）

`Exhibition.astro` 保留 Twilight 最新版的完整菜单卡片和布局；`navigation.ts` 保留从导航数据生成页面参数的逻辑，并过滤没有地址或指向外站的父菜单。

本目录在 `src/pages` 之外，没有注册 `/exhibition/` 或动态菜单路由，当前导航也没有添加入口。

以后启用时，显式新增 Astro 页面并传入 `link: NavbarLink`；需要批量生成时，在新路由中调用 `getExhibitionEntries(navbarConfig.links)`。
