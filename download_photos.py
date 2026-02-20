#!/usr/bin/env python3
"""
Sync Instagram photos for the local portfolio site.

Usage:
  python download_photos.py
  python download_photos.py --username objectif_zonard
  python download_photos.py --max-posts 0 --max-photos 0

Notes:
  - --max-posts 0 means: scan all available posts.
  - --max-photos 0 means: keep all available photos.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import quote, urlparse

import requests
from playwright.sync_api import sync_playwright

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

TIMELINE_DOC_ID = "7950326061742207"


@dataclass
class PostCard:
    post_url: str
    image_url: str
    alt_text: str


@dataclass
class ScrapeResult:
    cards: List[PostCard]
    profile_image_url: str


def clean_text(value: str, fallback: str) -> str:
    text = re.sub(r"\s+", " ", (value or "").strip())
    if not text:
        return fallback
    return text


def get_shortcode(post_url: str) -> str:
    match = re.search(r"/(?:p|reel)/([^/?#]+)/?", post_url)
    if match:
        return match.group(1)
    return "post"


def ext_from_content_type(content_type: str) -> str:
    value = (content_type or "").lower().split(";")[0].strip()
    if value == "image/jpeg":
        return ".jpg"
    if value == "image/png":
        return ".png"
    if value == "image/webp":
        return ".webp"
    if value == "image/heic":
        return ".heic"
    return ""


def ext_from_url(image_url: str) -> str:
    path = urlparse(image_url).path.lower()
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".heic"):
        if path.endswith(ext):
            return ext
    return ".jpg"


def classify_category(title: str) -> Tuple[str, str]:
    text = (title or "").lower()

    groups = [
        ("event", "Evenement", ["party", "concert", "festival", "crowd", "dancing", "tekno", "rave", "sound"]),
        ("voyage", "Voyage", ["morocco", "ocean", "beach", "coast", "horizon", "nature", "water", "sea"]),
        ("nuit", "Nuit", ["night", "nuit", "neon", "twilight", "dark", "lighting", "sunset", "lights"]),
        (
            "urbain",
            "Urbain",
            ["street", "city", "urban", "bus", "train", "poster", "building", "graffiti", "terminal", "trolley", "outdoors"],
        ),
        ("portrait", "Portrait", ["portrait", "people", "person", "face", "selfie", "man", "woman"]),
    ]
    for key, label, keywords in groups:
        if any(word in text for word in keywords):
            return key, label
    return "urbain", "Urbain"


def caption_from_node(node: Dict) -> str:
    caption_edges = node.get("edge_media_to_caption", {}).get("edges", [])
    if caption_edges:
        maybe_text = caption_edges[0].get("node", {}).get("text", "")
        if maybe_text:
            return str(maybe_text)

    accessibility = node.get("accessibility_caption")
    if accessibility:
        return str(accessibility)

    return ""


def dismiss_cookie_banner(page) -> None:
    selectors = [
        "button:has-text('Autoriser tous les cookies')",
        "button:has-text('Accepter tout')",
        "button:has-text('Accept all')",
        "button:has-text('Allow all cookies')",
    ]
    for selector in selectors:
        loc = page.locator(selector)
        if loc.count() > 0:
            try:
                loc.first.click(timeout=2000)
                page.wait_for_timeout(700)
                return
            except Exception:
                continue


def parse_timeline(data: Dict) -> Tuple[List[Dict], Dict]:
    user = data.get("data", {}).get("user", {})
    timeline = user.get("edge_owner_to_timeline_media", {})
    edges = timeline.get("edges", [])
    page_info = timeline.get("page_info", {})
    return edges, page_info


def collect_post_cards(username: str, max_posts: int, max_photos: int) -> ScrapeResult:
    profile_url = f"https://www.instagram.com/{username}/"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1400, "height": 2200},
            locale="fr-FR",
        )
        page = context.new_page()

        web_profile_payload: Optional[Dict] = None

        def on_response(resp):
            nonlocal web_profile_payload
            if "web_profile_info/?username=" in resp.url and f"username={username}" in resp.url:
                try:
                    web_profile_payload = resp.json()
                except Exception:
                    pass

        page.on("response", on_response)

        print(f"[info] Opening {profile_url}")
        page.goto(profile_url, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(3500)
        dismiss_cookie_banner(page)
        page.wait_for_timeout(1200)

        if not web_profile_payload:
            fallback_url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
            fallback_resp = context.request.get(fallback_url, headers={"x-ig-app-id": "936619743392459"})
            if fallback_resp.ok:
                web_profile_payload = fallback_resp.json()

        if not web_profile_payload:
            browser.close()
            raise RuntimeError("Unable to read profile payload from Instagram.")

        user = web_profile_payload.get("data", {}).get("user", {})
        user_id = user.get("id", "")
        if not user_id:
            browser.close()
            raise RuntimeError("Missing user id in profile payload.")

        profile_image_url = user.get("profile_pic_url_hd") or user.get("profile_pic_url") or ""

        # Build ordered unique list of post nodes.
        timeline = user.get("edge_owner_to_timeline_media", {})
        all_nodes: List[Dict] = []
        seen_shortcodes: Set[str] = set()

        def add_edges(edges: List[Dict]) -> None:
            for edge in edges:
                node = edge.get("node", {})
                shortcode = node.get("shortcode")
                if not shortcode or shortcode in seen_shortcodes:
                    continue
                seen_shortcodes.add(shortcode)
                all_nodes.append(node)

        add_edges(timeline.get("edges", []))
        page_info = timeline.get("page_info", {})

        while page_info.get("has_next_page"):
            if max_posts > 0 and len(all_nodes) >= max_posts:
                break

            end_cursor = page_info.get("end_cursor")
            if not end_cursor:
                break

            variables = json.dumps({"id": user_id, "after": end_cursor, "first": 12}, separators=(",", ":"))
            graphql_url = (
                "https://www.instagram.com/graphql/query/"
                f"?doc_id={TIMELINE_DOC_ID}&variables={quote(variables, safe='')}"
            )

            resp = context.request.get(graphql_url)
            if not resp.ok:
                print(f"[warn] Pagination stopped: HTTP {resp.status}")
                break

            payload = resp.json()
            edges, page_info = parse_timeline(payload)
            if not edges:
                break
            add_edges(edges)
            print(f"[info] Collected {len(all_nodes)} post(s)")

        if max_posts > 0:
            all_nodes = all_nodes[:max_posts]

        cards: List[PostCard] = []
        seen_media_urls: Set[str] = set()

        for post_index, node in enumerate(all_nodes, start=1):
            shortcode = node.get("shortcode", "")
            if not shortcode:
                continue

            post_url = f"https://www.instagram.com/{username}/p/{shortcode}/"
            fallback_title = f"Photo Instagram {post_index}"
            base_caption = clean_text(caption_from_node(node), fallback_title)

            sidecar_edges = node.get("edge_sidecar_to_children", {}).get("edges", [])
            if sidecar_edges:
                for child in sidecar_edges:
                    child_node = child.get("node", {})
                    if child_node.get("is_video"):
                        continue

                    image_url = child_node.get("display_url") or child_node.get("thumbnail_src") or ""
                    if not image_url or image_url in seen_media_urls:
                        continue

                    seen_media_urls.add(image_url)
                    cards.append(PostCard(post_url=post_url, image_url=image_url, alt_text=base_caption))

                    if max_photos > 0 and len(cards) >= max_photos:
                        break
            else:
                if node.get("is_video"):
                    continue

                image_url = node.get("display_url") or node.get("thumbnail_src") or ""
                if image_url and image_url not in seen_media_urls:
                    seen_media_urls.add(image_url)
                    cards.append(PostCard(post_url=post_url, image_url=image_url, alt_text=base_caption))

            if max_photos > 0 and len(cards) >= max_photos:
                break

        print(f"[info] Collected {len(cards)} photo(s) from {len(all_nodes)} post(s)")
        context.close()
        browser.close()

        return ScrapeResult(cards=cards, profile_image_url=profile_image_url)


def download_images(
    cards: List[PostCard],
    username: str,
    images_dir: Path,
    metadata_path: Path,
    metadata_js_path: Path,
    profile_image_url: str,
) -> int:
    images_dir.mkdir(parents=True, exist_ok=True)

    for old_file in images_dir.glob("ig_*.*"):
        old_file.unlink(missing_ok=True)
    for old_file in images_dir.glob("profile_*.*"):
        old_file.unlink(missing_ok=True)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Referer": f"https://www.instagram.com/{username}/"})

    photos = []
    category_counts: Dict[str, int] = {}
    category_labels: Dict[str, str] = {}

    for index, card in enumerate(cards, start=1):
        try:
            response = session.get(card.image_url, timeout=45)
            response.raise_for_status()
        except Exception as exc:  # pylint: disable=broad-except
            print(f"[warn] Skip {card.post_url}: {exc}")
            continue

        ext = ext_from_content_type(response.headers.get("content-type", "")) or ext_from_url(card.image_url)
        shortcode = get_shortcode(card.post_url)
        filename = f"ig_{index:04d}_{shortcode}{ext}"
        output_file = images_dir / filename
        output_file.write_bytes(response.content)

        fallback_title = f"Photo Instagram {index}"
        title = clean_text(card.alt_text, fallback_title)
        category_key, category_label = classify_category(title)
        category_counts[category_key] = category_counts.get(category_key, 0) + 1
        category_labels[category_key] = category_label

        photos.append(
            {
                "title": title[:140],
                "file": f"images/{filename}",
                "instagram_url": card.post_url,
                "category_key": category_key,
                "category_label": category_label,
            }
        )
        print(f"[ok] Saved {filename}")

    profile_image_file = ""
    if profile_image_url:
        try:
            profile_response = session.get(profile_image_url, timeout=45)
            profile_response.raise_for_status()
            profile_ext = ext_from_content_type(profile_response.headers.get("content-type", "")) or ext_from_url(profile_image_url)
            profile_filename = f"profile_{username}{profile_ext}"
            (images_dir / profile_filename).write_bytes(profile_response.content)
            profile_image_file = f"images/{profile_filename}"
            print(f"[ok] Saved {profile_filename}")
        except Exception as exc:  # pylint: disable=broad-except
            print(f"[warn] Failed to save profile image: {exc}")

    categories = [
        {"key": key, "label": category_labels[key], "count": count}
        for key, count in sorted(category_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    payload = {
        "username": username,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(photos),
        "posts_synced": len({card.post_url for card in cards}),
        "profile_image": profile_image_file,
        "categories": categories,
        "photos": photos,
    }
    metadata_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    js_payload = json.dumps(payload, ensure_ascii=False)
    metadata_js_path.write_text(f"window.PHOTO_DATA = {js_payload};\n", encoding="utf-8")
    return len(photos)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download public Instagram profile photos into this portfolio.")
    parser.add_argument("--username", default="objectif_zonard", help="Instagram username")
    parser.add_argument("--max-posts", type=int, default=0, help="Maximum number of posts to scan (0 = all)")
    parser.add_argument("--max-photos", type=int, default=0, help="Maximum number of photos to save (0 = all)")
    parser.add_argument("--max", type=int, default=None, help="Backward-compatible alias of --max-posts")
    args = parser.parse_args()

    max_posts = args.max_posts
    if args.max is not None:
        max_posts = args.max

    root = Path(__file__).resolve().parent
    images_dir = root / "images"
    metadata_path = root / "photos.json"
    metadata_js_path = root / "photos-data.js"

    scrape_result = collect_post_cards(args.username, max_posts=max_posts, max_photos=args.max_photos)
    if not scrape_result.cards:
        print("[error] No photos were extracted. Try again later.")
        return 1

    saved_count = download_images(
        scrape_result.cards,
        args.username,
        images_dir,
        metadata_path,
        metadata_js_path,
        scrape_result.profile_image_url,
    )
    print(f"[done] Synced {saved_count} photo(s) into {images_dir}")
    print(f"[done] Metadata written to {metadata_path}")
    print(f"[done] JS metadata written to {metadata_js_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
