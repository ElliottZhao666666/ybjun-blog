---
title: 使用开源项目 Cloudflare-BestIP 自建 CF IP 优选的踩坑与注意事项
published: '2026-08-18T11:15:41'
description: 记录使用 Cloudflare-BestIP 在本地自建 CF 优选节点的踩坑点，重点解析 config.json 配置细节。
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

为了将网络连通性彻底掌握在自己手里，博主决定使用开源项目 `IonRh/Cloudflare-BestIP` 自己构建 CF 优选。其核心思路是：在本地 NAS 的真实宽带环境下，定期测速寻找当前最优秀的边缘节点 IP 并自动更新 DNS 记录，从而替换掉那些被严重滥用的公共节点列表。

::github{repo="IonRh/Cloudflare-BestIP"}

本文并不完整该开源项目基础的构建、部署和调试过程。本文仅针对在实际跑通流程中遇到的底层环境陷阱，特别是编写部署命令和编辑 `config.json` 配置文件时容易踩到的坑点进行简单记录。建议有需要的读者将本文与原项目的 `README` 结合阅读，以便少走弯路。