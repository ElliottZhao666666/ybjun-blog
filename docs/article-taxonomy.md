# 文章分类与标签规范及调整记录

日期：2026-10-19。保留文章内容、发布日期、更新时间、草稿状态和既有新特性示例；只优化分类/标签，并按要求移除两张 blob 临时图片。

## 分类约定

一篇文章只有一条分类路径，按主要主题归属；跨主题内容通过标签关联。

```text
网络
├─ 建站
├─ Cloudflare
├─ 域名
└─ 组网与路由
计算机
├─ 系统与硬件
├─ 服务器与 NAS
└─ 软件服务
小作品
随想
资源
```

标签分为文章性质和具体主题：一般选择一个性质标签（技术备忘、经验分享、学习笔记、随笔），再选择正文核心主题。核心主题标签可与分类重合，便于跨分类检索；不因偶然提及而添加标签。公众号资源合集使用公众号主题标签；编辑器测试草稿保持未分类和空标签。

## 全部文章

下表“变化”与本轮开始时用户尚未提交的版本比较。

| 文章 | 最终分类 | 最终标签 | 本轮变化 |
|---|---|---|---|
| [拯救收录问题，多种架构网站 SEO 优化踩坑实录](../src/content/posts/all-sites-seo-exp/index.md) | 网络 / 建站 | 技术备忘、建站、Cloudflare、SEO | 标签增加：建站、Cloudflare；标签移除：计算机 |
| [软化硬路由：小米 AX3000T 原厂固件免刷机开 SSH 与软件持久化部署实践](../src/content/posts/ax3000t-ssh-software-1/index.md) | 网络 / 组网与路由 | 技术备忘、路由器、Linux、软路由 | 分类：网络 → 网络 / 组网与路由 |
| [大幅提升！基于 CF 全家桶的博客国内提速与恶意反代防御全记录](../src/content/posts/blog-accelrate-pt2/index.md) | 网络 / 建站 | 技术备忘、建站、Cloudflare、SEO | 标签增加：建站、Cloudflare、SEO |
| [使用开源项目 Cloudflare-BestIP 自建 CF 优选的踩坑与注意事项](../src/content/posts/cf-bestip-youxuan-caution/index.md) | 网络 / Cloudflare | 经验分享、Cloudflare、建站 | 标签增加：Cloudflare |
| [基于CF Workers从零构建TOTP认证系统](../src/content/posts/cf-workers-totp/index.md) | 网络 / Cloudflare | 技术备忘、Cloudflare、建站 | 标签增加：技术备忘；标签移除：计算机 |
| [利用CF连接器实现通过域名访问国内未备案云服务器](../src/content/posts/cfd-tunnel-vps/index.md) | 网络 / Cloudflare | 技术备忘、Cloudflare、建站、服务器 | 标签增加：Cloudflare、建站 |
| [Cloudflare 全家桶网站国内IP优选提速！拒绝复杂方法，不用SaaS！](../src/content/posts/cloudflare-youxuan-accelrate/index.md) | 网络 / Cloudflare | 技术备忘、Cloudflare、建站 | 标签增加：Cloudflare |
| [究竟有没有“一级域名”？从底层理清域名分级与公共子域](../src/content/posts/domain-levels-clarify/index.md) | 网络 / 域名 | 学习笔记、域名 | 标签增加：学习笔记、域名；标签移除：经验分享 |
| [使用DigitalPlat快速获得永久免费域名，Cloudflare可托管](../src/content/posts/dpdns-free-domain/index.md) | 网络 / 域名 | 经验分享、域名、建站、Cloudflare | 标签增加：域名、建站、Cloudflare |
| [养龙虾！在群晖NAS上使用Docker部署OpenClaw全流程](../src/content/posts/dsm-docker-openclaw/index.md) | 计算机 / 服务器与 NAS | 技术备忘、NAS、Docker、AI、OpenClaw、Cloudflare | 分类：计算机 / 服务器 → 计算机 / 服务器与 NAS；标签增加：NAS；标签移除：计算机、网络 |
| [第一篇文章](../src/content/posts/first/index.md) | 随想 | 随笔 | 保持原样 |
| [4月30日截止，低成本领取Gemini Pro一年学生订阅资格，最后上车机会](../src/content/posts/geminipro-free-lastchance/index.md)（草稿） | 计算机 / 软件服务 | 经验分享、Google、Gemini、AI、白嫖 | 分类：网络 → 计算机 / 软件服务；标签增加：Google |
| [GNAME推出的免费域名，短后缀，CF可托管](../src/content/posts/gname-free-domain/index.md) | 网络 / 域名 | 经验分享、域名、建站、Cloudflare | 标签增加：域名、Cloudflare |
| [Google 帐号改地区最全面做法，解决家庭组无法加入问题](../src/content/posts/google-location-change/index.md) | 计算机 / 软件服务 | 经验分享、Google、AI | 分类：计算机 / 经验技巧 → 计算机 / 软件服务；标签移除：计算机 |
| [【持续更新】月半菌公众号推文资源合集](../src/content/posts/gzh-res/index.md) | 资源 | 公众号 | 分类：未分类 → 资源；标签增加：公众号 |
| [除了 .com，还有哪些顶级域名值得注册？建站TLD选择指南](../src/content/posts/how-to-choose-tld/index.md) | 网络 / 域名 | 经验分享、域名、建站 | 标签增加：域名 |
| [自建虚拟网，在校园网内各处都可使用自己的宽带](../src/content/posts/innervpn_in_schoolweb/index.md) | 网络 / 组网与路由 | 技术备忘、VPN | 分类：网络 → 网络 / 组网与路由；标签增加：VPN |
| [联想家悦续命记：掉盘、花屏与启动失败背后的硬件宿命](../src/content/posts/lenovo-jiayue-repair/index.md) | 计算机 / 系统与硬件 | 经验分享、Windows、硬盘 | 分类：计算机 → 计算机 / 系统与硬件 |
| [歌词大师 (Lyric Master) 开发复盘](../src/content/posts/lyrics_master_development/index.md) | 小作品 | 技术备忘、建站、软件、歌词大师 | 标签增加：技术备忘、建站；标签移除：计算机 |
| [编辑器测试](../src/content/posts/nihaotest/index.md)（草稿） | 未分类 | 无 | 保持原样 |
| [无服务器，CF全托管，从零开始的建站全流程](../src/content/posts/site_from_zero/index.md) | 网络 / 建站 | 技术备忘、建站、Cloudflare | 标签增加：建站；标签移除：计算机 |
| [打破255思维定势，从二进制本质看透子网掩码与CIDR](../src/content/posts/subnet-mask-cidr/index.md) | 网络 / 组网与路由 | 学习笔记 | 分类：网络 → 网络 / 组网与路由；标签移除：计算机 |
| [基于群晖 NAS 的 DaVinci Resolve 协同剪辑工作流构建记录](../src/content/posts/synology-davinci-workflow/index.md) | 计算机 / 服务器与 NAS | 技术备忘、NAS、Docker、影视制作 | 分类：计算机 / 服务器 → 计算机 / 服务器与 NAS；标签增加：技术备忘、Docker；标签移除：网络 |
| [童年阴影！开机那个无法跳过的蓝屏扫盘，到底在干什么？](../src/content/posts/windows-native-autochk/index.md) | 计算机 / 系统与硬件 | 学习笔记、Windows | 分类：计算机 → 计算机 / 系统与硬件；标签增加：学习笔记；标签移除：随笔 |
