# 博客内容编辑约定

## 多级分类

一篇文章属于一条分类路径，可以使用以下任一种写法：

```yaml
category: 网络 / 组网与路由
```

```yaml
category:
  - 网络
  - 组网与路由
```

数组表示父类到子类的层级，不表示多个并列分类。路径字符串以空格、斜杠、空格（` / `）分隔。CMS 会逐级显示并保存为路径字符串。旧单层分类保持兼容，留空表示未分类。

侧栏显示父分类及其全部子分类的文章总数；父分类归档包含整棵子树。分类继续使用 `/archive/category/父类/子类/`，标签继续使用 `/archive/tag/标签/`。

分类按主题组织：网络下使用建站、Cloudflare、域名、组网与路由；计算机下使用系统与硬件、服务器与 NAS、软件服务；另保留小作品、随想、资源。标签通常选择一个文章性质（技术备忘、经验分享、学习笔记、随笔），再增加核心主题词；主题标签可以与分类重合。全部文章的调整记录见 [分类与标签规范](./article-taxonomy.md)。

CMS 分类逐级提供可编辑下拉建议，子级随父级变化；标签支持按当前逗号分隔项搜索并连续选择，也可输入新词。建议词包含现有文章和草稿，文章管理页加载后会更新本机建议缓存。

## 侧栏按页面显示

在 `twilight.config.yaml` 的组件配置上添加可选 `visibility`。`paths` 使用正则表达式，匹配去掉末尾斜杠的路径（首页仍为 `/`）。省略规则则保持原有显示。

```yaml
- type: categories
  position: sticky
  depth: 3
  visibility:
    mode: include
    paths: ['^/$', '^/archive(?:/|$)']
- type: tags
  position: sticky
  visibility:
    mode: exclude
    paths: ['^/posts(?:/|$)']
```

`include` 仅在匹配页面显示；`exclude` 在匹配页面隐藏。统计、访客信息和 TOC 保留本站实现，仅外层读取显示规则。

## 文章作者、来源与评论

```yaml
author: ''
sourceLink: ''
comment: true
```

作者和原文链接可留空，分别使用站点作者、本站文章链接。`comment` 默认开启；设置 `false` 后编译时省略整块评论组件。文章统一使用站点配置的 CC BY-NC-SA 4.0，CMS 不提供单篇许可编辑。

## 正文元素

剧透文本支持内部 Markdown，桌面悬停、点击或键盘聚焦可以查看：

指令仅转换已注册的剧透、音乐、GitHub 卡片和提示框；普通时间 `01:16`、比例 `16:9` 及未知指令会保留原文。

```md
The content :spoiler[is hidden **ayyy**]!
```

CMS 音乐按钮直接插入下面的指令，填写实际资源地址即可：

```md
::music{title="歌曲名" artist="歌手" cover="https://cdn.example.com/cover.jpg" audio="https://cdn.example.com/song.mp3" lrc="https://cdn.example.com/song.lrc"}
```

支持完整 HTTPS 资源地址和 `/assets/…` 站内静态地址。官方相对路径 `assets/music/song.mp3` 对应 `public/assets/music/song.mp3`。歌词可选；远程歌词需要允许跨域访问。也保留手写 `meting` 指令的兼容能力，返回多首时取第一首。音乐卡片独立于关闭的全站背景播放器。

CMS 视频入口支持 Bilibili、YouTube、其他平台嵌入地址及原生视频直链。电脑文件先放入 `public` 或上传存储桶，再使用部署后的地址。原生视频示例：

```html
<video controls playsinline preload="metadata">
  <source src="https://cdn.example.com/video.mp4" type="video/mp4">
</video>
```

视频 HTML 前后保留空行，避免紧随其后的 Markdown 被当作 HTML 块。

## 复制保护

```yaml
copyProtection:
  blockSelection: false
  blockClipboard: false
  blockContextMenu: false
  blockDevTools: false
```

四项独立控制正文选择、剪贴板操作（含代码复制按钮）、正文右键菜单、常见开发者工具快捷键。输入框保持可用；切页解除上一页限制。`blockDevTools` 仅限制快捷键，不能真正禁止浏览器开发者工具。CMS 在独立模态框中配置。

## 分享图片与保留能力

默认开启 OG 图片生成，每篇已发布文章生成中文分享卡片；首页等页面使用站点默认卡片。Twitter 与 Open Graph 使用同一图片。图片在构建时离线生成，不在 Worker 中运行 Sharp。

项目页保留空占位；技能、历程、旧静态相册与追番实现已移除。自建 Gallery 正常保留。展柜能力位于 `src/features/exhibition`，未注册路由。

粒子、全站背景音乐、看板娘等原有关闭功能继续保留。翻译、看板娘、Twikoo 的后续剥离应独立处理：

- 翻译服务加载与全站 `i18n()` 文案接口是不同层次。先移除服务和入口，再评估裁剪外语字典；中文文案接口暂需保留。
- 看板娘仍被基础布局、配置类型和配置导出引用，删除时需要一起解除这些依赖。
- 旧 Twikoo 组件没有实际调用，但配置解析仍读取它的可选配置。未来剥离时需保留自建评论组件依赖的总开关。

内容目录树与通用正文媒体懒加载本次不接入。
