---
title: 软化硬路由：小米 AX3000T 原厂固件免刷机开 SSH 与软件持久化部署实践
published: '2026-06-28'
description: >-
  为兼顾信号稳定与米家生态，给新淘的小米AX3000T来一场“不刷机”的极客改造。本文记录了原厂固件下免拆开启SSH、突破空间限制完美固化部署ZeroTier异地组网的全过程，并探讨了tmpfs内存热加载架构。一起巧妙“软化硬路由”，榨干它的每一滴潜能！
author: ''
cover: ./cover.webp
pinned: false
tags:
  - 网络
  - 路由器
  - Linux
  - 软路由
category: 技术备忘
encrypted: false
draft: true
---

前段时间，博主淘到一个小米 AX3000T 路由器，打算拿回家替换已经使用五年多很老旧的 AC2350。不过，博主计划先浅浅折腾一下，结果一查，发现作为一款联发科平台的小米路由，其刷机、折腾的可玩性竟然还算比较大，这是好事儿啊。

那么，博主就计划在拿回家前对其折腾一番，来实现博主之前的一些想法。当然，这个过程中踩了很多坑，下面来分享：



## 1 折腾目标和准备工作

### 1.1 目标

本次折腾要实现如下目的：

- 因为要作为家中的主力路由，追求稳定和完整的米家生态，所以**不刷入 OpenWRT 等其它系统**，保持原厂系统并在其基础之上做所有操作，这番“带着脚镣跳舞”也算是一次比较大的挑战。
- 开启路由器的 SSH。
- 考虑到近期内，博主家中的电信宽带也已经改成了“大内网”（多层 NAT），但具有公网IPv6，所以取消安装 DDNS-GO 的想法，而是直接安装 Zerotier，加入博主的虚拟局域网，并利用公网 IPv6 作为 Moon 节点。
- 尝试安装 Mihomo 并成功运行，同时探索未来接入 Cloudflare 隧道的方法。
- 如果在安装依然遇到和 AC2350 一样的存储瓶颈，那就试着使用热加载并在缓存中运行的形式。

### 1.2 准备

路由器通电长按reset重置，连接电脑（有线/无线均可）和家庭网络，点击“打开浏览器并连接”或输入miwifi.com打开路由器页面。

![image-20260626233233665](./image-20260626233233665.png)

完成初步配置

![image-20260626233544088](./image-20260626233544088.png)

在上网向导中设置WiFi时，记得取消勾选空闲时自动升级。

![image-20260626233624665](./image-20260626233624665.png)

至此我们就进入了路由器的管理页面。从“路由状态”页面可以看到，博主的这个路由器版本是1.0.64

![image-20260626233850271](./image-20260626233850271.png)

为了防止与博主当前用于折腾的网络环境下的主小米路由器产生路由冲突，先改局域网网段到10段。方法是在常用设置-局域网设置中，将局域网IP设置为`192.168.10.1`.保存，重启，重新连接电脑。

当然，如果你是直接接入家中的网络环境，那也可以不必修改，保持`192.168.31.1`的默认设置即可。

![image-20260626234413731](./image-20260626234413731.png)

## 2 打开路由器的 SSH

### 2.1 使用开源项目 xmir-patcher 打开 SSH

项目地址：https://github.com/openwrt-xiaomi/xmir-patcher

将其代码库完整下载到本地，直接从网页下载 ZIP 或是 `git clone`都行，看你心情。

接着Windows以管理员身份运行代码库中的`run.bat`，Linux运行run.sh。界面如下图：

![image-20260627001101006](./image-20260627001101006.png)

设置路由器IP：选择【1】，输入路由器的IP地址，小米路由器默认`192.168.31.1`，但我们这里就要改成`192.168.10.1`了。![image-20260627001329823](./image-20260627001329823.png)

解锁SSH，选择【2】，输入路由器后台管理密码，提交后会输出开启状态。![image-20260627001319521](./image-20260627001319521.png)

修改root密码，选择【8】，再选择【2】修改root密码。不修改也可以，默认的密码就是`root`。

![image-20260627001431303](./image-20260627001431303.png)

持久化 SSH 的运行。因为小米路由器采用xx的系统策略，每次重启都不会保存更改，就像 Windows PE 一样，所以无论是现在开启的SSH，还是后续要安装的所有软件，我们都需要在正常运行后进行一个固化操作，确保开机后可以自动运行。

在界面中选择【6】固化SSH。![image-20260627001515313](./image-20260627001515313.png)

这时候就可以使用SSH工具连接到路由器终端了，博主全程使用MobaXterm，也比较推荐大家使用，因为它可以记住密码，还能直接管理路由器的文件。官网：https://mobaxterm.mobatek.net/

新建会话，连接，输入root密码，出现Banner ARE U OK则成功。

![image-20260627002901824](./image-20260627002901824.png)

如下图，如果提示拒绝连接，可以重启一下路由器再连接。

![image-20260627004301246](./image-20260627004301246.png)

### 2.2 基本状态检查

这时候，我们可以对路由器的基本状态（特别是存储状态）进行检查，以便我们后续的安装操作。

#### 2.2.1 CPU 架构检查

```shell
root@XiaoQiang:~# uname -a
Linux XiaoQiang 5.4.171 #0 SMP Tue Nov 21 06:41:54 2023 aarch64 GNU/Linux
root@XiaoQiang:~# cat /proc/cpuinfo
processor       : 0
model name      : ARMv8 Processor rev 4 (v8l)
BogoMIPS        : 26.00
Features        : fp asimd evtstrm aes pmull sha1 sha2 crc32 cpuid
CPU implementer : 0x41
CPU architecture: 8
CPU variant     : 0x0
CPU part        : 0xd03
CPU revision    : 4

processor       : 1
model name      : ARMv8 Processor rev 4 (v8l)
BogoMIPS        : 26.00
Features        : fp asimd evtstrm aes pmull sha1 sha2 crc32 cpuid
CPU implementer : 0x41
CPU architecture: 8
CPU variant     : 0x0
CPU part        : 0xd03
CPU revision    : 4
```
（分析一下结果，最后说下载软件二进制文件，我们要选择 ARM64 或 aarch64 的。

#### 2.2.2 存储空间检查

```
root@XiaoQiang:~# df -h
Filesystem                Size      Used Available Use% Mounted on
/dev/root                18.3M     18.3M         0 100% /
tmpfs                   119.5M    708.0K    118.8M   1% /tmp
ubi1:cfg                 24.3M    672.0K     22.4M   3% /data
ubi1:cfg                 24.3M    672.0K     22.4M   3% /userdisk
/dev/root                18.3M     18.3M         0 100% /userdisk/data
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/config
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/datacenterconfig
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/smartcontroller
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/parentalctl
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/smartvpn
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/ppp
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/crontabs
ubi1:cfg                 24.3M    672.0K     22.4M   3% /etc/mipctl
tmpfs                   512.0K         0    512.0K   0% /dev
```
这是最重要的一步。从上面检查结果中可以看出xxx。

因为可供我们的持久存储空间只有22.4M，所以我们选择仅将Zerotier本地化，mihomo肯定是放不进去，采用热加载，把119M的缓存空间运用起来。

#### 2.2.3 TUN 检查

```
root@XiaoQiang:~# ls -l /dev/net/tun
crw-------    1 root     root       10, 200 Jan  1  1970 /dev/net/tun
root@XiaoQiang:~# lsmod | grep tun
ip_tunnel              24576  2 ip_gre,sit
ip6_tunnel             36864  1 ip6_gre
ip6_udp_tunnel         16384  1 l2tp_core
tunnel4                16384  1 sit
tunnel6                16384  1 ip6_tunnel
udp_tunnel             16384  1 l2tp_core


```

Zerotier 和 Mihomo的使用都依赖 TUN，之前没在 AC2350装成功有一重要原因就是没有TUN。（分析结果）没有想到小米竟然没把 TUN 阉割掉，这把真是“天胡开局”了！



## 3 Zerotier 的安装和配置

本章我们的总体目标就是：下载zerotier-one，对其使用 UPX 压缩以节省捉襟见肘的 /data 空间，安装后加入虚拟局域网并配置为moon节点。

### 3.1 打开 IPv6 支持

Moon 的核心作用是**帮助没有公网 IP 的设备互相发现并打通直连**，**所以需要节点设备有公网IP**。目前家宽通常处于“大内网（多层 NAT）”，没有公网 IPv4 ，但是有公网IPv6，所以将它作为 Moon 需要打开IPv6并允许外部设备通过 IPv6 访问路由器。

进入路由器管理-常用设置-上网设置，打开IPv6网络设置，上网方式为“自动配置”即可，关闭“IPv6防火墙”。

![image-20260627132835244](./image-20260627132835244.png)

### 3.2 下载 zerotier-one 并使用 UPX 压缩

由于我们计划在data分区直接放zerotier二进制文件，考虑到只剩22.4MB，所以要对zerotier二进制文件进行压缩。

在Windows上下载并解压UPX：https://github.com/upx/upx/releases/download/v5.2.0/upx-5.2.0-win64.zip

下载zerotier-one，由于官方仓库只提供源码下载，没有可现成使用的aarch64的编译版本，所以我们去https://github.com/rafalb8/ZeroTierOne-Static/releases

下载最新的aarch64静态编译版本tar.gz。

![image-20260627134927027](./image-20260627134927027.png)

下载后打开，将压缩包bin文件夹下的zerotier-one文件解压到upx目录

![image-20260627135230423](./image-20260627135230423.png)

在upx目录空白处右击打开终端，运行命令：

`upx --best zerotier-one`

![image-20260627135336455](./image-20260627135336455.png)

最终压缩后的zerotier-one只有923KB

![image-20260627135358725](./image-20260627135358725.png)

### 3.3 导入并安装 zerotier-one

在mobaxterm的ssh浏览窗口，进入路由器data目录，导入刚刚准备好的zerotier-one文件

![image-20260627135632204](./image-20260627135632204.png)

随后在 SSH 终端中执行以下命令：

```shell
# 1. 进入工作目录并赋予执行权限
cd /data
chmod +x zerotier-one

# 2. 创建专属的配置持久化目录
mkdir -p /data/zerotier

# 3. 核心机制处理（通过软链接触发 CLI 模式）
# ZeroTier 是一个单文件程序，它依靠读取命令行的 argv[0]（即自身被调用的名字）来决定是作为服务端运行，还是作为控制台工具运行。由于小米系统的 /usr/bin 无法写入，我们在 /data 下创建软链接来“欺骗”它。
ln -s /data/zerotier-one /data/zerotier-cli
ln -s /data/zerotier-one /data/zerotier-idtool

# 4. 首次后台启动守护进程（强制指定配置目录）
/data/zerotier-one -d /data/zerotier
```

看到类似下图的输出，就说明zerotier已经成功跑起来了。

![image-20260627140404007](./image-20260627140404007.png)

### 3.4 加入自己的虚拟局域网

因为 SSH画面会一直卡在上图，所以推荐大家重新进一下 SSH 会话。

接着去zerotier网页，复制你的局域网ID，输入以下命令，加入你的局域网：

```
# 加入网络。注意：必须带上 -D 参数告诉 CLI 工具去哪里找鉴权 Token，6**************d替换为你的16位网络 ID
/data/zerotier-cli -D/data/zerotier join 6**************d
```

看到下图的`200`信息，回到zerotier网页，授权一下，给一个固定ip，这样就成功加入啦！

![image-20260627140934513](./image-20260627140934513.png)



![image-20260627140953874](./image-20260627140953874.png)

### 3.5 Moon 节点的设置

#### 3.5.1 创建 Moon 节点

注意：这一步请在正式接入你的目标网络环境后再做，因为涉及到了公网 IP。

首先查找公网ipv6地址，进入路由器管理页面，在首页“路由状态”点击“互联网状态”，复制“WAN IPv6地址”备用。**注意，地址后面可能会有`/64 /128`这类后缀，复制时不要把后缀复制进去！ **

![image-20260627142405165](./image-20260627142405165.png)

然后回到ssh，输入命令，提取公钥并生成基础 moon.json 模板。

```
/data/zerotier-idtool initmoon /data/zerotier/identity.public >> /data/zerotier/moon.json
```
然后在 MobaXterm 左侧的文件浏览器中，双击进入 /data/zerotier/ 目录。找到 moon.json 文件，直接双击它，MobaXterm 会调用内置的文本编辑器打开。向下滚动寻找 `"roots"` 数组。需要修改其中的 `"stableEndpoints"` 字段。本身是空的，需要先输入一对英文引号，在其中输入刚才复制的v6地址，后面加一个端口号“/9993”，如下图。

然后保存。出现覆盖提示选择“是”。

![image-20260627142753421](./image-20260627142753421.png)

签名并生效配置：回到 MobaXterm 的 SSH 终端中，依次执行以下命令，并重启服务：


```
# 利用修改好的 json 编译生成签名文件 (000000xxxx.moon)
/data/zerotier-idtool genmoon /data/zerotier/moon.json

# 创建 Moon 存放目录并移入
mkdir -p /data/zerotier/moons.d
mv 000000*.moon /data/zerotier/moons.d/

# 杀掉进程并重启，使其加载 Moon 配置
killall zerotier-one
/data/zerotier-one -d /data/zerotier
```

至此，这台 AX3000T 就已经是一台合格的 IPv6 Moon 节点了。

#### 3.5.2 为其他设备添加 Moon 节点

首先获取这台路由器的zerotier ID：在终端输入：

```
/data/zerotier-cli -D/data/zerotier info
```

执行后，终端会返回类似这样的一行信息：

> ```
> 200 info a1b2c3d4e5 1.14.2 ONLINE
> ```

中间那串 **10 位由字母和数字组成的字符串**（例如示例中的 `a1b2c3d4e5`），就是这台路由器的 **ZeroTier ID**。

后续你只需要在其它运行 ZeroTier 客户端的电脑/服务器终端中，执行 `zerotier-cli orbit <这台路由器的ZeroTier ID> <这台路由器的ZeroTier ID>`，就可以享受到它的辅助打洞加速服务了。

### 3.6 持久化运行设置

#### 3.6.1 持久化运行的原理

这里详细讲一下我们借用了xmir-patcher的逻辑，使用UCI注入防火墙生命周期的方法实现持久化运行的内容。并说明，后续我们所有软件的持久化都需要这么做。

#### 3.6.2 编写 ZeroTier 启动脚本

为了不把配置写得太乱，我们在 `/data` 下单独建一个 ZeroTier 启动脚本。

1. 在 MobaXterm 左侧进入 `/data` 目录。
2. 右键点击空白处，选择 **"New empty file" (新建空文件)**，命名为 `start_zt.sh`。
3. 双击打开 `start_zt.sh`，将以下代码粘贴进去：

```
#!/bin/sh

# 等待 10 秒，确保系统的底层网络（网卡、TUN模块）已经初始化完毕
sleep 10

# 检查进程是否存在，避免防火墙重载时重复启动产生僵尸进程
if ! pgrep -f "/data/zerotier-one" > /dev/null; then
    # 强制后台运行，并指定配置文件目录
    /data/zerotier-one -d /data/zerotier
    
    # 顺手往系统日志里写一条记录，方便以后排错
    logger -t "ZeroTier-Patcher" "ZeroTier initialized from /data"
else
    logger -t "ZeroTier-Patcher" "ZeroTier is already running"
fi
```

4. 重要的一步：如下图，编辑完后，一定要在上方的“格式”菜单中选择“Linux / Unix”，以免造成换行符冲突。![image-20260627173724786](./image-20260627173724786.png)

保存并关闭文件。在终端中执行命令，赋予它可执行权限：

```
chmod +x /data/start_zt.sh
```

### ### 3.6.3 添加防火墙规则

在终端中运行下面几行代码：

```
# 1. 新建一个名为 zerotier 的防火墙脚本包含规则
uci set firewall.zerotier=include

# 2. 指定类型为 shell 脚本
uci set firewall.zerotier.type='script'

# 3. 指向我们刚才写好的自启脚本路径
uci set firewall.zerotier.path='/data/start_zt.sh'

# 4. 启用该规则
uci set firewall.zerotier.enabled='1'

# 5. 提交并保存修改到闪存（这一步极其关键，确保重启不丢失）
uci commit firewall
```

完成后执行`cat /etc/config/firewall`，如图，可见末尾增加了zerotier配置，添加成功。

![image-20260627150943737](./image-20260627150943737.png)

### ### 3.6.4 重启验证

持久化配置完成后，最稳妥的验证方式就是直接拔电源或软重启。

在终端输入：

```
reboot
```

等待路由器重启完成，再次用 MobaXterm 连接上 SSH，执行以下命令：

```
# 检查进程是否自动拉起
ps -w | grep zerotier

# 检查网络是否正常打通
/data/zerotier-cli -D/data/zerotier listpeers
```

如果进程存在，且节点列表正常输出，类似于下面，恭喜你！ZeroTier 成功部署！它现在已经像原厂服务一样扎根在这台 AX3000T 里了。

```
root@XiaoQiang:~# ps -w | grep zerotier
 2185 root     30684 S    /data/zerotier-one -d /data/zerotier
10406 root      1464 S    grep zerotier
root@XiaoQiang:~# /data/zerotier-cli -D/data/zerotier listpeers
200 listpeers <ztaddr> <path> <latency> <version> <role>
200 listpeers 68bea79acf 35.209.29.203/34689;6247;6247 247 1.16.2 LEAF
200 listpeers 778cde7190 103.195.103.66/9993;7634;67386 254 - PLANET
200 listpeers cafe04eba9 84.17.53.155/9993;2634;37366 183 - PLANET
200 listpeers cafe80ed74 185.152.67.145/9993;7634;40215 194 - PLANET
200 listpeers cafefd6717 79.127.159.187/9993;7634;67420 219 - PLANET
s
```



最后注意：所有对zerotier的操作命令都需要加配置目录“-D/data/zerotier”



## 4 Mihomo 的热安装

### 4.1 热加载

（本节要点）接下来安装 Mihomo，但由于 Mihomo 的原始二进制文件普遍在25 MB左右，即使UPX极限压缩，也只能做到 8MB左右，还是会浪费捉襟见肘的空间。所以我们尝试使用“热加载”的手段。

然后具体介绍我们的热加载的方案思路：固化 Mihomo 配置，使用脚本在路由器开机时直接从 Github 镜像站拉取指定的Mihomo 二进制文件和国内IP/站点数据库到 tmp分区开辟的空间中，运行也在这其中完成。等等，介绍一下。

至于Mihomo内核的管理，我们可以在局域网内部署一个MetacubeXD，连接路由器9090端口即可。



### 4.2 Mihomo 配置的构建

mobaxterm添加clash目录，新建空白config.yaml，复制配置进去，编码选择UTF8默认，系统选择Linux，保存：

```
# ================= 底层与面板配置 =================
port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
ipv6: false # 为了避免大内网IPv6路由黑洞，透明代理通常建议先关闭IPv6劫持

# 核心：对外暴露控制 API（面板就是连这个端口）
external-controller: 0.0.0.0:9090
secret: "ybjun666" # 【必须修改】面板连接密码，防止局域网内其他人乱改

# ================= DNS 与 TUN 配置 =================
dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 223.5.5.5
    - 114.114.114.114

tun:
  enable: true
  stack: system
  auto-route: true
  auto-detect-interface: true

# ================= 动态订阅链接配置 =================
proxy-providers:
  Sub_1:
    type: http
    url: "https://你的第一个订阅链接.com/xxxxx" # 【修改为你的真实链接】
    interval: 86400 # 每 24 小时自动后台更新一次
    path: ./providers/sub1.yaml # 下载后存储在 /tmp/clash/providers 内存中
    health-check:
      enable: true
      interval: 600
      url: http://www.gstatic.com/generate_204

  Sub_2:
    type: http
    url: "https://你的第二个订阅链接.com/xxxxx" # 【修改为你的真实链接】
    interval: 86400
    path: ./providers/sub2.yaml
    health-check:
      enable: true
      interval: 600
      url: http://www.gstatic.com/generate_204

# ================= 策略组配置 =================
proxy-groups:
  - name: "🚀 手动切换"
    type: select
    use:
      - Sub_1
      - Sub_2

  - name: "⚡ 自动优选"
    type: url-test
    use:
      - Sub_1
      - Sub_2
    url: http://www.gstatic.com/generate_204
    interval: 300

# ================= 路由分流规则 =================
rules:
  # 白名单：确保你家局域网和NAS的访问绝对不绕路
  - GEOIP,LAN,DIRECT
  - DOMAIN-SUFFIX,ybjun.com,DIRECT 
  
  # 核心规则：国内流量直连
  - GEOSITE,CN,DIRECT
  - GEOIP,CN,DIRECT
  
  # 兜底规则：没有匹配到国内特征的，全部走你选择的节点
  - MATCH,🚀 手动切换
```

### 4.2 编写 tmp 热加载脚本

在 `/data` 目录下新建 `start_clash.sh`，写入以下代码：
