# 博客内容编辑约定

## 多级分类

一篇文章属于一条分类路径，可以使用以下任一种写法：

```yaml
category: 技术 / Cloudflare / Workers
```

```yaml
category:
  - 技术
  - Cloudflare
  - Workers
```

数组表示父类到子类的层级，不表示三个独立分类。路径字符串以空格、斜杠、空格（` / `）分隔。CMS 会逐级显示并保存为路径字符串。旧单层分类保持兼容，留空表示未分类。

侧栏显示父分类及其全部子分类的文章总数；父分类归档包含整棵子树。分类继续使用 `/archive/category/父类/子类/`，标签继续使用 `/archive/tag/标签/`。

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
