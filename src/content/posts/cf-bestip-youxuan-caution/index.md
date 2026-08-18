---
title: 使用开源项目 Cloudflare-BestIP 自建 CF 优选的踩坑与注意事项
published: '2026-08-18T11:52:06'
description: >-
  记录使用 Cloudflare-BestIP 在本地自建 CF 优选节点的踩坑点，重点解析 config.json
  配置细节。建议有需要的读者将本文与原项目的README结合阅读。
author: ''
cover: ''
pinned: false
tags:
  - Cloudflare
  - 建站
  - 网络
category: 经验分享
encrypted: false
draft: true
---

之前我们曾分享过对站点做 Cloudflare 大陆地区优选 IP 的加速方案（[点此跳转查看](https://ybjun.com/posts/cloudflare-youxuan-accelrate/)）。但最近发现，可能因为许多人滥用 CF 优选边缘节点自建科学上网或其他不正当用途，导致大陆各大运营商加紧了对部分热门边缘节点的风控与拦截，包括但不限于高频丢包、TCP劣化甚至直接阻断 443 端口等手段。这直接影响了我们正常的建站使用，**曾经的“大陆加速器”又变回了“减速器”**，经常导致浏览器无限转圈加载。

为了将网络连通性彻底掌握在自己手里，博主决定使用开源项目 `IonRh/Cloudflare-BestIP` 自己构建 CF 优选。其核心思路是：在本地 NAS 的真实宽带环境下，定期测速寻找当前最优秀的边缘节点 IP 并自动更新 DNS 记录，从而替换掉那些被严重滥用的公共优选节点列表。

::github{repo="IonRh/Cloudflare-BestIP"}

本文并不完整该开源项目基础的构建、部署和调试过程。本文仅针对在实际跑通流程中遇到的底层环境陷阱，特别是编写部署命令和编辑 `config.json` 配置文件时容易踩到的坑点进行简单记录。建议有需要的读者将本文与原项目的 `README` 结合阅读，以便少走弯路。

## 1 编辑 `config.json` 要注意

部署这个项目时我们大概率会遇到一个令人抓狂的 Bug ：明明已经把参数填好了，但每次重启 Docker 容器，日志都会报错，并且填好的 `config.json` 会被强行恢复成官方的默认模板。

这是因为 `Cloudflare-BestIP` 的底层是由 Go 语言编写的。Go 的 `encoding/json` 库对 JSON 格式有着“洁癖”般的严格要求。

当我们在复制粘贴 AI 生成的配置，或者使用某些简易文本编辑器时，文件中极易混入不可见的 非断行空格 或是 UTF-8 BOM 签名。Go 程序在启动读取配置时，一旦遇到这些不可见字符，就会直接抛出 JSON 解析崩溃。**这里特别点名群晖 DSM 自带的文本编辑器，使用 DSM 部署的读者一定要避免使用！**

为了防止程序出现问题，作者写了一个粗暴的容错机制：只要判断配置文件读不出来，就立刻用写死的默认配置把原文件覆盖掉！ 这就是为什么我们的配置总是“神秘消失”的原因。

**为了绝对保证配置文件的纯净，推荐仅使用以下两种方式编辑 `config.json`：**

1. 桌面端：强烈建议通过 SMB 或 FTP 等方式将 NAS 或软路由中本项目的配置文件夹映射到本地电脑，然后使用 VS Code 或 UltraEdit 等专业的代码编辑器进行修改并保存。
2. SSH 终端：如果你习惯命令行，直接通过 SSH 连入宿主机，使用 `vim /挂载路径/config.json` 进行原生的终端编辑，这样绝不会混入任何奇怪的格式字符。

## 2 头部参数

首先来看 `config.json` 开头的几条参数：

```json
{
  "IP_Type": "ipv4&ipv6",        // IP类型: ipv4 | ipv6 | ipv4&ipv6
  "IP_Number": 10,               // 更新的IP数量
  "IPv4_Url": "https://raw.gitmirror.com/IonRh/Cloudflare-BestIP/main/IPfile/ip.txt",     // IPv4地址列表URL
  "Best_IPv4": "",    // 最佳IPv4地址URL（不填即可）
  "IPv6_Url": "https://raw.gitmirror.com/IonRh/Cloudflare-BestIP/main/IPfile/ipv6.txt",     // IPv6地址列表URL
  "Pushinfo": "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=",
  "debug": false                 // 调试模式开关
}
```

### 2.1 IP 数据源地址必须替换（`IPv4_Url` / `IPv6_Url`）

默认配置中，IP 列表的下载链接使用的是 gitmirror 镜像站，但由于众所周知的原因，这个站是用不了的，所以我们将其替换为稳定且有国内节点备案的 jsdelivr CDN 链接。请在 对应行修改为：

```json
"IPv4_Url": "https://cdn.jsdelivr.net/gh/IonRh/Cloudflare-BestIP@main/IPfile/ip.txt",
"IPv6_Url": "https://cdn.jsdelivr.net/gh/IonRh/Cloudflare-BestIP@main/IPfile/ipv6.txt",
```

### 2.2 `IP_Number` 数量设定：贪多嚼不烂

默认配置文件可能会下发 8 个甚至 10 个更多的 IP， **这里建议将其修改为 3。**

因为国内访问 Cloudflare 边缘节点的网络波动非常大。放行过多的次优 IP 会导致 DNS 轮询时，访客命中高延迟或高丢包劣质节点的概率大幅增加。仅保留测速排名最高、0 丢包的前 3 个极品 IP，反而能提供最稳的 TLS 握手与访问体验。

需要注意的是，这个 `IP_Number` 的数值是区分协议的。如果你在前面的 `IP_Type` 字段填写了 `"ipv4&ipv6"`，那么设置为 3 意味着脚本最终会给你的目标子域名推入 3 条 `A` 记录 和 3 条 `AAAA` 记录，总计添加 6 个解析。

### 2.3 `Pushinfo` 需要反代

对于有条件使用 Telegram 的用户，可以通过 BotFather 创建机器人，并将组装好的 API 链接填入 `Pushinfo`，以便每次优选完成后能收到实时通知。

但是大家都知道官方 API 域名 `api.telegram.org` 是啥情况。而这个测速脚本为了保证结果真实可用，必须使用原生网络环境。所以有需求的话，可利用 Cloudflare Workers 自行对 Telegram API 域名做一个极简的反向代理，并绑定到你自己的子域名上。随后，将配置文件中的官方域名替换为你的反代域名。不过博主没啥需求，就没弄。

### 2.4 `debug` 必须开

不仅仅是为了能在 Docker 日志中看到详细具体的信息，而且截至发文前的最新版本，如果不开 Debug 模式，就经常会遇到各种报错。所以还是打开它吧，反正也没啥影响。

