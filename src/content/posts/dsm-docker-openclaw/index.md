---
title: 养龙虾！在群晖NAS上使用Docker部署OpenClaw全流程
published: '2026-03-25'
description: >-
  本文全景复盘了在群晖 NAS 上利用 Docker 部署 OpenClaw，并接入微信ClawBot的全流程。文章深度拆解了底层网络代理、容器权限对齐以及
  Cloudflare 隧道穿透的配置细节，并针对 UDP 假死降级 TCP、WebSocket
  报错等隐蔽大坑提供了硬核排雷方案，助你零成本将强大的大语言模型无缝接入社交生态。
author: ''
cover: ./cover.png
pinned: false
tags:
  - 计算机
  - AI
  - OpenClaw
  - 网络
  - Docker
category: 技术备忘
encrypted: false
draft: false
---

要说最近计算机圈什么最火，想必一定是**养龙虾**了。

作为一个热衷于折腾网络技术和探索前沿 AI 的开发者，博主也一直期望能试试部署一个OpenClaw，打造一个24-7的私人智能助理。正巧微信内测了ClawBot，而博主正好被灰度到了！

那么本期，就来详细记录一下博主以 **群晖DS920+** 为载体，通过 Docker 完整部署开源网关 **OpenClaw**，并利用 Cloudflare Tunnel 实现安全的公网访问，最终成功将其接入微信的全流程。这篇文章将详细复盘全套流程，以及博主在部署过程中踩过的那些极其隐蔽的“坑”。

## 1 通过 Mihomo + Metacubexd 实现 NAS 科学访问

:::tip
本章节为独立的环境准备模块。如果你的网络环境已经具备良好的外部连通性，可直接跳过此章。
:::

为了确保容器在拉取扩展包以及**请求外部大模型 API 时**网络畅通，我们需要在 NAS 上部署一个本地代理网关。这里我们选择性能强劲的 Mihomo 内核，搭配 Metacubexd (原 Yacd) 面板进行可视化管理。

### 1.1 Mihomo 内核的安装和配置

首先在群晖的 `/volume1/docker/` 目录下创建一个名为 `mihomo` 的文件夹。由于通常大家使用的是🛫提供的订阅链接，我们需要先将订阅配置下载到本地，再进行部署。

使用管理员组的帐户通过 SSH 连接到群晖DSM，并使用`sudo -i`，再次输入你的管理员帐户密码，进入root环境。然后执行以下两条命令：

``` bash
cd /volume1/docker/mihomo

# 使用 wget 下载订阅配置并重命名为 config.yaml，请将下方的 URL 替换为你自己的真实订阅地址
wget -O config.yaml "https://example.com/api/v1/client/subscribe?token=your_token_here&flag=mihomo"
```

接着，在该目录下创建 `docker-compose.yml` 文件。需要注意的是，**Docker的网络必须使用 host 模式**，以便让NAS 本地及其他容器能通过 127.0.0.1 访问：

```yaml
// docker-compose.yml

version: '3.8'
services:
  mihomo:
    image: metacubex/mihomo:latest
    container_name: mihomo
    restart: unless-stopped
    network_mode: "host" 
    volumes:
      - ./config.yaml:/root/.config/mihomo/config.yaml
    environment:
      - TZ=Asia/Shanghai
```

最后，执行 `docker-compose up -d` 启动内核。此时，NAS 本地的 `7890` 端口（默认）就已经具备了科学访问能力。
![img_1774436789959.png](./img_1774436789959.png)

### 1.2 Metacubexd 面板的安装配置

为了方便管理节点和规则，我们部署 Metacubexd（原 Yacd 的升级版）前端面板。为了方便管理，我们直接使用群晖 DSM 自带的 **Container Manager (容器管理器)** 来部署：

1. 打开 Container Manager，点击左侧的 **“项目”**，新增一个项目。

2. 路径选择 `/volume1/docker/metacubexd`，来源选择“创建 docker-compose.yml”。

3. 填入以下代码：

   ```yaml
   version: '3'
   services:
     metacubexd:
       image: ghcr.io/metacubex/metacubexd:latest
       container_name: metacubexd
       restart: unless-stopped
       ports:
         - "9091:80"
   ```

4. 构建并启动项目。利用群晖的这种方式部署，后续会自动让你直接在 **Web Station** 中为其创建一个基于域名的 Web 门户，访问极其优雅。
![img_1774436686332.png](./img_1774436686332.png)

5. 浏览器访问你的面板地址（默认即为NAS IP地址加**9091**端口），输入 API 基础地址 `http://127.0.0.1:9090`，即可接入 Mihomo 进行节点切换。
![img_1774436727756.png](./img_1774436727756.png)

:::tip
虽然我们在Web Station中添加门户时需要填一个域名，但实际上添加后，我们依然可以直接使用NAS的ip访问面板。
:::

## 2 安装OpenClaw

OpenClaw 是一个极其轻量且强大的 AI 网关，它能够将各大模型 API 桥接到不同的通讯通道。相信不必过多介绍了。~~自从1000多块的代安装服务出现以来，总感觉整件事都变得抽象了起来。虽说有人说“一代人有一代人的气功”吧，但谁叫这玩意就是火呢，反正手头有NAS，那就试试呗。~~

### 2.1 获取代码库 (绕过 Git 限制)

我们需要使用**OpenClaw官方的开源代码库**完成整个部署环节。由于DSM默认没有安装 Git 环境，直接 `git clone` 会报错。所以我们采取“曲线救国”的方式：

1. 访问 [OpenClaw GitHub 项目主页](https://github.com/openclaw/openclaw)。*相信你能完成第一章内容的话，应该也能解决这里的访问问题。*
2. 点击绿色的 `Code` 按钮，选择 `Download ZIP` 下载源码压缩包。
3. 打开群晖 File Station，将压缩包上传到 `/volume1/docker/openclaw` 目录下。
4. 右键解压，并将解压后的文件夹重命名为 `source`。最终源代码位于工作路径下： `/volume1/docker/openclaw/source`。

### 2.2 核心网络与权限优化

官方提供的默认配置采用 Bridge 虚拟网桥模式，这在DSM环境下会引发**两个致命问题**：一是严格的读写权限导致容器启动失败，二是处于网桥内的容器无法顺畅访问宿主机的 `127.0.0.1:7890` 代理。

**解决方案：创建一个用户叠加配置 `docker-compose.user.yml`。**

在 `/volume1/docker/openclaw/source` 目录下执行：

```bash
cat <<EOF > docker-compose.user.yml
services:
  openclaw-gateway:
    user: "0:0"
    network_mode: "host"
  openclaw-cli:
    user: "0:0"
    network_mode: "host"
EOF
```

这不仅赋予了容器 Root 权限（`0:0`），还直接让它与 NAS 共用网络栈，秒连代理。

### 2.3 容器启动与交互式配置

加载所有配置文件并后台启动：

```bash
cd /volume1/docker/openclaw/source
docker compose -f docker-compose.yml -f docker-compose.extra.yml -f docker-compose.user.yml up -d
```

启动后，网关并没有直接就绪，我们需要进入容器跟随脚本的**交互式指引**进行初始化配置。这里有几个选项非常容易让人迷惑，下面是标准答题卡：

```bash
# 进入交互式配置界面
docker compose exec openclaw-gateway node dist/index.js setup
```

**交互选项避坑指南：**

1. **Select Provider (选择大模型供应商)**：如果你使用的是第三方 API 中转站，请务必选择 `Custom`，一般是可以完美支持 OpenAI 的协议的。
2. **Base URL**：输入你的 API 接口地址，例如 `https://api.example.com/v1`。需要注意的是，对于 OpenAI 类 API ，我们**没必要在后面手动添加**`/chat/completions`的子路径，后续会自动加上。
3. **API Key**：填入你的 `sk-xxxx` 令牌。
4. **Model ID**：填入你要调用的确切模型名称（例如 `gpt-5.4` 或 `claude-3-5-sonnet`），**这里的模型名称一定要一字不差**！
5. **Enable Autonomous Pulse? (是否启用自主心跳)**：强烈建议选 **`No` (False)**！如果你选了 Yes，网关每半小时会自动唤醒大模型检查任务，如果你没写任务脚本，它就会无限空转，一天能烧掉你成千上万的 Token！
6. **Channel Setup (通道配置)**：如果你当前只打算接入微信，当脚本询问是否配置 iMessage、Telegram 或 WhatsApp 时，建议先一律选择 Skip (跳过)。OpenClaw 是模块化的，这些通道在后续通过具体的 CLI 命令安装插件后再配置也不迟。
7. **Workspace / Templates (工作区模板)**：脚本可能会询问是否生成默认的工作区模板或示例文件，建议选择 Skip 或保持默认。我们通常只需要一个干净的运行环境，复杂的逻辑可以在 Web 控制台后续配置。

:::note[如果不确定API内包括哪些模型，完整名称是什么，该怎么办？]
在进行上述第 4 步填写 Model ID 时，如果你不确定API支持哪些具体的模型名称，可以新开一个 SSH 窗口，使用以下 curl 命令直接调取供应商的模型列表：
```bash
curl https://api.example.com/v1/models -H "Authorization: Bearer sk-your-api-key-here"
```
记得要把API链接和token换成你自己的哦！执行后终端会返回一段 JSON，其中的 id 字段即为你需要在配置脚本中填写的模型名称。
:::

## 3. 为控制台构建隧道

至此，OpenClaw我们就安装好了，并且会在宿主机（NAS本地网络）的 `18789` 端口暴露出 Web 控制台。

**但是，** OpenClaw 控制台调用了设备指纹识别等高级安全 API。现代浏览器规定，这类 API **必须在安全上下文（Secure Context）中运行**，也就是说，你只能通过 `http://127.0.0.1`、`http://localhost` 或者配置了 SSL 证书的 `https://` 域名访问。如果你没在 NAS 中为这个域名申请并应用证书，直接用群晖 IP（如 `http://10.x.x.x:18789`）访问，会直接报错 `control ui requires device identity`。

为了优雅地解决这个问题，我们引入 **Cloudflare Tunnel (cloudflared)** 进行内网穿透。

### 3.1 CF 隧道构建 (强制 TCP 协议，破解假死难题)

在 Cloudflare Zero Trust 面板中创建 Tunnel，并将 `claw.yourdomain.com` 路由到 `127.0.0.1:18789`。

**这里有一点需要注意：** 默认情况下，CF 隧道优先使用 QUIC (基于 UDP) 协议连接边缘节点。但在许多复杂的网络环境（比如校园网、多层 NAT、PPTP 旁路由等）下，UDP 长连接极不稳定。**这会导致日志中疯狂报 `timeout: no recent network activity` 错误，隧道时断时续**，甚至导致群晖的 Container Manager 假死，提示“系统正忙”。

**解决方法：强制降级为 TCP (http2) 协议。** TCP 具有完善的重传机制，稳定性远超 UDP。

由于我们在[之前的文章](https://www.ybjun.com/posts/cfd-tunnel-vps/)中已经说到过Cloudflared隧道的构建，大家如果不明白，可以先去那边看看，这里不再赘述。

在群晖 SSH 执行下面命令，**记得把你的token复制进去替换哦**！

```bash
docker run -d \
  --name cloudflared-tunnel \
  --network host \
  --restart unless-stopped \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate --protocol http2 run --token <YOUR_CF_TUNNEL_TOKEN>
```

然后，在**Cloudflare网页端的应用程序路由界面**相应地填上你想要的域名，博主就用`claw.ybjun.com`了，**目标地址是**`http://127.0.0.1:18789` 或 `http://localhost:18789`都可以。这样隧道就创建完成了。

### 3.2 登录配对申请 (Device Pairing)

现在，我们可以通过 `https://claw.ybjun.com` 访问控制台了。输入 Token 和之前设置的密码（如果你在安装阶段选择了用Password验证的话）后点击连接，你会遇到一道新的报错，提示：**pairing required**。

这是因为网关检测到了一个新的来源，**需要对你的电脑浏览器进行设备指纹审批**。所以，现在又需要回到ssh了。

1. 获取请求 ID：

   ```bash
   docker compose exec openclaw-gateway node dist/index.js devices list
   ```

   *此时会输出一行包含 `Request ID: 6f9db1bd-xxxx...` 的待审批记录。*

2. 批准该浏览器接入：

   ```bash
   docker compose exec openclaw-gateway node dist/index.js devices approve <REQUEST_ID>
   ```

批准后，刷新浏览器，重新连接，控制台就此正式敞开，应该就可以直接看到聊天界面了。
![img_1774434587592.png](./img_1774434587592.png)

## 4. 微信 ClawBot 在 Docker 中的安装和接入

控制台就绪后，我们就可以开始接入各种各样的功能和通道了，具体的大家可以自行探索。

现在我们来演示一下微信ClawBot的接入。正巧最近微信向iOS用户开放了灰度内测，我们就来试试。
![img_1774435486927.png](./img_1774435486927.png)

微信官方使用npx的部署命令如下，但这条命令**仅适用于直接在机内安装OpenClaw的情况**，对于Docker情况是不适用的，而且即使使用`docker compose`直接穿梭运行也不可取，因为输入 `docker compose run npx ...` 时，系统会把其中的npx错误地识别为一项docker服务，我们必须把npx指定为接入点。

所以，这个安装命令需要改成下面这样。利用我们修改好的 `host` 网络和代理环境变量，执行即可：

```bash
docker compose -f docker-compose.yml -f docker-compose.extra.yml -f docker-compose.user.yml run --rm \
  -e http_proxy="[http://127.0.0.1:7890](http://127.0.0.1:7890)" \
  -e https_proxy="[http://127.0.0.1:7890](http://127.0.0.1:7890)" \
  --entrypoint npx \
  openclaw-cli \
  -y @tencent-weixin/openclaw-weixin-cli@latest install
```

安装后会生成一个二维码，只要使用8.0.70版本的iOS微信扫描，即可完成ClawBot机器人的添加！
![img_1774436332190.png](./img_1774436332190.png)

## 5 问题踩坑与解决方法总结

在这次部署中，博主遇到了一些极其折磨人的报错，以下是排雷合集：

### 坑一：CLI 工具下载超时（`npm ERR! ETIMEDOUT`）

- **现象**：执行安装脚本时网络超时。
- **原因**：即使 NAS 有代理，处于 Bridge 网桥内的容器默认无法访问宿主机的 `127.0.0.1`。
- **解法**：必须使用 `--network host`，并注入宿主机代理的环境变量（见第4章代码）。

### 坑二：控制台连接提示 `disconnected (1006): no reason`

- **现象**：Web 界面配置页点击连接后秒断开。
- **原因**：Web 界面的 WebSocket URL 错误地填了 `wss://localhost:18789`。浏览器会去连接你**当前使用的电脑**的端口，而不是 NAS地localhost。
- **解法**：将 WebSocket URL 改为你的 CF 隧道公网域名（例如 `wss://claw.yourdomain.com`），注意**不带端口号**。

:::warning
此外，这个提示还可能的原因是网断了，请排查你的电脑、CF隧道、NAS的隧道docker、NAS联网情况这四个环节，但凡一个环节有问题就会报此错误。
:::

### 坑三：AI 疯狂空转，几千 Token 瞬间蒸发

- **现象**：日志里每隔 30 分钟出现 `Read HEARTBEAT.md if it exists...`，余额飞速下降。

- **原因**：OpenClaw 的 Autonomous Pulse（自主脉搏）机制在空转。

- **解法**：在交互式配置中关闭，或者直接通过命令硬改配置，然后重启容器：

  ```bash
  docker compose exec openclaw-gateway node dist/index.js config set agent.pulse.enabled false
  ```


## 6. 总结

通过群晖 Docker + OpenClaw + Cloudflare Tunnel 的组合，我们成功打通了底层网络和权限的壁垒，在保证数据隐私的前提下，在群晖NAS上为自己搭建了一个全天候响应的微信 AI 助理。

从 UDP 协议带来的隧道假死，到终端二维码的显示乱码，每解决一个不起眼的 Bug，都让我们对 Linux 网络栈和容器底层机制有了更深的理解。希望这篇“踩坑实录”，能为喜欢折腾的各位提供一份靠谱的工程化部署参考。