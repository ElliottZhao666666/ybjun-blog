"""One-time, explicit rule draft creation. Refuses to overwrite an existing rules revision."""
from __future__ import annotations
import argparse
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from fontTools.ttLib import TTFont
from fontTools.unicodedata import script
import yaml
from font_slicer import BASE, FAMILY, PackagingError, font_metadata, is_han, is_gb2312_han, sha256, write_json

UI_SEED = """首页文章相册日记胖哥出品朋友们关于搜索分类标签目录更多展开收起返回顶部上一页下一页
站点数据文章数目已运行总字数本站访客数总访问量最后更新天年个月分钟前刚刚未知
主题色亮色暗色跟随系统横幅壁纸全屏纯背景随背景图自动调整当前色值
上午好早上好中午好下午好晚上好夜深了早点休息保持高效专注喝杯茶继续加油享受悠闲时光
操作系统浏览器您的网络接入信息仅在本地展示不涉及隐私存储欢迎访问连接超时数据获取失败
评论留言昵称邮箱网址内容发送提交审核通知订阅结果和新回复取消成功未通过请输入必填匿名用户
加载时间较长可能是环境导致您可以刷新页面或换一个域名继续图片查看关闭下载原图暂无内容
发表时间更新发布于字阅读预计分钟复制代码链接分享音乐歌词播放暂停上一首下一首音量循环列表
生活碎碎念与即时分享个人名片公告留言板简介提示注意警告推荐资源清除重置确认设置选择所有
"""
# Explicit hand-maintained basic characters, not a claim to be an official frequency standard.
GENERAL_SEED = """的一是不了在人有我他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工己话儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东海口使信西再平真听世气每并提关入先性各求白六水九百万应路由光色山早晚友更"""
PUNCTUATION = "，。！？：；、‘’“”（）【】《》〈〉〔〕［］｛｝「」『』…—·～￥％＃＆＊＋－／＝＠＼｜＾＿｀±×÷≠≤≥∞√≈℃℉°‰→←↑↓↔"


class FixedUIParser(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
    def __init__(self):
        super().__init__()
        self.stack = []
        self.parts = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        parent_capture = self.stack[-1][1] if self.stack else False
        parent_skip = self.stack[-1][2] if self.stack else False
        capture = parent_capture or attrs.get("id") in {"navbar", "left-sidebar", "right-sidebar", "mobile-sidebar", "banner-wrapper"} or tag == "footer" or "footer" in attrs.get("class", "").split()
        skip = parent_skip or tag in {"script", "style", "noscript", "template"}
        if tag not in self.VOID:
            self.stack.append((tag, capture, skip))
    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break
    def handle_data(self, data):
        if self.stack and self.stack[-1][1] and not self.stack[-1][2]:
            self.parts.append(data)


def markdown_document(path):
    raw = path.read_text(encoding="utf-8-sig")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", raw, re.S)
    metadata = yaml.safe_load(match.group(1)) or {} if match else {}
    body = raw[match.end():] if match else raw
    body = re.sub(r"(?ms)^```.*?^```[^\n]*", "", body)
    body = re.sub(r"https?://\S+", "", body)
    return metadata, body


def char_row(cp, reason=""):
    character = chr(cp)
    display = character if character.isprintable() and not character.isspace() else repr(character)
    return f"U+{cp:04X}\t{display}\t{reason or unicodedata.name(character, 'UNNAMED')}"


def create_rules(frontend: Path, source: Path, output: Path, core_size: int):
    if (output / "rules.json").exists():
        raise PackagingError("规则已存在。此起草工具不会覆盖；请新建规则版本或手动编辑名单。")
    metadata = font_metadata(source)
    with TTFont(source) as font:
        coverage = set(font.getBestCmap())
    body_frequency, title_frequency, metadata_frequency = Counter(), Counter(), Counter()
    documents = []
    for path in sorted((frontend / "src/content/posts").rglob("*.md")):
        front, body = markdown_document(path)
        if front.get("draft"):
            continue
        title_frequency.update(str(front.get("title", "")))
        for key in ["tags", "category", "description"]:
            value = front.get(key, "")
            text = " ".join(str(x) for x in value) if isinstance(value, list) else str(value)
            metadata_frequency.update(text)
        body_frequency.update(body)
        documents.append(path.relative_to(frontend).as_posix())
    for path in sorted((frontend / "src/content/diary").rglob("diary.json")):
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        title_frequency.update(data.get("title", ""))
        body_frequency.update(data.get("content", ""))
        documents.append(path.relative_to(frontend).as_posix())
    config = yaml.safe_load((frontend / "twilight.config.yaml").read_text(encoding="utf-8-sig"))
    fixed_text = UI_SEED + config["site"].get("title", "") + config["site"].get("subtitle", "") + config.get("profile", {}).get("name", "") + config.get("profile", {}).get("bio", "")
    baseline = frontend / "dist/sidebar-data-final/index.html"
    if baseline.exists():
        parser = FixedUIParser()
        parser.feed(baseline.read_text(encoding="utf-8"))
        fixed_text += "".join(parser.parts)
    mandatory = {cp for cp in range(32, 127) if cp in coverage}
    mandatory |= {ord(ch) for ch in fixed_text + PUNCTUATION if ord(ch) in coverage and (is_han(ord(ch)) or ch in PUNCTUATION)}
    # Keep common decomposed Latin accents with the ASCII base letters.
    mandatory |= {cp for cp in [0x300, 0x301, 0x302, 0x303, 0x304, 0x306, 0x307, 0x308, 0x30A, 0x30C, 0x327, 0x328] if cp in coverage}
    if len(mandatory) > core_size:
        raise PackagingError(f"固定 UI 等必需字符已有 {len(mandatory)} 个，超过 {core_size}，需要人工调整。")
    general = {ord(ch) for ch in GENERAL_SEED}
    candidates = [cp for cp in coverage - mandatory if is_han(cp)]
    def score(cp):
        ch = chr(cp)
        return (5000 if cp in general else 0) + title_frequency[ch] * 120 + metadata_frequency[ch] * 80 + min(body_frequency[ch], 200) * 0.02
    candidates.sort(key=lambda cp: (-score(cp), cp))
    core = sorted(mandatory) + candidates[:core_size - len(mandatory)]
    used = set(core)
    groups = []
    output.mkdir(parents=True, exist_ok=True)
    def add(identifier, tier, points, reason):
        if not points:
            return
        filename = identifier + ".txt"
        text = f"# {identifier} | tier {tier} | {len(points)} codepoints\n# {reason}\n# 行首 U+码点是实际规则；后两列仅供阅读。允许人工增删/移动整行，禁止重复归属。\n"
        text += "\n".join(char_row(cp) for cp in points) + "\n"
        (output / filename).write_text(text, encoding="utf-8")
        groups.append({"id": identifier, "tier": tier, "characters": filename})
    add("core", 1, core, "固定 UI、ASCII、标点、通用常用字、文章/日记标题、分类标签等；初次生成后冻结")
    gb = sorted((cp for cp in coverage - used if is_gb2312_han(cp)), key=lambda cp: (-body_frequency[chr(cp)], cp))
    for index in range(0, len(gb), 384):
        add(f"gb2312-{index // 384 + 1:02d}", 2, gb[index:index+384], "初稿按当前正文频率排序；正常运行不重排")
    used.update(gb)
    rare = sorted((cp for cp in coverage - used if is_han(cp)), key=lambda cp: (-body_frequency[chr(cp)], cp))
    for index in range(0, len(rare), 256):
        add(f"han-rare-{index // 256 + 1:03d}", 3, rare[index:index+256], "非 GB2312 汉字，初稿先安排本站用过的字符，随后冻结")
    used.update(rare)
    scripts = {}
    for cp in sorted(coverage - used):
        name = script(cp).lower()
        if name == "hang":
            name = "hangul-jamo" if not 0xAC00 <= cp <= 0xD7AF else "hangul-syllables"
        scripts.setdefault(name, []).append(cp)
    for name, points in sorted(scripts.items()):
        points.sort(key=lambda cp: (-body_frequency[chr(cp)], cp))
        size = 384 if name == "hangul-syllables" else 512
        for index in range(0, len(points), size):
            add(f"other-{name}-{index // size + 1:02d}", 4, points[index:index+size], "其他语言、组合字符或符号；保留全部官方字符")
    settings = {"schema": 1, "family": FAMILY, "revision": "r1", "core_count": {"minimum": 800, "maximum": 1100}, "new_characters": {"policy": "append-to-tail", "unicode_window": 256}, "groups": groups}
    write_json(output / "rules.json", settings)
    core_review = [{"unicode": f"U+{cp:04X}", "character": chr(cp), "fixed_ui": cp in mandatory, "general_seed": cp in general, "title_frequency": title_frequency[chr(cp)], "metadata_frequency": metadata_frequency[chr(cp)], "body_frequency": body_frequency[chr(cp)]} for cp in core]
    write_json(BASE / "reports/core-selection.json", core_review)
    write_json(BASE / "reports/rules-origin.json", {"source": metadata, "documents": documents, "documents_count": len(documents), "mandatory_core_characters": len(mandatory), "core_characters": len(core), "tiers": {str(tier): {"groups": sum(g["tier"] == tier for g in groups), "characters": sum(len([line for line in (output/g["characters"]).read_text(encoding='utf-8').splitlines() if line.startswith('U+')]) for g in groups if g['tier'] == tier)} for tier in [1,2,3,4]}, "policy": "This draft is now frozen. Normal update/build does not call this script."})
    print(json.dumps({"core": len(core), "fixed_ui": len(mandatory), "groups": len(groups), "coverage": len(coverage), "rules": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="仅一次起草固定字符名单，不覆盖既有规则")
    parser.add_argument("--frontend", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=BASE / "rules/r1")
    parser.add_argument("--core-size", type=int, choices=range(800, 1101), default=1000)
    args = parser.parse_args()
    create_rules(args.frontend.resolve(), args.source.resolve(), args.output.resolve(), args.core_size)
