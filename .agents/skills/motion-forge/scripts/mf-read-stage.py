#!/usr/bin/env python3
"""Read the exact source text for one production stage, in bounded pages.

Read-only: no completion ledger, no runtime automation, no context clearing.
"""
import argparse
import hashlib
import json
import os
import re
import shlex
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = SKILL_DIR.parents[2]
MANIFEST_PATH = SKILL_DIR / 'references/mf-stage-reading.json'
PAGE_LIMIT = 2200


def format_command(args):
    # The Node wrapper selects py/python/python3 and enforces UTF-8 on Windows.
    command = ['node', 'scripts/mw-read-stage.mjs', *args]
    if os.name == 'nt':
        # PowerShell: single quotes prevent interpolation; double embedded quotes.
        return ' '.join("'" + arg.replace("'", "''") + "'" if not re.fullmatch(r'[A-Za-z0-9_./=-]+', arg) else arg for arg in command)
    return shlex.join(command)


def split_sections(text):
    matches = list(re.finditer(r'^## (.+)$', text, re.M))
    result = {'@intro': text[:matches[0].start()] if matches else text}
    for i, match in enumerate(matches):
        name = match.group(1)
        if name in result:
            raise ValueError('Duplicate section: ' + name)
        result[name] = text[match.start():matches[i + 1].start() if i + 1 < len(matches) else len(text)]
    return result


def resolve_reference(name):
    path = (SKILL_DIR / name).resolve()
    if not path.is_relative_to(PROJECT_DIR):
        raise ValueError('Stage source must be inside this project: ' + name)
    return path


def pick_entries(manifest, stage, kind):
    return [e for e in manifest['stages'][stage]['entries'] if kind in e.get('kinds', ['talking-head', 'animation'])]


def collect_blocks(entries):
    blocks = []
    for entry in entries:
        path = resolve_reference(entry['file'])
        text = path.read_text(encoding='utf-8')
        if 'sections' in entry:
            chunks = split_sections(text)
            for heading in entry['sections']:
                if heading not in chunks:
                    raise ValueError(f'Missing section {heading!r}: {path}')
                blocks.append({'source': str(path), 'section': heading, 'text': chunks[heading]})
        else:
            blocks.append({'source': str(path), 'section': '@whole', 'text': text})
    return blocks


def paginate_blocks(blocks):
    # Pack short split_sections, while preserving every character and its provenance.
    pages, page, used = [], [], 0
    for block in blocks:
        text = block['text']
        offset = 0
        while offset < len(text):
            if used == PAGE_LIMIT or len(page) == 4:
                pages.append(page)
                page, used = [], 0
            capacity = PAGE_LIMIT - used
            stop = min(offset + capacity, len(text))
            if stop < len(text):
                newline = text.rfind('\n', offset + capacity // 2, stop)
                if newline >= 0:
                    stop = newline + 1
            page.append({**block, 'start': offset, 'end': stop, 'text': text[offset:stop]})
            used += stop - offset
            offset = stop
    if page:
        pages.append(page)
    return pages


def check_manifest(manifest):
    """Fail closed if maintenance leaves any reference chapter without a route."""
    assigned = {}
    for group in ('stages', 'modules'):
        for item in manifest[group].values():
            for entry in item['entries']:
                path = resolve_reference(entry['file'])
                available = split_sections(path.read_text(encoding='utf-8'))
                requested = entry.get('sections', list(available))
                absent = set(requested) - available.keys()
                if absent:
                    raise ValueError(f'Missing split_sections in {path}: {sorted(absent)}')
                assigned.setdefault(path, set()).update(requested)
    for root in (SKILL_DIR, SKILL_DIR.parent / 'srt-brief'):
        for path in (root / 'references').glob('*.md'):
            missing = split_sections(path.read_text(encoding='utf-8')).keys() - assigned.get(path, set())
            if missing:
                raise ValueError(f'Unassigned reference split_sections; update mf-stage-reading.json before production: {path}: {sorted(missing)}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    choices = parser.add_mutually_exclusive_group(required=True)
    choices.add_argument('--stage')
    choices.add_argument('--module')
    choices.add_argument('--file', help='Existing SRT analysis artifact or selected reference file')
    choices.add_argument('--list', action='store_true')
    parser.add_argument('--kind', choices=['talking-head', 'animation'], default='talking-head')
    parser.add_argument('--page', type=int, default=1)
    parser.add_argument('--expect', help='Source packet hash from the preceding page')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    check_manifest(manifest)
    if args.list:
        for key, item in manifest['stages'].items():
            print(f'{key}: {item["title"]}; next={item.get("next", "delivery")}')
        print('Technical/evidence modules (read fully before their specified use):')
        for key, item in manifest['modules'].items():
            print(f'{key}: {item["trigger"]}')
        return
    if args.stage:
        if args.stage not in manifest['stages']:
            raise ValueError('Unknown stage: ' + args.stage)
        info = manifest['stages'][args.stage]
        entries = pick_entries(manifest, args.stage, args.kind)
        mode = ['--stage', args.stage, '--kind', args.kind]
        title = info['title']
        done = info['finish']
    elif args.module:
        if args.module not in manifest['modules']:
            raise ValueError('Unknown module: ' + args.module)
        info = manifest['modules'][args.module]
        entries = info['entries']
        mode = ['--module', args.module]
        title = info['trigger']
        done = '模块原文已全部返回。回到所属制作阶段；未执行可见检查不能记为效果通过。'
    else:
        path = Path(args.file).resolve()
        if not path.is_relative_to(PROJECT_DIR):
            raise ValueError('Input artifact must be inside the project')
        entries = [{'file': str(path)}]
        mode = ['--file', str(path)]
        title = path.name
        done = '该输入文件已全部返回。继续当前阶段要求；读完不等于内容或效果已验收。'
    blocks = collect_blocks(entries)
    if not blocks:
        raise ValueError('No source content selected')
    fingerprint = hashlib.sha256(json.dumps({'title': title, 'blocks': blocks, 'finish': done}, ensure_ascii=False).encode()).hexdigest()
    if args.expect and args.expect != fingerprint:
        raise ValueError('Source changed during reading. Restart this stage/module at page 1; do not silently skip changed text.')
    pages = paginate_blocks(blocks)
    if args.page < 1 or args.page > len(pages):
        raise ValueError(f'Page must be between 1 and {len(pages)}')
    page = pages[args.page - 1]
    print(f'READ_STAGE {title} | page {args.page}/{len(pages)} | packet {fingerprint}')
    for piece in page:
        print(f'SOURCE {piece["source"]} | section {piece["section"]} | chars [{piece["start"]},{piece["end"]})')
        print('BEGIN_SOURCE')
        sys.stdout.write(piece['text'])
        if not piece['text'].endswith('\n'):
            print()
        print('END_SOURCE')
    print(f'END_PAGE {args.page}/{len(pages)} {fingerprint}')
    if args.page < len(pages):
        command = [*mode, '--page', str(args.page + 1), '--expect', fingerprint]
        print('NEXT_READ ' + format_command(command))
        print('下一次工具调用只读取此下一页；阶段全部页到达前不开始本阶段制作。')
    else:
        print('END_READING ' + fingerprint)
        print('执行本阶段工作：' + done)
        if args.stage and info.get('next'):
            command = ['--stage', info['next'], '--kind', args.kind]
            print('完成本阶段工作后下一入口：' + format_command(command))
        print('本脚本仅返回资料，不证明已理解或已执行，不会自动制作或清空上下文。')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print('READ_ERROR: ' + str(error), file=sys.stderr)
        sys.exit(2)
