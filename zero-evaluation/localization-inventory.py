"""Inventory current HTML copy and script dependencies; not browser acceptance.

Dynamic rendering, API errors, generated documents, provider text and layout need
separate review. A clean static inventory alone cannot establish locale PASS.
"""
import hashlib
import json
import subprocess
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SURFACES = ['index.html', 'foundly-workspace.html', 'crm.html', 'analysis.html',
            'finance.html', 'automotive.html', 'identity-login.html']
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}
LOCALES = ['nl-NL', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'da-DK', 'nb-NO', 'sv-SE']
INVARIANTS = {'FOUNDLY', 'FOUNDLY OS', 'ZERO', 'Foundly', 'Foundly CRM', 'CRM',
              'F', 'A', 'House of Cars', 'BPM', 'SSE'}
LOOKUP = json.loads(subprocess.check_output(
    ['node', '-e', "console.log(JSON.stringify(require('./foundly-locales').staticLookup))"], cwd=ROOT))


class Inventory(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.copy, self.scripts = [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ['aria-label', 'title', 'placeholder', 'alt']:
            if attrs.get(name):
                invariant = attrs[name] in INVARIANTS or (
                    name == 'placeholder' and attrs[name] in {'NL', 'pipeline_value'})
                self.copy.append({'line': self.getpos()[0], 'tag': tag,
                                  'id': attrs.get('id'), 'attribute': name,
                                  'text': attrs[name], 'key': attrs.get('data-i18n-' + name),
                                  'invariant': invariant,
                                  'invariant_reason': 'Brand, acronym or canonical identifier example' if invariant else None})
        if tag == 'script' and attrs.get('src', '').startswith('/'):
            self.scripts.append(attrs['src'][1:])
        if tag not in VOID:
            self.stack.append((tag, attrs))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                self.stack = self.stack[:index]
                break

    def handle_data(self, text):
        if not self.stack or any(tag in {'script', 'style'} for tag, _ in self.stack):
            return
        text = ' '.join(text.split())
        if not text or not any(c.isalpha() for c in text):
            return
        tag, attrs = self.stack[-1]
        key = next((a.get('data-i18n') for _, a in reversed(self.stack) if a.get('data-i18n')), None)
        if not key and LOOKUP.get(text) in json.loads(attrs.get('data-i18n-text', '{}')).values():
            key = LOOKUP[text]
        invariant = text in INVARIANTS or (
            tag == 'option' and attrs.get('value') in LOCALES) or text == '⌘ K'
        self.copy.append({'line': self.getpos()[0], 'tag': tag, 'id': attrs.get('id'),
                          'text': text, 'key': key, 'invariant': invariant,
                          'invariant_reason': 'Brand, acronym, native language name or keyboard shortcut' if invariant else None})


def inventory():
    surfaces = []
    for name in SURFACES:
        data = (ROOT / name).read_bytes()
        parser = Inventory()
        parser.feed(data.decode())
        unresolved = [r for r in parser.copy if not r.get('key') and not r.get('invariant')]
        surfaces.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                         'copy_items': len(parser.copy),
                         'keyed_items': sum(bool(r.get('key')) for r in parser.copy),
                         'unresolved_static_items': len(unresolved),
                         'dynamic_acceptance': 'UNVERIFIED',
                         'script_dependencies': [{
                             'file': path, 'sha256': hashlib.sha256((ROOT / path).read_bytes()).hexdigest(),
                             'rendered_copy_acceptance': 'UNVERIFIED'
                         } for path in parser.scripts if (ROOT / path).is_file()],
                         'copy': parser.copy})
    return {'schema_version': 1, 'locales': LOCALES, 'surfaces': surfaces,
            'scope': 'Static HTML copy and loaded script dependency inventory only. '
                     'Unmarked copy is a review candidate; no automatic translation of customer data. '
                     'Dynamic UI, backend errors, workflow states, generated content and layout remain separate gates.',
            'all_surface_locale_acceptance': 'FAIL_MATERIAL_CODE_GAPS'}


if __name__ == '__main__':
    report = inventory()
    target = ROOT / 'docs/run2/localization-inventory.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    for surface in report['surfaces']:
        print(surface['file'], 'keyed:', surface['keyed_items'],
              'unresolved static:', surface['unresolved_static_items'])
