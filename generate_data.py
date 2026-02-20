#!/usr/bin/env python3
"""Scan images/ and generate photos-data.js grouping photos by Instagram post shortcode."""

import json, re, os
from pathlib import Path
from collections import OrderedDict

ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "images"

def main():
    files = sorted(f.name for f in IMAGES_DIR.iterdir()
                   if f.is_file() and f.name.startswith("ig_") and f.suffix in (".jpg", ".jpeg", ".png", ".webp"))

    works = OrderedDict()
    for fname in files:
        m = re.match(r"ig_(\d+)_(.+)\.(jpg|jpeg|png|webp)$", fname)
        if not m:
            continue
        shortcode = m.group(2)
        works.setdefault(shortcode, []).append(f"images/{fname}")

    work_list = []
    for idx, (shortcode, images) in enumerate(works.items(), start=1):
        work_list.append({
            "id": f"work_{idx:03d}",
            "shortcode": shortcode,
            "title": to_roman(idx),
            "cover": images[0],
            "images": images,
            "count": len(images),
        })

    payload = {"username": "objectif_zonard", "total_works": len(work_list), "works": work_list}
    js_content = f"window.PHOTO_DATA = {json.dumps(payload, indent=2, ensure_ascii=False)};\n"
    (ROOT / "photos-data.js").write_text(js_content, encoding="utf-8")
    print(f"[done] Generated photos-data.js with {len(work_list)} works, {len(files)} images total.")

def to_roman(num):
    vals = [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),
            (50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]
    result = ''
    for v, r in vals:
        while num >= v:
            result += r
            num -= v
    return result

if __name__ == "__main__":
    main()
