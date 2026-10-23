"""Generate brand thumbnail tiles for papers and talks.

Each item in _publications/ and _presentations/ gets an SVG tile at
assets/images/tiles/<collection>/<file name>.svg: a network pattern that is
unique to that item, plus a small icon for its topic, in the site's colors.

Run from the repository root after adding a paper or talk:
    python3 _tools/make_tiles.py

To use a real figure or photo instead, add `image: /path/to/file.jpg` to the
item's front matter; the Research page shows it in place of the tile.
To force a topic icon, add `topic:` with one of the ICONS names below.
"""
import glob
import hashlib
import math
import os
import random
import re

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "images", "tiles")
W, H = 400, 300

# Line icons drawn on a 24 x 24 grid
ICONS = {
    "sensor": '<circle cx="12" cy="12" r="2.6"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>',
    "booster": '<path d="M12 3.2c-.3.4-6 7.2-6 11.2a6 6 0 0 0 12 0c0-4-5.7-10.8-6-11.2z"/><path d="M12 11.4v6M9 14.4h6"/>',
    "pump": '<circle cx="12" cy="12" r="8.2"/><path d="M15.6 12 9.8 8.6v6.8z"/><path d="M1.5 12h2.3M20.2 12h2.3"/>',
    "chlorine": '<path d="M12 3.2c-.3.4-6 7.2-6 11.2a6 6 0 0 0 12 0c0-4-5.7-10.8-6-11.2z"/><circle cx="10" cy="15.2" r="1.3"/><circle cx="14.3" cy="13" r="1.3"/><circle cx="13.2" cy="17.6" r="1.1"/><path d="M11.2 14.6 13.1 13.6M13.8 14.2l-.3 2.2"/>',
    "climate": '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7.5"/><path d="M2.5 21c1.6-1.2 3.2-1.2 4.8 0s3.2 1.2 4.8 0 3.2-1.2 4.8 0 3.2 1.2 4.8 0"/>',
    "design": '<path d="M12 3.5 6 20.5M12 3.5l6 17M8.2 14.5h7.6"/><circle cx="12" cy="3.5" r="1.4"/>',
    "model": '<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5"/>',
    "control": '<path d="M5.5 9a7 7 0 0 1 12.2-2.4M18.5 15a7 7 0 0 1-12.2 2.4"/><path d="M18.2 3.6v3.6h-3.6M5.8 20.4v-3.6h3.6"/><circle cx="12" cy="12" r="2"/>',
    "pipe": '<path d="M2.5 9.5h6v5h-6M21.5 9.5h-6v5h6M8.5 8v8M15.5 8v8"/><path d="M8.5 12h7"/><path d="M12 4.5l.9 2.1M15.6 5.6l-1.1 1.8M8.4 5.6l1.1 1.8"/>',
    "book": '<path d="M12 6.2C9.8 4.6 6.5 4.2 3.5 4.8v13.6c3-.6 6.3-.2 8.5 1.4 2.2-1.6 5.5-2 8.5-1.4V4.8c-3-.6-6.3-.2-8.5 1.4zM12 6.2v13.6"/>',
    "tower": '<path d="M6 7.5 12 3.5l6 4"/><rect x="6" y="7.5" width="12" height="6" rx="1.6"/><path d="M8.2 13.5 7 21M15.8 13.5 17 21M7.6 17.3h8.8M12 13.5V21"/>',
}

# Background gradient per kind of item
KIND_COLORS = {
    "journal": ("#032141", "#0B4A80"),
    "conference": ("#032141", "#0C5A6E"),
    "dissertation": ("#03192F", "#243F78"),
    "talk": ("#032141", "#0D6676"),
}


def front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    return yaml.safe_load(m.group(1)) if m else {}


def kind_of(fm, collection):
    if collection == "presentations":
        return "talk"
    badge = str(fm.get("pub_last", ""))
    if "Dissertation" in badge:
        return "dissertation"
    if "Conference" in badge:
        return "conference"
    return "journal"


def topic_of(fm, collection):
    if fm.get("topic") in ICONS:
        return fm["topic"]
    t = str(fm.get("title", "")).lower()
    venue = str(fm.get("pub", "")).lower()
    rules = [
        ("climate", ["climate"]),
        ("pipe", ["influential pipe", "vulnerab", "centrality"]),
        ("design", ["excel", "design optimization"]),
        ("sensor", ["sensor", "observab"]),
        ("chlorine", ["byproduct", "disinfectant control"]),
        ("pump", ["pump", "quality-aware hydraulic"]),
        ("booster", ["node placement", "booster"]),
        ("model", ["model order", "control-theoretic modeling"]),
    ]
    for name, keys in rules:
        if any(k in t for k in keys):
            return name
    if "Dissertation" in str(fm.get("pub_last", "")):
        return "book"
    if collection == "presentations" and "talk at" in venue:
        return "tower"
    return "control"


def network(rng):
    """A small, connected pipe network laid out on a jittered grid."""
    cols, rows = 7, 5
    pts = {}
    for r in range(rows):
        for c in range(cols):
            if rng.random() < 0.18:
                continue
            x = 20 + c * (W - 40) / (cols - 1) + rng.uniform(-16, 16)
            y = 22 + r * (H - 44) / (rows - 1) + rng.uniform(-14, 14)
            pts[(r, c)] = (x, y)
    edges = []
    for (r, c), p in pts.items():
        for dr, dc in ((0, 1), (1, 0)):
            q = pts.get((r + dr, c + dc))
            if q and rng.random() < 0.78:
                edges.append((p, q))
    # one highlighted route that wanders across the tile
    route, (r, c) = [], (rng.randrange(rows), 0)
    while c < cols:
        if (r, c) in pts:
            route.append(pts[(r, c)])
        step = rng.random()
        if step < 0.25 and r > 0:
            r -= 1
        elif step < 0.5 and r < rows - 1:
            r += 1
        else:
            c += 1
    return list(pts.values()), edges, route


def tile_svg(fm, collection, slug):
    seed = int(hashlib.sha1(f"{collection}/{slug}".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    kind = kind_of(fm, collection)
    topic = topic_of(fm, collection)
    c1, c2 = KIND_COLORS[kind]
    nodes, edges, route = network(rng)
    angle = rng.choice([20, 35, 50, 145, 160])
    gx, gy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    bx = rng.choice([230, 250, 270, 290])
    by = rng.choice([128, 145, 160])

    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">']
    parts.append(f'<defs><linearGradient id="g" x1="{0.5 - gx / 2:.2f}" y1="{0.5 - gy / 2:.2f}" '
                 f'x2="{0.5 + gx / 2:.2f}" y2="{0.5 + gy / 2:.2f}"><stop offset="0" stop-color="{c1}"/>'
                 f'<stop offset="1" stop-color="{c2}"/></linearGradient>'
                 f'<radialGradient id="glow" cx="{bx / W:.2f}" cy="{by / H:.2f}" r="0.45">'
                 f'<stop offset="0" stop-color="#3CC0D8" stop-opacity="0.28"/>'
                 f'<stop offset="1" stop-color="#3CC0D8" stop-opacity="0"/></radialGradient></defs>')
    parts.append(f'<rect width="{W}" height="{H}" fill="url(#g)"/><rect width="{W}" height="{H}" fill="url(#glow)"/>')
    pipes = "".join(f"M{a[0]:.1f} {a[1]:.1f}L{b[0]:.1f} {b[1]:.1f}" for a, b in edges)
    parts.append(f'<path d="{pipes}" stroke="#9FD3E6" stroke-opacity="0.22" stroke-width="2" fill="none" stroke-linecap="round"/>')
    if len(route) > 1:
        rd = "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in route)
        parts.append(f'<path d="{rd}" stroke="#3CC0D8" stroke-opacity="0.85" stroke-width="3" fill="none" '
                     f'stroke-linecap="round" stroke-linejoin="round"/>')
    for x, y in nodes:
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="#9FD3E6" fill-opacity="0.45"/>')
    for x, y in route:
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.2" fill="#3CC0D8"/>')
    if route:
        sx, sy = route[0]
        parts.append(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="7" fill="#E9A23B"/>')
    # topic badge
    parts.append(f'<circle cx="{bx}" cy="{by}" r="52" fill="#032141" fill-opacity="0.72" stroke="#3CC0D8" stroke-width="2.5"/>')
    s = 2.6
    parts.append(f'<g transform="translate({bx - 12 * s} {by - 12 * s}) scale({s})" fill="none" stroke="#FFFFFF" '
                 f'stroke-width="{1.6:.1f}" stroke-linecap="round" stroke-linejoin="round">{ICONS[topic]}</g>')
    parts.append("</svg>")
    return "".join(parts), kind, topic


def main():
    made = []
    for collection in ("publications", "presentations"):
        os.makedirs(os.path.join(OUT, collection), exist_ok=True)
        for path in sorted(glob.glob(os.path.join(ROOT, f"_{collection}", "**", "*.md"), recursive=True)):
            slug = os.path.splitext(os.path.basename(path))[0]
            fm = front_matter(path)
            svg, kind, topic = tile_svg(fm, collection, slug)
            with open(os.path.join(OUT, collection, slug + ".svg"), "w", encoding="utf-8") as f:
                f.write(svg)
            made.append((collection, slug, kind, topic, str(fm.get("title", ""))[:60]))
    for row in made:
        print(" | ".join(row))


if __name__ == "__main__":
    main()
