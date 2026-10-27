# 本站字体分片工具

为博客制作可复现的霞鹜文楷 Web 字体分片。固定使用官方 [lxgw/LxgwWenKai-Screen](https://github.com/lxgw/LxgwWenKai-Screen) 的 `LXGWWenKaiScreen.ttf`、`LXGW WenKai Screen`、Regular 400。

程序在手动运行时获取上游最新正式版本，按固定字符名单生成 WOFF2、CSS 和加载清单，校验后备份并导入博客。它不重新计算字符分组，也不执行 Git commit、push 或合并。

## 使用

需要 Windows 和 Python 3.12。首次运行会在本目录创建 `.venv`，并安装 `requirements.txt` 锁定的 FontTools、Brotli 和 PyYAML。

在文件管理器中双击 **`run.cmd`** 即可更新并导入；也可以在博客仓库根目录执行：

```powershell
.\font-slicer\run.ps1 update

# 只生成与校验，不导入博客
.\font-slicer\run.ps1 update --no-import

# 固定一个版本，便于复现
.\font-slicer\run.ps1 build --tag v1.530
```

以下命令从 `font-slicer` 目录执行：

```powershell
# 只下载指定字型的上游最新版
.\run.ps1 fetch

# 校验已有分片；加 --source 可同时比较源字体的字宽与轮廓
.\run.ps1 validate .\builds\对应版本目录 --source .\cache\upstream\v1.530\LXGWWenKaiScreen.ttf

# 导入已有结果；默认导入本工具所在的博客仓库
.\run.ps1 import .\builds\对应版本目录

# 检查固定名单与某版源字体的覆盖关系
.\run.ps1 check-rules --source .\cache\upstream\v1.530\LXGWWenKaiScreen.ttf

# 运行工具回归测试，不需要真实字体下载
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

下载使用系统代理环境变量。GitHub API 限流时会改从官方 Release 重定向识别最新版，不需要配置 GitHub Token。始终记录完整 SHA-256 并核对内部字型、字重和版本；官方提供文件 digest 时额外核对该值。

`config.json` 的 `frontend_relative` 相对于本工具的父目录，默认 `.` 即博客仓库本身，与启动时的工作目录无关。`rules_relative` 相对于本工具目录，当前为 `rules/r2`。

## 四层固定名单

当前规则为 `rules/r2/rules.json`，共 191 个分片。字符清单每行以 `U+XXXX` 开头，后面的字符与说明便于人工阅读；程序以第一列码点决定实际归属。

| 层级 | 文件 | 当前规模 | 依据 |
| --- | --- | --- | --- |
| 主分片 | `core.txt` | 1000 字，1 片 | 固定 UI、ASCII、常用标点、通用常用字、现有文章/日记标题和分类标签等 |
| 其余常用汉字 | `gb2312-*.txt` | 5938 字，47 片，每片至多 128 字 | 初稿按现有正文频率排序后冻结 |
| 其他汉字 | `han-rare-*.txt` | 24551 字，96 片 | 先安排本站出现的字，再保留其余汉字 |
| 外语和符号 | `other-*.txt` | 16394 字，47 片 | 按文字系统与字符范围分组 |

上述数量对应源字体 v1.530，完整保留 47883 个常规 Unicode 字符及 41 条变体序列。原始试验 r1 的 GB2312 分片为 384 字；r2 保持原排序和主片不变，仅将这一层细分。仓库中只保存当前使用的 r2 名单。

**日常 update/build 从不调用 `prepare_rules.py`，也不重新统计字频或重排名单。** `program/prepare_rules.py` 是起草初版名单的辅助程序，会拒绝覆盖已有规则；不属于日常更新流程。

字体更新时：

- 新增字符按固定 Unicode 窗口进入独立的 `new-han-*` / `new-other-*` 尾部分片，现有主片与名单不变，清单写入 `reports/new-characters.json`。
- 上游缺失既有字符时停止导入，写出 `reports/character-review-required.json`，交由人工处理。
- 相同字体、规则和制作依赖会复用已校验的构建，避免重复制作。

## 手动调整规则

可以移动清单中的整行，或在 `rules.json` 中新增分片记录。一个码点只能归属一片；二级必须是 GB2312 汉字，三级为其他汉字，四级为非汉字。当前主片允许 800–1100 字。

较大的调整建议复制成 `rules/r3`，将其中的 `revision` 改为 `r3`，先显式试验：

```powershell
.\run.ps1 build --rules .\rules\r3 --tag v1.530
```

验证后修改 `config.json` 的 `rules_relative` 即可。规则哈希参与生成发布标识，新的名单不会覆盖已有版本目录。

## 导入和校验

每套构建会产生字体发布目录、完整 `result.css`、前端加载用 `manifest.json`、官方许可、构建清单及验证记录。

制作时核对每片的实际字符集合、字型与字重，比较全部字符的字宽/边距；抽验轮廓，主片逐字比较；检查源字体的 Unicode 变体序列完整保留。导入时检查完整文件哈希，同名发布目录的字体二进制必须一致；仅允许 CSS/许可文本因 Git 检出产生的 CRLF/LF 等价转换。

默认写入仓库的 `public/assets/LXGWWenKai/`，更新入口 CSS、manifest、说明和许可，并只替换 `twilight.config.yaml` 中字体 CSS 的版本地址。其他 YAML 设置保持原样，OG 使用的完整字体由现有逻辑单独管理。旧字体资源保留，兼容浏览器尚未过期的 CSS 缓存。入口更新前会备份，写入失败自动恢复。

前端已通过 `fontLoader.astro` 接入主片内联声明和单个高优先级 preload。非主片由浏览器按 `unicode-range` 原生并行请求，层级不代表串行队列。`font-display: swap`、本地字体优先、完整 CSS 异步加载、noscript 和系统字体回退均保留。

## 哪些内容进入 Git

```text
program/        制作程序与初稿辅助程序
rules/r2/       当前固定字符名单
tests/          小型合成字体回归测试
config.json     相对路径与规则选择
requirements.txt
run.cmd / run.ps1
README.md / .gitignore
```

本目录的 `.gitignore` 排除 `.venv`、下载的字体源文件、`cache/`、`builds/`、`backups/`、`reports/`、日志、临时文件与 Python 缓存；额外排除本目录下的 TTF/OTF/WOFF 等字体二进制。需要随博客发布的最终字体仍正常保存在仓库 `public/assets/LXGWWenKai/`，不受本工具目录的忽略规则影响。

制作程序不会自动提交字体更新。完成检查后，可以将工具源码、固定规则及前端字体产物与其他博客修改一起手动提交。
