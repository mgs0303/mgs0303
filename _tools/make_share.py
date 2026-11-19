#!/usr/bin/env python3
"""Genere, pour chaque fiche de _games/, l'image d'apercu (assets/share/<slug>.jpg)
et la page de partage (jeu/<slug>/index.html) lues par Discord / X / etc.
Usage (depuis la racine du depot) :  python3 _tools/make_share.py
"""
import glob, html, os, re
from PIL import Image, ImageDraw, ImageFont, ImageOps

SITE = "https://mgs0303.github.io/mgs0303"
W, H = 1200, 630
FONT = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"

def front(path):
    fm = open(path, encoding="utf-8").read().split("---")[1]
    def g(k):
        m = re.search(rf"^{k}:\s*(.*)$", fm, re.M)
        return m.group(1).strip().strip("\"'") if m else ""
    return g("title"), g("banner"), g("cover")

def background():
    img = Image.new("RGB", (W, H)); px = img.load()
    for y in range(H):
        for x in range(W):
            a = max(0, 1 - ((x / W) ** 2 + (y / H) ** 2) ** .5 * 1.1)
            b = max(0, 1 - (((W - x) / W) ** 2 + ((H - y) / H) ** 2) ** .5 * 1.2)
            px[x, y] = (int(11 + 50 * a + 20 * b), int(22 + 85 * a + 90 * b), int(38 + 190 * a + 110 * b))
    return img

BG = background()

def load(p):
    p = p.lstrip("/")
    if not p or not os.path.exists(p):
        return None
    try:
        return Image.open(p).convert("RGB")
    except Exception:
        return None

def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines

def make_image(title, banner, cover, out):
    img = BG.copy()
    bw, bh = W - 80, 360
    src = load(banner) or load(cover)
    if src:
        ban = ImageOps.fit(src, (bw, bh), Image.LANCZOS, centering=(.5, .35))
        m = Image.new("L", (bw, bh), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, bw, bh), radius=28, fill=255)
        img.paste(ban, (40, 40), m)
    d = ImageDraw.Draw(img)
    top, maxw = 40 + bh, W - 160
    for size in (72, 64, 56, 48, 42):
        f = ImageFont.truetype(FONT, size)
        lines = wrap(d, title, f, maxw)
        if len(lines) <= 2:
            break
    lh = int(size * 1.22)
    block = lh * len(lines)
    y = top + (H - top - block) // 2 - 4
    for ln in lines:
        bb = d.textbbox((0, 0), ln, font=f)
        d.text((80, y - bb[1] + (lh - (bb[3] - bb[1])) // 2), ln, font=f, fill=(236, 244, 255))
        y += lh
    img.save(out, quality=84, optimize=True, progressive=True)

def make_page(slug, title, out):
    t = html.escape(title, quote=True)
    url = f"{SITE}/jeu/{slug}/"
    img = f"{SITE}/assets/share/{slug}.jpg"
    open(out, "w", encoding="utf-8").write(f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="{t}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="{W}">
<meta property="og:image:height" content="{H}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:image" content="{img}">
<meta name="theme-color" content="#0b1626">
<meta http-equiv="refresh" content="0;url=../../#/jeu/{slug}">
<script>location.replace('../../#/jeu/{slug}');</script>
</head>
<body style="background:#0b1626;color:#ecf4ff;font-family:sans-serif">
<p><a style="color:#9bbcff" href="../../#/jeu/{slug}">{t}</a></p>
</body>
</html>
""")

if __name__ == "__main__":
    os.makedirs("assets/share", exist_ok=True)
    n = 0
    for f in sorted(glob.glob("_games/*.md")):
        slug = os.path.splitext(os.path.basename(f))[0]
        title, banner, cover = front(f)
        if not title:
            continue
        make_image(title, banner, cover, f"assets/share/{slug}.jpg")
        os.makedirs(f"jeu/{slug}", exist_ok=True)
        make_page(slug, title, f"jeu/{slug}/index.html")
        n += 1
    print(n, "jeux")
