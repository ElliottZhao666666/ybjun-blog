---
title: 使用DigitalPlat快速获得永久免费域名，Cloudflare可托管
published: '2026-02-20'
description: 本文免费域名平台DigitalPlat的完整域名注册教程。它使用GitHub快捷验证（无需上传身份证/无需信用卡），也能完美托管到 Cloudflare。
author: ''
cover: ''
pinned: false
tags:
  - 网络
category: 技术备忘
encrypted: false
draft: true
---

对于技术爱好者而言，拥有一个**属于自己的域名**还是很有用的。不仅可以为NAS做DDNS以便外部访问，还可以搭建个人网站、个人博客，对计算机专业的学生，也可以用于临时托管自己的web课设项目。
但域名是要买的，如果我们使用需求很小，且仅限于自用，可能就会感觉不太值得每年花费几十块钱去维持这个域名。
对这种个人自用需求来说，**xyz顶域的1.111B域名**其实就是个很不错的选择，在Spaceship注册，可以使用支付宝，一年只要四块钱。不过我们今天要介绍的，则是由一个非营利组织The Hack Foundation运营的开源免费域名项目**DigitalPlat**。通过这个项目我们就可以获得永久免费的、可以通过Cloudflare托管的顶级域名。


:::warning
本文教程仅供技术交流与个人学习使用。免费资源来之不易，请大家合规使用，切勿滥用于非法用途，共同维护良好的网络环境。
:::


## 1 前置条件
你需要有一个GitHub账号，并至少满足以下条件：
> 1. 注册满30天
> 2. 近期内有提交过内容或给别的项目点过star

以上条件是因为，虽然DigitalPlat的注册无需身份信息和支付信息，但其使用**GitHub KYC**作身份验证，证明你是活跃着的真人。


:::important
DigitalPlat 注册得到的域名属于公共子域，不支持在中国大陆备案，请大家在使用时务必遵守法规。如果是企业或团队需要构建网站，建议还是注册正规域名并依规建站。
:::

## 2 注册 DigitalPlat 账号
首先，打开 [DigitalPlat网站](https://domain.digitalplat.org/) 。
:::tip
如果遇到网络无法访问的问题，请自行解决。
:::
点击**Register a domain**，会让你登录账号，此时选择界面下方的**Sign up**，进入注册。
![img_1771557648144.png](blob:https://blog.ybjun.com/b5af99b9-4396-458c-bda2-96bb495213f8)

这里面，所有信息都可以按照自己的想法随便填，但**邮箱必须填写自己的真实邮箱**！qq、126、163这种国内邮箱也可以。
至于地址和电话，可以直接使用 [美国地址生成器](https://usaddressgen.com/) 随机生成，注意地址信息要复制完整地址，因为DigitalPlat要求地址内至少要包含两个逗号；电话要以美国代号 **+1-** 开头，后面出现的数字中括号和连字符全部删除。
填好全部信息后，点击下方**Register**完成注册，此时你的邮箱会收到一封验证邮件，点击邮件内的链接完成验证。

---

接着，返回DigitalPlat主页登录你的账号，登录后会提醒你需要KYC验证，此时下拉选择**GitHub OAuth**，然后使用GitHub账号登录，只要满足条件，验证就会通过。
![img_1771558114385.png](blob:https://blog.ybjun.com/b96519aa-03f2-4f1b-b8d4-f31dc3df2243)
![img_1771558211763.png](blob:https://blog.ybjun.com/0df2bbf4-1259-4799-b2b6-6001e8958fd1)

## 3 开始注册域名

验证通过确定后就会直接进入Dashboard。

![img_1771558245342.png](blob:https://blog.ybjun.com/6167f2d8-05db-4cbf-b417-7910b8c07b55)

普通用户只有一个免费域名的额度，一般是够用了，如果不够，相信你也看到dashboard中的提示了，**给该项目在GitHub上点个star即可多加一个免费域名额度**。
该项目的GitHub地址为：[https://github.com/DigitalPlatDev/FreeDomain](https://github.com/DigitalPlatDev/FreeDomain)
用你验证用过的GitHub账号进去点一个star，然后回DigitalPlat Dashboard，点击**clickhere to verity**完成验证，这样你的可用免费域名数就变成了2个。
![image](./ScreenShot_2026-02-20_103224_084.png)
接着点击顶栏的**Register**，划到页面最底部，就可以选择自己想要的公共子域，并输入自己想注册的域名了。因为是公共子域，所以虽然其提供的是`.dpdns.org`这样的两级后缀，但其实是和`.com.cn`、`.edu.cn`这样，可以独立托管。我们就以注册`yueban.dpdns.org`为例。
![image](./ScreenShot_2026-02-20_103527_975.png)

:::note[关于后缀怎么选]
DigitalPlat 一共提供了四种后缀，`.dpdns.org`、`.us.kg`、`.qzz.io` 和 `.xx.kg`。
其中 `.us.kg` 和 `.xx.kg` 需要有key才能用（好像要付费），且 `.us.kg` 目前在中国大陆有被DNS污染的情况。
建议个人使用，还是用`.dpdns.org`，至少有`.org`托底，应该会比较稳定。
:::
