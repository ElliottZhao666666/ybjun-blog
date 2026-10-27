import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'program'))
import font_slicer as package


def fake_font(path, points, family=package.FAMILY, weight=400):
    font = FontBuilder(1000, isTTF=True)
    order = ['.notdef'] + [f'u{cp:06X}' for cp in points]
    font.setupGlyphOrder(order)
    font.setupCharacterMap({cp: f'u{cp:06X}' for cp in points})
    glyphs = {}
    for name in order:
        pen = TTGlyphPen(None)
        pen.moveTo((50, 0)); pen.lineTo((350, 0)); pen.lineTo((200, 700)); pen.closePath()
        glyphs[name] = pen.glyph()
    font.setupGlyf(glyphs)
    font.setupHorizontalMetrics({name: (500, 50) for name in order})
    font.setupHorizontalHeader(ascent=800, descent=-200)
    font.setupNameTable({'familyName': family, 'styleName': 'Regular', 'uniqueFontIdentifier': 'test', 'fullName': family, 'psName': 'TestFont', 'version': 'Version 1.000'})
    font.setupOS2(usWeightClass=weight, sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    font.setupPost()
    font.save(path)


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='font-test-')
        self.root = Path(self.temporary.name)
        self.base_patch = patch.object(package, 'BASE', self.root)
        self.base_patch.start()
        self.rules = self.root / 'rules/r1'
        self.rules.mkdir(parents=True)
        self.points = [0x41, 0x42, 0x4E00, 0x9F98, 0x3B1]
        self.font = self.root / 'source.ttf'
        fake_font(self.font, self.points)
        self.license = self.root / 'OFL.txt'
        self.license.write_text('SIL OPEN FONT LICENSE Version 1.1\nTest fixture only.', encoding='utf8')
        groups = []
        for name, tier, points in [('core',1,[0x41,0x42]),('gb',2,[0x4E00]),('rare',3,[0x9F98]),('foreign',4,[0x3B1])]:
            (self.rules / (name+'.txt')).write_text('\n'.join(f'U+{cp:04X}\t{chr(cp)}' for cp in points)+'\n',encoding='utf8')
            groups.append({'id':name,'tier':tier,'characters':name+'.txt'})
        self.settings={'schema':1,'family':package.FAMILY,'revision':'r1','core_count':{'minimum':2,'maximum':2},'new_characters':{'policy':'append-to-tail','unicode_window':256},'groups':groups}
        package.write_json(self.rules/'rules.json',self.settings)

    def tearDown(self):
        self.base_patch.stop()
        self.temporary.cleanup()

    def build(self):
        return package.build_package(self.font,self.license,package.font_metadata(self.font),self.rules,1)

    def test_complete_coverage_and_metrics(self):
        result=self.build();manifest=package.validate_package(result,self.font)
        self.assertEqual(manifest['totalCharacters'],len(self.points))
        self.assertEqual(len(manifest['fonts']),4)

    def test_rules_are_frozen_and_new_characters_go_to_tail(self):
        before={p.name:p.read_bytes() for p in self.rules.iterdir()}
        self.build()
        fake_font(self.font,self.points+[0x20000,0x2665])
        result=self.build();manifest=package.read_json(result/'build-manifest.json')
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.rules.iterdir()})
        self.assertEqual(next(x['codepoints'] for x in manifest['fonts'] if x['id']=='core'),[0x41,0x42])
        self.assertEqual(len([x for x in manifest['fonts'] if x['id'].startswith('new-')]),2)

    def test_duplicate_is_rejected(self):
        (self.rules/'foreign.txt').write_text('U+0041\tA\n',encoding='utf8')
        with self.assertRaises(package.PackagingError):self.build()

    def test_incorrect_tier_is_rejected(self):
        (self.rules/'gb.txt').write_text('U+03B1\tα\n',encoding='utf8')
        with self.assertRaises(package.PackagingError):self.build()

    def test_removed_upstream_character_is_rejected(self):
        fake_font(self.font,self.points[:-1])
        with self.assertRaises(package.PackagingError):self.build()
        self.assertTrue((self.root/'reports/character-review-required.json').exists())

    def test_wrong_font_variant_is_rejected(self):
        fake_font(self.font,self.points,family='Wrong Font')
        with self.assertRaises(package.PackagingError):self.build()

    def test_deterministic_encoding(self):
        package.initialize_worker(str(self.font))
        one=self.root/'one';two=self.root/'two';one.mkdir();two.mkdir()
        a=package.encode_shard(('core',[0x41,0x42],str(one)))
        b=package.encode_shard(('core',[0x41,0x42],str(two)))
        self.assertEqual(a['sha256'],b['sha256'])

    def test_variation_sequences_survive_with_their_base(self):
        with TTFont(self.font) as font:
            table=CmapSubtable.newSubtable(14)
            table.platformID=0;table.platEncID=5;table.language=0;table.cmap={}
            table.uvsDict={0xFE00:[(0x41,'u000042'),(0x4E00,None)]}
            font['cmap'].tables.append(table);font.save(self.font)
        result=self.build()
        check=package.read_json(result/'validation.json')
        self.assertEqual(check['variationSequencesChecked'],2)

    def test_mirrored_symbols_do_not_expand_fixed_ownership(self):
        fake_font(self.font,self.points+[0x29A2])
        result=self.build()
        self.assertEqual(package.read_json(result/'build-manifest.json')['totalCharacters'],6)

    def test_corrupted_output_is_rejected(self):
        result=self.build();manifest=package.read_json(result/'build-manifest.json')
        p=result/'web/releases'/manifest['id']/manifest['fonts'][0]['filename'];p.write_bytes(b'bad')
        with self.assertRaises(package.PackagingError):package.validate_package(result)

    def frontend(self):
        target=self.root/'frontend';(target/'public/assets/LXGWWenKai').mkdir(parents=True)
        (target/'package.json').write_text('{}')
        (target/'twilight.config.yaml').write_text('site:\n  font:\n    LXGW WenKai Screen:\n      family: LXGW WenKai Screen\n      src: /assets/LXGWWenKai/result.css?v=old\n',encoding='utf8')
        (target/'public/assets/LXGWWenKai/result.css').write_text('old-css')
        (target/'public/assets/LXGWWenKai/legacy.woff2').write_bytes(b'legacy')
        (target/'.git').mkdir();(target/'.git/HEAD').write_text('do-not-change')
        return target

    def test_import_preserves_legacy_and_does_not_commit(self):
        result=self.build();target=self.frontend();package.import_package(result,target)
        self.assertEqual((target/'public/assets/LXGWWenKai/legacy.woff2').read_bytes(),b'legacy')
        self.assertEqual((target/'.git/HEAD').read_text(),'do-not-change')
        self.assertIn('?v=1.000-r1-',(target/'twilight.config.yaml').read_text())

    def test_failed_import_restores_active_files(self):
        result=self.build();target=self.frontend();before=(target/'twilight.config.yaml').read_bytes()
        real=package.atomic_write
        def fail_config(path,data):
            if path==target/'twilight.config.yaml' and data!=before:raise OSError('simulated write failure')
            return real(path,data)
        with patch.object(package,'atomic_write',side_effect=fail_config):
            with self.assertRaises(OSError):package.import_package(result,target)
        self.assertEqual((target/'twilight.config.yaml').read_bytes(),before)
        self.assertEqual((target/'public/assets/LXGWWenKai/result.css').read_text(),'old-css')
        self.assertFalse((target/'public/assets/LXGWWenKai/manifest.json').exists())

    def test_reimport_accepts_git_crlf_text_conversion(self):
        result=self.build();target=self.frontend();package.import_package(result,target)
        manifest=package.read_json(result/'build-manifest.json')
        release=target/'public/assets/LXGWWenKai/releases'/manifest['id']
        for name in ['font.css','OFL.txt']:
            file=release/name;file.write_bytes(file.read_bytes().replace(b'\r\n',b'\n').replace(b'\n',b'\r\n'))
        package.import_package(result,target)
        for name in ['font.css','OFL.txt']:
            file=release/name;file.write_bytes(file.read_bytes().replace(b'\r\n',b'\n'))
        package.import_package(result,target)

    def test_reimport_rejects_modified_immutable_font(self):
        result=self.build();target=self.frontend();package.import_package(result,target)
        manifest=package.read_json(result/'build-manifest.json')
        font=target/'public/assets/LXGWWenKai/releases'/manifest['id']/manifest['fonts'][0]['filename']
        font.write_bytes(b'tampered')
        with self.assertRaises(package.PackagingError):package.import_package(result,target)


if __name__=='__main__':unittest.main(verbosity=2)
