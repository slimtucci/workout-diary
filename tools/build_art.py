"""Art-override layer: the Graphic Designer's original renders -> img/art/ + art-manifest.js.

ONE COMMAND after the designer adds or overwrites files:
    python3 tools/build_art.py && python3 tests/e2e_test.py     (then bump VERSION in sw.js and deploy)

Sources (default /workspace/business-ops/exercise-art, or pass a folder):
  full/manifest.json  {"lifts": [{slug, name, primary, secondary, chips, equipment, image, image_400}]}
                      -> card art  img/art/<library-name-kebab>.webp      (from image_400, WebP <= ~40 KB)
                      -> detail    img/art/lg/<library-name-kebab>.webp   (from the 1024 px image, WebP <= ~120 KB; downsized only if wider than 1024)
                      -> manifest muscles override free-exercise-db for that exercise (muscle map + target line)
  samples/*.svg       older flat samples; used only for exercises the PNG manifest doesn't cover
  chips:              samples/chips < samples/v2/chips < full/chips (later wins)
Matching: manifest display name == library name, else tools/art_aliases.json, else <art folder>/aliases.json or full/aliases.json
({"slug": "Library Name"}). Anything else is reported as NOT matched - never guessed.
Options: --badge  also show the small muscle-map badge on art cards."""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
ART = args[0] if args else '/workspace/business-ops/exercise-art'
BADGE = '--badge' in sys.argv
CARD_W, CARD_MAX = 400, 40 * 1024
LG_W, LG_MAX = 1024, 120 * 1024
CHIP_KEYS = {'chest': 'm-chest', 'back': 'm-back', 'biceps': 'm-biceps', 'triceps': 'm-triceps', 'quads': 'm-quads', 'quadriceps': 'm-quads',
             'hamstrings': 'm-hams', 'glutes': 'm-glutes', 'shoulders': 'm-shoulders', 'abs': 'm-core', 'core': 'm-core', 'calves': 'm-calves',
             'forearms': 'm-forearms', 'hips': 'm-hips', 'cardio': 'cardio'}
BACK_VIEW = {'m-back', 'm-triceps', 'm-hams', 'm-glutes', 'm-calves'}  # icons drawn from behind get a small "B" marker in the chip
# designer muscle names -> body-map regions (bodymap.js)
MUSCLE = {'chest': 'chest', 'upper chest': 'chest', 'lower chest': 'chest', 'pecs': 'chest', 'front delts': 'fdelt', 'shoulders': 'fdelt', 'side delts': 'sdelt',
          'rear delts': 'rdelt', 'biceps': 'biceps', 'brachialis': 'biceps', 'triceps': 'triceps', 'forearms': 'forearm', 'grip': 'forearm', 'abs': 'abs',
          'obliques': 'oblique', 'core': 'abs', 'lats': 'lats', 'mid back': 'upback', 'upper back': 'upback', 'rhomboids': 'upback', 'traps': 'traps',
          'lower back': 'lowback', 'glutes': 'glutes', 'hip flexors': 'hipflex', 'adductors': 'adduct', 'abductors': 'abduct', 'quads': 'quads',
          'quadriceps': 'quads', 'hamstrings': 'hams', 'calves': 'calves', 'shins': 'shins', 'tibialis': 'shins'}
kebab = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', '')).strip('-')

def webp(src, dst, width, max_bytes, qualities):
    from PIL import Image
    im = Image.open(src).convert('RGB')
    if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    for q in qualities:
        im.save(dst, 'WEBP', quality=q, method=6)
        if os.path.getsize(dst) <= max_bytes: return q
    return q

def regions(names, slug):
    out = []
    for n in names:
        r = MUSCLE.get(n.lower().strip())
        if not r: raise SystemExit(f'{slug}: unknown muscle "{n}" - add it to MUSCLE in tools/build_art.py')
        if r not in out: out.append(r)
    return out

def main():
    s = open(os.path.join(ROOT, 'exercises-library.js')).read(); L = json.loads(s[s.index('{'):s.rindex('}') + 1])['items']
    byname = {it[0]: i for i, it in enumerate(L)}
    aliases = {k: v for k, v in json.load(open(os.path.join(ROOT, 'tools', 'art_aliases.json'))).items() if not k.startswith('_')}
    for p in (os.path.join(ART, 'aliases.json'), os.path.join(ART, 'full', 'aliases.json')):
        if os.path.exists(p): aliases.update({k: v for k, v in json.load(open(p)).items() if not k.startswith('_')})
    out = os.path.join(ROOT, 'img', 'art')
    if os.path.isdir(out): shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'lg')); os.makedirs(os.path.join(out, 'chips'))
    items, unmatched, report = {}, [], []
    man_path = os.path.join(ART, 'full', 'manifest.json')
    lifts = json.load(open(man_path))['lifts'] if os.path.exists(man_path) else []
    for it in lifts:
        slug = it['slug']; name = it['name'] if it['name'] in byname else aliases.get(slug)
        i = byname.get(name)
        if i is None: unmatched.append(f'{slug} ("{it["name"]}")'); continue
        base = kebab(L[i][0]); d = os.path.join(ART, 'full')
        card_src = os.path.join(d, it.get('image_400') or it['image']); lg_src = os.path.join(d, it.get('image') or it['image_400'])
        q1 = webp(card_src, os.path.join(out, base + '.webp'), CARD_W, CARD_MAX, (92, 88, 84, 80, 76, 72, 68, 64))
        q2 = webp(lg_src, os.path.join(out, 'lg', base + '.webp'), LG_W, LG_MAX, (90, 86, 82, 78, 74, 70, 66, 62))
        p, sec = regions(it.get('primary', []), slug), regions(it.get('secondary', []), slug)
        items[str(i)] = {'f': base + '.webp', 'lg': 'lg/' + base + '.webp', 'p': ' '.join(p), 's': ' '.join(x for x in sec if x not in p)}
        report.append(f'{slug} -> {L[i][0]} (q{q1}/{q2})')
    # older SVG samples: only where no PNG render exists
    sd = os.path.join(ART, 'samples')
    if os.path.isdir(sd):
        for fn in sorted(os.listdir(sd)):
            if not fn.endswith('.svg'): continue
            slug = fn[:-4]; name = aliases.get(slug, slug)
            i = byname.get(name, next((j for j, it in enumerate(L) if kebab(it[0]) in (slug, 'barbell-' + slug)), None))
            if i is None or str(i) in items: continue
            shutil.copyfile(os.path.join(sd, fn), os.path.join(out, kebab(L[i][0]) + '.svg')); items[str(i)] = {'f': kebab(L[i][0]) + '.svg'}
            report.append(f'{slug} -> {L[i][0]} (svg sample)')
    chips = {}
    for d in (os.path.join(ART, 'samples', 'chips'), os.path.join(ART, 'samples', 'v2', 'chips'), os.path.join(ART, 'full', 'chips')):
        if os.path.isdir(d):
            for fn in sorted(os.listdir(d)):
                b, ext = os.path.splitext(fn.lower())
                if ext in ('.svg', '.webp', '.png') and b in CHIP_KEYS:
                    shutil.copyfile(os.path.join(d, fn), os.path.join(out, 'chips', b + ext)); chips[CHIP_KEYS[b]] = 'chips/' + b + ext
    js = ('/* SlimTucci art overrides: original renders by the SlimTucci Graphic Designer (img/art/). Generated by tools/build_art.py, do not hand-edit.\n'
          '   items: library index -> {f: card art, lg: detail art, p/s: primary/secondary muscle regions}; chips: chip key -> icon; back: chip icons drawn from behind. */\n'
          'window.SLIMTUCCI_ART = ' + json.dumps({'version': 2, 'badge': BADGE, 'items': items, 'chips': chips, 'back': sorted(k for k in chips if k in BACK_VIEW)},
                                                 separators=(',', ':')) + ';\n')
    open(os.path.join(ROOT, 'art-manifest.js'), 'w').write(js)
    sizes = lambda d: [os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))]
    c, g = sizes(out), sizes(os.path.join(out, 'lg'))
    print(f'{len(items)} exercises with art ({len(lifts)} in manifest, {len(lifts) - len(unmatched)} mapped); '
          f'card WebP {sum(c)/1024:.0f} KB (max {max(c or [0])/1024:.1f} KB), detail WebP {sum(g)/1024:.0f} KB (max {max(g or [0])/1024:.1f} KB); {len(chips)} chip icons')
    for r in report: print('  ' + r)
    if unmatched: print('NOT matched (add "slug": "Library Name" to tools/art_aliases.json):', ', '.join(unmatched))

if __name__ == '__main__':
    main()
