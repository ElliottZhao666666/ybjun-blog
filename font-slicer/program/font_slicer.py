"""Reproducible web-font packaging. Normal commands never edit character rules or Git."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
import urllib.request
import urllib.error
import uuid

from fontTools import __version__ as FONTTOOLS_VERSION
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
import brotli
import yaml
from fontTools.unicodedata import script as unicode_script

BASE = Path(__file__).resolve().parents[1]
REPOSITORY = "lxgw/LxgwWenKai-Screen"
ASSET = "LXGWWenKaiScreen.ttf"
FAMILY = "LXGW WenKai Screen"
PUBLIC_PREFIX = "/assets/LXGWWenKai"
MAX_DOWNLOAD = 80 * 1024 * 1024
PACKAGER_VERSION = "1.1.0"
_FONT_BYTES = b""


class PackagingError(RuntimeError):
    pass


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp-" + uuid.uuid4().hex)
    try:
        temporary.write_bytes(data)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def contained(path: Path, root: Path) -> Path:
    resolved, boundary = path.resolve(), root.resolve()
    if not resolved.is_relative_to(boundary):
        raise PackagingError(f"路径不在指定目录内: {resolved}")
    return resolved


def fetch_json(url: str):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "ybjun-font-slices/1.0", "Accept": "application/vnd.github+json"})
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read(2 * 1024 * 1024 + 1)
                if len(data) > 2 * 1024 * 1024:
                    raise PackagingError("发布元数据超出预期大小")
                return json.loads(data)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def download(url: str, path: Path, expected_size: int | None = None):
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        temporary = path.with_name(path.name + ".part-" + uuid.uuid4().hex)
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "ybjun-font-slices/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as output:
                count = 0
                while block := response.read(1024 * 1024):
                    count += len(block)
                    if count > MAX_DOWNLOAD:
                        raise PackagingError("下载超过字体文件允许的大小")
                    output.write(block)
                    if count % (4 * 1024 * 1024) == 0:
                        print(f"下载 {count // 1024 // 1024} MiB", flush=True)
                declared = response.headers.get("Content-Length")
                if expected_size is not None and count != expected_size:
                    raise PackagingError(f"下载不完整: {count}/{expected_size}")
                if declared and count != int(declared):
                    raise PackagingError("Content-Length 校验失败")
            os.replace(temporary, path)
            return
        except Exception:
            if temporary.exists():
                temporary.unlink()
            if attempt == 2:
                raise
            print("下载失败，重新尝试。", flush=True)
            time.sleep(1 + attempt)


def font_metadata(path: Path):
    with TTFont(path, recalcTimestamp=False) as font:
        family = font["name"].getDebugName(1)
        weight = font["OS/2"].usWeightClass
        if family != FAMILY or weight != 400:
            raise PackagingError(f"字型不符: {family}, weight={weight}; 固定规格为 {FAMILY}, 400")
        cmap = font.getBestCmap()
        version_name = font["name"].getDebugName(5) or ""
        match = re.search(r"Version\s+([0-9.]+)", version_name)
        if not match:
            raise PackagingError("无法读取字体版本")
        return {"family": family, "weight": weight, "version": match.group(1), "version_name": version_name, "characters": len(cmap), "sha256": sha256(path.read_bytes())}


def fetch_source(tag: str = "latest"):
    if tag != "latest" and not re.fullmatch(r"v?[0-9]+(?:\.[0-9]+)*", tag):
        raise PackagingError("版本号格式不正确")
    endpoint = "latest" if tag == "latest" else "tags/" + tag
    try:
        release = fetch_json(f"https://api.github.com/repos/{REPOSITORY}/releases/{endpoint}")
    except urllib.error.HTTPError as error:
        if error.code not in [403, 429]:
            raise
        print("GitHub API 限流，改用官方 Release 地址。", flush=True)
        if tag == "latest":
            request = urllib.request.Request(f"https://github.com/{REPOSITORY}/releases/latest", method="HEAD", headers={"User-Agent": "ybjun-font-slices/1.0"})
            with urllib.request.urlopen(request, timeout=45) as response:
                final_url = response.geturl()
            prefix = f"https://github.com/{REPOSITORY}/releases/tag/"
            if not final_url.startswith(prefix):
                raise PackagingError("无法从官方 Release 重定向识别版本")
            resolved_tag = final_url[len(prefix):]
        else:
            resolved_tag = tag
        release = {"tag_name": resolved_tag, "html_url": f"https://github.com/{REPOSITORY}/releases/tag/{resolved_tag}", "assets": [{"name": ASSET, "id": None, "updated_at": None, "size": None, "browser_download_url": f"https://github.com/{REPOSITORY}/releases/download/{resolved_tag}/{ASSET}"}]}
    if release.get("draft") or release.get("prerelease"):
        raise PackagingError("只接受正式发布版本")
    asset = next((a for a in release.get("assets", []) if a["name"] == ASSET), None)
    if not asset:
        raise PackagingError(f"官方发布中没有固定字型 {ASSET}")
    release_tag = release["tag_name"]
    if not re.fullmatch(r"v?[0-9]+(?:\.[0-9]+)*", release_tag):
        raise PackagingError("官方版本标签不符合目录规则")
    expected_prefix = f"https://github.com/{REPOSITORY}/releases/download/"
    if not asset["browser_download_url"].startswith(expected_prefix):
        raise PackagingError("字体下载地址不是指定官方仓库")
    directory = BASE / "cache" / "upstream" / release_tag
    font_path, info_path = directory / ASSET, directory / "source.json"
    digest = (asset.get("digest") or "").removeprefix("sha256:")
    cached = read_json(info_path) if info_path.exists() else {}
    valid = font_path.exists() and cached.get("asset_id") == asset["id"] and cached.get("asset_updated_at") == asset.get("updated_at")
    if valid:
        actual = sha256(font_path.read_bytes())
        valid = actual == cached.get("sha256") and (not digest or actual == digest)
    if not valid:
        print(f"获取官方 {release_tag} / {ASSET}", flush=True)
        download(asset["browser_download_url"], font_path, asset["size"])
    metadata = font_metadata(font_path)
    if digest and metadata["sha256"] != digest:
        raise PackagingError("官方文件 SHA-256 校验失败")
    license_path = directory / "OFL.txt"
    if not license_path.exists():
        download(f"https://raw.githubusercontent.com/{REPOSITORY}/{release_tag}/OFL.txt", license_path)
    if "SIL OPEN FONT LICENSE" not in license_path.read_text(encoding="utf-8-sig"):
        raise PackagingError("官方许可文件内容不符合预期")
    metadata.update({"repository": REPOSITORY, "tag": release_tag, "asset": ASSET, "asset_id": asset["id"], "asset_updated_at": asset.get("updated_at"), "url": asset["browser_download_url"], "release_url": release["html_url"], "official_digest": digest or None})
    write_json(info_path, metadata)
    write_json(BASE / "cache" / "latest-source.json", {"font": str(font_path), "license": str(license_path), "source": metadata})
    return font_path, license_path, metadata


def parse_characters(path: Path):
    result = []
    for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.match(r"^\s*U\+([0-9a-fA-F]{4,6})(?:\s|$)", line)
        if not match:
            raise PackagingError(f"{path.name}:{number}: 必须以 U+XXXX 开头")
        cp = int(match.group(1), 16)
        if cp > 0x10FFFF or 0xD800 <= cp <= 0xDFFF:
            raise PackagingError(f"无效码点 U+{cp:X}")
        if cp in result:
            raise PackagingError(f"{path.name} 重复码点 U+{cp:04X}")
        result.append(cp)
    return result


def is_han(cp: int) -> bool:
    return unicode_script(cp) == "Hani" or 0x20000 <= cp <= 0x3FFFF


def is_gb2312_han(cp: int) -> bool:
    if not is_han(cp):
        return False
    try:
        return len(chr(cp).encode("gb2312")) == 2
    except UnicodeEncodeError:
        return False


def load_rules(directory: Path, coverage: set[int] | None = None):
    directory = directory.resolve()
    settings_path = directory / "rules.json"
    settings = read_json(settings_path)
    if settings.get("schema") != 1 or settings.get("family") != FAMILY:
        raise PackagingError("规则格式或固定字型不正确")
    if not re.fullmatch(r"r[0-9]+", settings["revision"]):
        raise PackagingError("规则版本应为 r1、r2 等")
    hashes = [("rules.json", sha256(settings_path.read_bytes()))]
    groups, owners = [], {}
    for group in settings["groups"]:
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", group["id"]):
            raise PackagingError("分片名称只允许小写英文字母、数字和连字符")
        path = contained(directory / group["characters"], directory)
        codepoints = parse_characters(path)
        if not codepoints or group["tier"] not in [1, 2, 3, 4]:
            raise PackagingError("分片为空或层级不正确")
        for cp in codepoints:
            if cp in owners:
                raise PackagingError(f"U+{cp:04X} 同时出现在 {owners[cp]} 与 {group['id']}")
            owners[cp] = group["id"]
            if group["tier"] == 2 and not is_gb2312_han(cp):
                raise PackagingError(f"二级分片包含非 GB2312 汉字: U+{cp:04X}")
            if group["tier"] == 3 and not is_han(cp):
                raise PackagingError(f"三级分片包含非汉字: U+{cp:04X}")
            if group["tier"] == 4 and is_han(cp):
                raise PackagingError(f"四级分片包含汉字: U+{cp:04X}")
        hashes.append((group["characters"], sha256(path.read_bytes())))
        groups.append({**group, "codepoints": codepoints})
    if len({g["id"] for g in groups}) != len(groups):
        raise PackagingError("分片名称重复")
    core = [g for g in groups if g["tier"] == 1]
    bounds = settings.get("core_count", {"minimum": 800, "maximum": 1100})
    if len(core) != 1 or not bounds["minimum"] <= len(core[0]["codepoints"]) <= bounds["maximum"]:
        raise PackagingError("必须只有一个主分片，且字符数在规定范围内")
    if coverage is not None:
        missing, removed = sorted(coverage - owners.keys()), sorted(owners.keys() - coverage)
        if removed or (missing and settings.get("new_characters", {}).get("policy") != "append-to-tail"):
            report = {"unassigned_in_new_font": [f"U+{cp:04X} {chr(cp)}" for cp in missing], "absent_in_new_font": [f"U+{cp:04X} {chr(cp)}" for cp in removed], "rules_unchanged": True}
            write_json(BASE / "reports" / "character-review-required.json", report)
            raise PackagingError(f"字体与固定名单不一致：新增未分配 {len(missing)}，新版缺失 {len(removed)}。请人工处理 reports/character-review-required.json；不会导入前端。")
        additions = []
        if missing:
            window = settings["new_characters"].get("unicode_window", 256)
            if window not in [128, 256, 512]:
                raise PackagingError("新增字符补充分片窗口不正确")
            buckets = {}
            for cp in missing:
                kind = "han" if is_han(cp) else "other"
                key = (kind, cp // window)
                buckets.setdefault(key, []).append(cp)
            for (kind, block), points in sorted(buckets.items()):
                group = {"id": f"new-{kind}-{block:05x}", "tier": 3 if kind == "han" else 4, "codepoints": points, "automatic_additions": True}
                additions.append(group)
            groups = sorted(groups + additions, key=lambda g: g["tier"])
        write_json(BASE / "reports" / "new-characters.json", {"fixed_rules_unchanged": True, "core_unchanged": True, "count": len(missing), "groups": [{"id": g["id"], "tier": g["tier"], "characters": [f"U+{cp:04X} {chr(cp)}" for cp in g["codepoints"]]} for g in additions]})
    digest = sha256(json.dumps(hashes, separators=(",", ":")).encode())
    return settings, groups, digest


def unicode_range(codepoints):
    codepoints = sorted(set(codepoints))
    ranges = []
    start = end = codepoints[0]
    for cp in codepoints[1:]:
        if cp == end + 1:
            end = cp
        else:
            ranges.append(f"U+{start:X}" if start == end else f"U+{start:X}-{end:X}")
            start = end = cp
    ranges.append(f"U+{start:X}" if start == end else f"U+{start:X}-{end:X}")
    return ",".join(ranges)


def initialize_worker(source):
    global _FONT_BYTES
    _FONT_BYTES = Path(source).read_bytes()


def variation_sequences(font):
    return {(cp, selector): glyph for table in font["cmap"].tables if table.format == 14
            for selector, entries in table.uvsDict.items() for cp, glyph in entries}


def encode_shard(task):
    group_id, points, directory = task
    font = TTFont(io.BytesIO(_FONT_BYTES), recalcTimestamp=False)
    if not set(points).issubset(font.getBestCmap()):
        raise PackagingError("分片包含源字体不支持的字符")
    selectors = set()
    for table in font["cmap"].tables:
        if table.format == 14:
            table.uvsDict = {selector: [(cp, glyph) for cp, glyph in entries if cp in points]
                             for selector, entries in table.uvsDict.items()}
            table.uvsDict = {selector: entries for selector, entries in table.uvsDict.items() if entries}
            selectors.update(table.uvsDict)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.recalc_timestamp = False
    options.notdef_outline = True
    options.recommended_glyphs = True
    # Each normal codepoint has one fixed owner; mirrored characters have their own
    # owners too. Do not implicitly expand the requested Unicode set.
    options.bidi_closure = False
    # Variation selectors need not have a standalone normal cmap entry. The strict
    # check above covers all requested characters; validate_package checks UVS too.
    options.ignore_missing_unicodes = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=set(points) | selectors)
    subsetter.subset(font)
    for table in font["cmap"].tables:
        if table.format != 14 and table.isUnicode():
            table.cmap = {cp: glyph for cp, glyph in table.cmap.items() if cp in points}
    font.flavor = "woff2"
    buffer = io.BytesIO()
    font.save(buffer, reorderTables=True)
    font.close()
    data = buffer.getvalue()
    digest = sha256(data)
    filename = f"{group_id}.{digest[:12]}.woff2"
    (Path(directory) / filename).write_bytes(data)
    return {"id": group_id, "filename": filename, "sha256": digest, "bytes": len(data), "count": len(points), "codepoints": points}


def font_face(record, url):
    return f'@font-face{{font-family:"{FAMILY}";src:local("{FAMILY}"),url("{url}") format("woff2");font-style:normal;font-weight:400;font-display:swap;unicode-range:{unicode_range(record["codepoints"])};}}'


def build_package(source: Path, license_path: Path, source_info: dict, rules_dir: Path, jobs: int = 2):
    metadata = font_metadata(source)
    with TTFont(source, recalcTimestamp=False) as font:
        coverage = set(font.getBestCmap())
    settings, groups, rules_hash = load_rules(rules_dir, coverage)
    tools = {"packager": PACKAGER_VERSION, "fonttools": FONTTOOLS_VERSION, "brotli": brotli.__version__}
    fingerprint = sha256(json.dumps({"font": metadata["sha256"], "rules": rules_hash, "tools": tools}, sort_keys=True).encode())
    identifier = f"{metadata['version']}-{settings['revision']}-{fingerprint[:12]}"
    output = BASE / "builds" / identifier
    if (output / "build-manifest.json").exists():
        validate_package(output, source)
        print(f"复用已校验的构建: {identifier}", flush=True)
        return output
    output.mkdir(parents=True, exist_ok=True)
    release_dir = output / "web" / "releases" / identifier
    release_dir.mkdir(parents=True, exist_ok=True)
    tasks = [(g["id"], g["codepoints"], str(release_dir)) for g in groups]
    records = []
    print(f"生成 {len(tasks)} 个固定分片，使用 {jobs} 个进程。", flush=True)
    if jobs == 1:
        initialize_worker(str(source))
        for task in tasks:
            records.append(encode_shard(task))
            if len(records) % 5 == 0 or len(records) == len(tasks):
                print(f"分片 {len(records)}/{len(tasks)}", flush=True)
    else:
        with concurrent.futures.ProcessPoolExecutor(max_workers=jobs, initializer=initialize_worker, initargs=(str(source),)) as executor:
            for record in executor.map(encode_shard, tasks):
                records.append(record)
                if len(records) % 5 == 0 or len(records) == len(tasks):
                    print(f"分片 {len(records)}/{len(tasks)}", flush=True)
    css = []
    for group, record in zip(groups, records):
        record.update({"tier": group["tier"], "url": f"{PUBLIC_PREFIX}/releases/{identifier}/{record['filename']}"})
        record["css"] = font_face(record, record["url"])
        css.append(record["css"])
    full_css = "\n".join(css) + "\n"
    (output / "web" / "result.css").write_text(full_css, encoding="utf-8")
    (release_dir / "font.css").write_text(full_css, encoding="utf-8")
    shutil.copyfile(license_path, release_dir / "OFL.txt")
    shutil.copyfile(license_path, output / "web" / "OFL.txt")
    core = next(r for r in records if r["tier"] == 1)
    loader = {"schema": 1, "id": identifier, "family": FAMILY, "source_version": metadata["version"], "rules_revision": settings["revision"], "rules_sha256": rules_hash, "entry": f"{PUBLIC_PREFIX}/result.css?v={identifier}", "criticalCss": core["css"], "preload": [{"href": core["url"], "type": "font/woff2"}], "coreCharacters": core["count"], "coreBytes": core["bytes"]}
    write_json(output / "web" / "manifest.json", loader)
    readme = f"# 本站自制 Web 字体分片\n\n字型：{FAMILY}，400。\n\n官方：{source_info.get('release_url', REPOSITORY)}\n\n源字体 SHA-256：{metadata['sha256']}\n\n分片规则：{settings['revision']}，规则校验：{rules_hash}\n\n发布标识：{identifier}\n\n仅用于 Web 字体传送；保留官方许可与字体元信息。此目录是生成产物，不在此处修改字符名单。\n"
    (output / "web" / "README.md").write_text(readme, encoding="utf-8")
    files = {p.relative_to(output / "web").as_posix(): sha256(p.read_bytes()) for p in (output / "web").rglob("*") if p.is_file()}
    manifest = {"schema": 1, "id": identifier, "source": {**source_info, **metadata}, "rules": {"revision": settings["revision"], "sha256": rules_hash}, "tools": tools, "totalCharacters": len(coverage), "totalBytes": sum(r["bytes"] for r in records), "coreBytes": core["bytes"], "cssBytes": len(full_css.encode()), "fonts": records, "files": files}
    write_json(output / "build-manifest.json", manifest)
    validate_package(output, source)
    write_json(BASE / "reports" / "last-build.json", {"directory": str(output), "id": identifier})
    return output


def validate_package(directory: Path, source: Path | None = None):
    directory = directory.resolve()
    manifest = read_json(directory / "build-manifest.json")
    if manifest.get("schema") != 1:
        raise PackagingError("构建清单格式不正确")
    if not re.fullmatch(r"[0-9.]+-r[0-9]+-[0-9a-f]{12}", manifest["id"]):
        raise PackagingError("构建版本目录格式不正确")
    web = directory / "web"
    for relative, digest in manifest["files"].items():
        path = contained(web / relative, web)
        if not path.is_file() or sha256(path.read_bytes()) != digest:
            raise PackagingError(f"产物校验失败: {relative}")
    union = set()
    source_font = TTFont(source, recalcTimestamp=False) if source else None
    source_cmap = source_font.getBestCmap() if source_font else None
    outline_samples = 0
    all_variations = {}
    source_variations = variation_sequences(source_font) if source_font else None
    source_glyphs = source_font.getGlyphSet() if source_font else None
    try:
        for record in manifest["fonts"]:
            if not re.fullmatch(r"[a-z0-9-]+\.[0-9a-f]{12}\.woff2", record["filename"]):
                raise PackagingError("字体文件名格式不正确")
            expected = set(record["codepoints"])
            if union.intersection(expected):
                raise PackagingError("产物存在重复字符归属")
            union.update(expected)
            path = web / "releases" / manifest["id"] / record["filename"]
            with TTFont(path, recalcTimestamp=False) as font:
                cmap = font.getBestCmap()
                if set(cmap) != expected:
                    raise PackagingError(f"实际 cmap 与规则不符: {record['id']}")
                if font["name"].getDebugName(1) != FAMILY or font["OS/2"].usWeightClass != 400:
                    raise PackagingError("产物字型或字重发生变化")
                variants = variation_sequences(font)
                if any(cp not in expected for cp, selector in variants) or all_variations.keys() & variants.keys():
                    raise PackagingError("变体字形归属不符")
                all_variations.update(variants)
                if source_font:
                    if font["head"].unitsPerEm != source_font["head"].unitsPerEm:
                        raise PackagingError("字型 UPM 发生变化")
                    for cp, glyph in cmap.items():
                        if font["hmtx"].metrics[glyph] != source_font["hmtx"].metrics[source_cmap[cp]]:
                            raise PackagingError(f"字宽改变: U+{cp:04X}")
                    samples = sorted(expected) if record["tier"] == 1 else sorted(expected)[::max(1, len(expected) // 4)]
                    glyphs = font.getGlyphSet()
                    for cp in samples:
                        original_pen = DecomposingRecordingPen(source_glyphs)
                        output_pen = DecomposingRecordingPen(glyphs)
                        source_glyphs[source_cmap[cp]].draw(original_pen)
                        glyphs[cmap[cp]].draw(output_pen)
                        if original_pen.value != output_pen.value:
                            raise PackagingError(f"字形轮廓改变: U+{cp:04X}")
                        outline_samples += 1
                    for pair, glyph in variants.items():
                        original = source_variations.get(pair)
                        if pair not in source_variations or (glyph is None) != (original is None):
                            raise PackagingError("变体字形记录改变")
                        if glyph is not None:
                            if font["hmtx"].metrics[glyph] != source_font["hmtx"].metrics[original]:
                                raise PackagingError("变体字宽改变")
                            original_pen = DecomposingRecordingPen(source_glyphs)
                            output_pen = DecomposingRecordingPen(glyphs)
                            source_glyphs[original].draw(original_pen)
                            glyphs[glyph].draw(output_pen)
                            if original_pen.value != output_pen.value:
                                raise PackagingError("变体字形轮廓改变")
                            outline_samples += 1
        if len(union) != manifest["totalCharacters"] or (source_cmap is not None and union != set(source_cmap)):
            raise PackagingError("完整字符覆盖校验失败")
        if source_variations is not None and all_variations.keys() != source_variations.keys():
            raise PackagingError("字体变体序列覆盖校验失败")
    finally:
        if source_font:
            source_font.close()
    if source:
        write_json(directory / "validation.json", {"coverage": len(union), "metricsChecked": len(union), "outlinesChecked": outline_samples, "variationSequencesChecked": len(all_variations), "sourceSha256": manifest["source"]["sha256"]})
    print(f"校验通过：{len(manifest['fonts'])} 个分片，{len(union)} 个字符，轮廓抽验 {outline_samples}。", flush=True)
    return manifest


def import_package(directory: Path, frontend: Path):
    manifest = validate_package(directory)
    frontend = frontend.resolve()
    target = contained(frontend / "public" / "assets" / "LXGWWenKai", frontend)
    config = contained(frontend / "twilight.config.yaml", frontend)
    if not (frontend / "package.json").exists() or not config.exists():
        raise PackagingError("目标不是预期的博客前端目录")
    old_yaml = config.read_text(encoding="utf-8-sig")
    parsed = yaml.safe_load(old_yaml)
    font_config = parsed["site"]["font"].get(FAMILY)
    if not font_config or font_config.get("family") != FAMILY:
        raise PackagingError("前端的固定字型配置不符")
    old_src = font_config["src"]
    if old_src.split("?")[0] != f"{PUBLIC_PREFIX}/result.css" or old_yaml.count(old_src) != 1:
        raise PackagingError("CSS 入口不是预期的唯一地址；不自动猜测或重写配置")
    loader = read_json(directory / "web" / "manifest.json")
    new_yaml = old_yaml.replace(old_src, loader["entry"], 1)
    source_release = directory / "web" / "releases" / manifest["id"]
    destination_release = contained(target / "releases" / manifest["id"], target)
    target.mkdir(parents=True, exist_ok=True)
    destination_release.parent.mkdir(parents=True, exist_ok=True)
    if destination_release.exists():
        for p in source_release.iterdir():
            existing = destination_release / p.name
            expected = p.read_bytes()
            actual = existing.read_bytes() if existing.exists() else None
            # Git on Windows can materialize text files with CRLF. Treat only
            # this lossless line-ending conversion as equivalent; font binaries
            # and every other byte of the immutable release remain strict.
            if actual is not None and (p.suffix == ".css" or p.name == "OFL.txt"):
                actual = actual.replace(b"\r\n", b"\n")
                expected = expected.replace(b"\r\n", b"\n")
            if actual != expected:
                raise PackagingError("同名版本目录内容不同，拒绝覆盖")
    else:
        staging = contained(destination_release.with_name(".stage-" + uuid.uuid4().hex), target)
        shutil.copytree(source_release, staging)
        os.replace(staging, destination_release)
    replacements = {target / n: (directory / "web" / n).read_bytes() for n in ["result.css", "manifest.json", "README.md", "OFL.txt"]}
    replacements[config] = new_yaml.encode("utf-8")
    original = {p: p.read_bytes() if p.exists() else None for p in replacements}
    stamp = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    backup = BASE / "backups" / stamp
    for p, data in original.items():
        if data is not None:
            relative = p.relative_to(frontend)
            backup_path = contained(backup / relative, backup)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            backup_path.write_bytes(data)
    write_json(backup / "backup.json", {"frontend": str(frontend), "files": [str(p.relative_to(frontend)) for p in replacements], "new_distribution": manifest["id"]})
    try:
        for p, data in replacements.items():
            atomic_write(p, data)
    except Exception:
        for p, data in original.items():
            if data is None:
                if p.exists():
                    p.unlink()
            else:
                atomic_write(p, data)
        raise
    report = {"frontend": str(frontend), "distribution": manifest["id"], "backup": str(backup), "git_commands_executed": False, "legacy_resources_preserved": True}
    write_json(BASE / "reports" / "last-import.json", report)
    print("已导入字体资源与 CSS 版本；旧资源保留。未执行 commit 或 push。", flush=True)
    return report


def main():
    config = read_json(BASE / "config.json")
    default_rules = contained(BASE / config.get("rules_relative", "rules/r1"), BASE / "rules")
    parser = argparse.ArgumentParser(description="霞鹜文楷固定规则分片工具（不修改规则，不操作 Git）")
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ["fetch", "build", "update"]:
        item = sub.add_parser(command)
        item.add_argument("--tag", default="latest")
        if command != "fetch":
            item.add_argument("--source", type=Path)
            item.add_argument("--license", type=Path)
            item.add_argument("--rules", type=Path, default=default_rules)
            item.add_argument("--jobs", type=int, choices=range(1, 5), default=2)
        if command == "update":
            item.add_argument("--no-import", action="store_true")
            item.add_argument("--frontend", type=Path)
    item = sub.add_parser("validate")
    item.add_argument("directory", type=Path)
    item.add_argument("--source", type=Path)
    item = sub.add_parser("import")
    item.add_argument("directory", type=Path)
    item.add_argument("--frontend", type=Path)
    item = sub.add_parser("check-rules")
    item.add_argument("--rules", type=Path, default=default_rules)
    item.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    default_frontend = BASE.parent / config["frontend_relative"]
    if args.command == "fetch":
        source, _, metadata = fetch_source(args.tag)
        print(json.dumps({"font": str(source), "source": metadata}, ensure_ascii=False))
    elif args.command in ["build", "update"]:
        if args.source:
            source = args.source.resolve()
            license_path = args.license or source.with_name("OFL.txt")
            source_info = {**font_metadata(source), "repository": REPOSITORY, "release_url": f"https://github.com/{REPOSITORY}/releases"}
        else:
            source, license_path, source_info = fetch_source(args.tag)
        result = build_package(source, license_path, source_info, args.rules, args.jobs)
        if args.command == "update" and not args.no_import:
            import_package(result, args.frontend or default_frontend)
        print(json.dumps({"build": str(result)}, ensure_ascii=False))
    elif args.command == "validate":
        validate_package(args.directory, args.source)
    elif args.command == "import":
        import_package(args.directory, args.frontend or default_frontend)
    else:
        with TTFont(args.source) as font:
            coverage = set(font.getBestCmap())
        _, groups, digest = load_rules(args.rules, coverage)
        print(json.dumps({"groups": len(groups), "characters": len(coverage), "rules_sha256": digest}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (PackagingError, OSError, ValueError, KeyError) as error:
        print(f"失败：{error}", file=sys.stderr)
        raise SystemExit(1)
