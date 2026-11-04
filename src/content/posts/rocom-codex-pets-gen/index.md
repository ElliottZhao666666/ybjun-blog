---
title: 将洛手宠物实装到codex，rocom-codex-pets-gen 技能使用方法
published: '2026-11-04T17:39:21'
description: 把《洛克王国：世界》里的宠物放到 Codex 做桌宠：原模型渲染、九类颜色与动态赛季支持。
pinned: false
tags:
  - 技术备忘
  - Codex
category: 小作品
draft: true
author: ''
sourceLink: ''
comment: true
copyProtection:
  blockSelection: false
  blockClipboard: true
  blockContextMenu: true
  blockDevTools: false
cover: ''
encrypted: true
password: '123456'
---

本文通过一个实际的例子，简要介绍使用博主开发的 Codex 技能 `rocom-codex-pets-gen` 技能，将洛克王国世界的宠物资源提取出来，并生成 Codex 桌宠的全过程。

技能的仓库如下，可以先给 Codex 安装此技能后再沿着本文照做。**需要注意的是，如果你有能力直接按照仓库内的文件结构要求准备宠物资源文件，那你无需查看本文，本文最主要是要介绍一种拿到宠物资源的办法。**

::github{repo="ElliottZhao666666/rocom-codex-pets-gen"}

## 准备工作

在开始本文流程之前，你需要确保已经完成以下操作：

* 电脑已经安装《洛克王国：世界》并更新到最新版本。
* 准备好 `rocom-pets` 主程序，接下来的资源准备流程需要借助这个软件实现。获取方法见下方。
* 电脑已安装 Python 3.11+。以及 Codex 桌面版。

其中 `rocom-pets` 是`whoisnian` 开发的一款桌宠软件，可以提取洛克王国宠物资源并将其显示在桌面上，作为桌宠与用户互动，所有动作、音效、表情逻辑都遵循原游戏。不过目前这个桌宠还没有其他功能。我们的技能要实现的是基于洛克王国原始宠物资源，生成对应的 Codex 虚拟宠物。

大家可以到 Release 页面下载到最新版：

::github{repo="whoisnian/rocom-pets"}


## 提取资源

接下来，我们以制作 **异色黑白炫彩小浣蛋** 为例，演示资源提取方法：

运行`rocom-pets`主程序，初次运行，桌面不会有反应，但应该有托盘图标了，直接点击**首选项**进入设置。
![img_1793781972603.png](./img_1793781972603.png)




