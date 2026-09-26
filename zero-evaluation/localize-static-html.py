"""Attach explicit catalog bindings to static text without rebuilding the DOM.

Keep all layout, IDs, business defaults and option values. Runtime text changed
by a native renderer is deliberately protected from these static bindings.
"""
import html
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOOKUP = json.loads(subprocess.check_output(
    ['node', '-e', "console.log(JSON.stringify(require('./foundly-locales').staticLookup))"], cwd=ROOT))
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Binder(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source, self.stack, self.nodes = source, [], []
        self.offsets, offset = [], 0
        for line in source.splitlines(keepends=True):
            self.offsets.append(offset)
            offset += len(line)

    def child(self):
        if self.stack:
            parent = self.stack[-1]
            index = parent['children']
            parent['children'] += 1
            return index

    def handle_starttag(self, tag, attrs):
        self.child()
        row = {'tag': tag, 'attrs': dict(attrs), 'children': 0, 'direct': {},
               'raw': self.get_starttag_text(),
               'start': self.offsets[self.getpos()[0] - 1] + self.getpos()[1], 'extra': {}}
        for attr in ['aria-label', 'title', 'placeholder', 'alt']:
            key = LOOKUP.get(row['attrs'].get(attr))
            if key and 'data-i18n-' + attr not in row['attrs']:
                row['extra']['data-i18n-' + attr] = key
        self.nodes.append(row)
        if tag not in VOID:
            self.stack.append(row)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]['tag'] == tag:
                self.stack = self.stack[:index]
                break

    def handle_comment(self, data):
        self.child()

    def handle_data(self, data):
        index = self.child()
        if not self.stack or any(r['tag'] in {'script', 'style', 'textarea'} or 'data-i18n' in r['attrs'] for r in self.stack):
            return
        source = ' '.join(data.split())
        key = LOOKUP.get(source)
        if key:
            row = self.stack[-1]
            row['direct'][str(index)] = key
            # An option without an explicit value otherwise changes its native
            # submitted value when its visible text is translated.
            if row['tag'] == 'option' and 'value' not in row['attrs']:
                row['extra']['value'] = source

    def result(self):
        source = self.source
        for row in reversed(self.nodes):
            raw = row['raw']
            old = json.loads(row['attrs'].get('data-i18n-text', '{}'))
            combined = {**old, **row['direct']}
            if combined != old:
                raw = re.sub(r'\sdata-i18n-text=(?:"[^"]*"|\x27[^\x27]*\x27)', '', raw, count=1)
                row['extra']['data-i18n-text'] = json.dumps(combined, separators=(',', ':'))
            if not row['extra']:
                continue
            suffix = '/>' if raw.endswith('/>') else '>'
            updated = raw[:-len(suffix)] + ''.join(' ' + k + '="' + html.escape(v, quote=True) + '"' for k, v in row['extra'].items()) + suffix
            source = source[:row['start']] + updated + source[row['start'] + len(row['raw']):]
        return source


if __name__ == '__main__':
    for path in ROOT.glob('*.html'):
        source = path.read_text()
        parser = Binder(source)
        parser.feed(source)
        path.write_text(parser.result())
