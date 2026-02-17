---
title: 基于CF Workers从零构建TOTP认证系统
published: '2026-02-17'
description: 本文详细介绍如何利用 Cloudflare Workers 作为后端，手写 TOTP 核心算法，实现两步认证（2FA）的流程。
author: ''
cover: ''
pinned: false
tags:
  - 计算机
  - 网络
category: 技术备忘
encrypted: false
draft: false
---

在当今的 Web 应用开发中，账号安全至关重要。虽然市面上有许多成熟的身份验证服务，但作为一个技术爱好者，了解其背后的原理并亲手实现一套 **Serverless 架构的 TOTP（基于时间的一次性密码）** 验证系统，不仅能降低依赖成本，更是对加密算法的一次认识实践。

本文将详细介绍如何利用 **Cloudflare Workers** 作为后端，手写 TOTP 核心算法，实现一套完整的认证流程。

## 需求与架构设计

我们的目标是构建一个轻量级、无服务器的验证系统，不依赖任何第三方身份验证平台。

* **核心功能**：
    * **服务端**：负责生成密钥、生成用于绑定 App 的二维码链接、以及核心的 TOTP 验证逻辑。
    * **客户端（绑定端）**：展示二维码，让用户使用手机验证器 App 扫描绑定。
    * **客户端（登录端）**：验证码输入界面，请求服务端验证。
* **技术栈**：
    * **后端**：Cloudflare Workers。
    * **前端**：原生 HTML/JS + QRious (二维码生成库)。
    * **协议**：标准 TOTP (RFC 6238)。



## TOTP 算法详细介绍

TOTP 是基于 **HMAC-SHA1** 算法的，它实际上是 **HOTP (HMAC-Based One-Time Password)** 的一个变种，只是将“计数器”替换为了“时间戳”。

### 算法步骤详解

1.  **共享密钥 (Secret)**：服务端和客户端共同持有一个密钥。为了方便输入和传输，通常使用 Base32 编码（如 `JODWY3EPZ4PV3PXP`）。
2.  **获取时间计数 (T)**：
    * 获取当前的 Unix 时间戳（秒）。
    * 将其除以步长（通常为 30 秒），向下取整。
    * 得到一个 8 字节的整数 $T = \lfloor \frac{CurrentTime}{30} \rfloor$。
3.  **哈希计算**：使用共享密钥作为 Key，时间计数 $T$ 作为 Message，计算 HMAC-SHA1 哈希值。
    * $Hash = \text{HMAC-SHA1}(Secret, T)$
4.  **动态截断 (Dynamic Truncation)**：
    * 取哈希值最后一个字节的低 4 位作为偏移量 $offset$。
    * 从哈希值的第 $offset$ 个字节开始，连续取出 4 个字节。
    * 丢弃最高位（防止被解释为负数），得到一个 31 位的无符号整数。
5.  **生成数字**：将该整数对 $10^6$ 取模，即可得到最终的 6 位动态验证码。



## 后端实现：CF Worker

假设我们将 Worker 部署在 `totp.example.com`，将`JBSWY3DPEHPK3PXP`作为示例密钥。
在创建完成新的Worker后，要先为Worker创建一个新的变量叫做`TOTP_SECRET`来存储你的密钥，当然你也可以使用D1数据库存储密钥，这样配合前端可以轻松生成多个不同的密钥，以便使用多套认证。之后就开始写代码了。

### 3.1 完整源码 (`worker.js`)

```javascript
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    // 路由：获取绑定配置
    if (url.pathname === "/config" && request.method === "GET") {
      const secret = env.TOTP_SECRET; // 示例密钥
      const issuer = "MySecureSystem"; // 认证的网站或平台名称
      const account = "admin@example.com"; // 帐户名
      const otpauth = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`;
      
      return new Response(JSON.stringify({ otpauth }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 路由：验证请求
    if (url.pathname === "/verify" && request.method === "POST") {
      const { code } = await request.json();
      const isValid = await verifyTOTP(code, env.TOTP_SECRET || "JBSWY3DPEHPK3PXP");

      return new Response(JSON.stringify({ success: isValid }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};

// TOTP 验证核心算法
async function verifyTOTP(token, secret) {
    if (!token || !secret) return false;

    // 1. Base32 编码密钥转换为二进制
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = "";
    for (let i = 0; i < secret.length; i++) {
        const val = base32chars.indexOf(secret.charAt(i).toUpperCase());
        bits += val.toString(2).padStart(5, '0');
    }
    const hex = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        hex.push(parseInt(bits.substr(i, 8), 2).toString(16).padStart(2, '0'));
    }
    const keyBytes = new Uint8Array(hex.length);
    for(let i=0; i<hex.length; i++) keyBytes[i] = parseInt(hex[i], 16);

    const epoch = Math.floor(Date.now() / 1000.0);
    const time = Math.floor(epoch / 30);
    
    // 验证当前和前一个时间窗口
    for (let t of [time, time - 1]) {
        const timeBuf = new ArrayBuffer(8);
        new DataView(timeBuf).setUint32(4, t, false); 

        const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', key, timeBuf);
        const hmac = new Uint8Array(signature);
        const offset = hmac[hmac.length - 1] & 0xf;
        const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
        if ((binary % 1000000).toString().padStart(6, '0') === token) return true;
    }
    return false;
}
```

### 3.2 代码模块设计解析

* **CORS 模块**：通过 `corsHeaders` 确保前端页面能够跨域请求 Worker 接口。
* **路由分发**：`/config` 负责将环境变量中的密钥包装成 `otpauth://` 协议，这是身份验证器 App 通用的标准协议。
* **Base32 解码器**：TOTP 密钥标准是 Base32。代码中手动将 5 位二进制映射转为 8 位字节流，这是算法能运行的前提。
* **Web Crypto 调用**：利用 Workers 原生的 `crypto.subtle` 库，在边缘节点高性能完成 HMAC 签名。
* **双窗口校验**：为了应对网络延迟或客户端时间偏差，代码同时校验了当前和上一个 30 秒窗口的验证码。


## 前端实现：绑定端

此页面用于展示二维码，完成手机 App 的初始化绑定。

### 实现思路
通过 `fetch` 获取后端生成的协议字符串，利用 `QRious` 库在 Canvas 上绘制二维码。

```html
<div class="setup-container">
    <h3>设备绑定</h3>
    <canvas id="qr-code"></canvas>
    <button onclick="loadQR()">生成二维码</button>
</div>

<script src="[https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js](https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js)"></script>
<script>
    async function loadQR() {
        const res = await fetch('[https://totp.example.com/config](https://totp.example.com/config)');
        const { otpauth } = await res.json();
        new QRious({
            element: document.getElementById('qr-code'),
            value: otpauth, // 传入Worker生成的url
            size: 200
        });
    }
</script>
```

## 前端实现：登录端

这是用户输入验证码的极简界面。实现思路是：监听用户输入，当达到 6 位时或点击验证时，通过 POST 请求将代码发送至 Worker。

```html
<div class="login-box">
    <input type="text" id="otp-input" placeholder="000000" maxlength="6">
    <button onclick="doVerify()">验证</button>
</div>

<script>
    async function doVerify() {
        const code = document.getElementById('otp-input').value;
        const res = await fetch('[https://totp.example.com/verify](https://totp.example.com/verify)', {
            method: 'POST',
            body: JSON.stringify({ code })
        });
        const result = await res.json();
        alert(result.success ? "成功" : "失败");
    }
</script>
```

## 总结

自造 TOTP 验证系统并非难事。通过 Cloudflare Workers，我们能够以极低的成本构建了一套安全、标准且完全受控的双因素认证体系实例。这种“Serverless 后端 + 边缘计算加密 + 原生前端”的模式，是轻量级应用安全方案的理想选择。