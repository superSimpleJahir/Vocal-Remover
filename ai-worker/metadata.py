#!/usr/bin/env python3
import os
import sys
import json
import argparse
import urllib.request
import yt_dlp
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")


def fetch_youtube_info(url: str) -> dict:
    """
    Reads metadata (title/description/tags/thumbnail) for a YouTube URL
    without downloading the actual video/audio stream.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android']
            }
        },
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    return {
        'title': info.get('title') or '',
        'description': info.get('description') or '',
        'tags': info.get('tags') or [],
        'thumbnail': info.get('thumbnail') or '',
        'uploader': info.get('uploader') or '',
    }


def generate_ai_metadata(original_title: str, original_description: str, original_tags: list) -> dict:
    """
    Asks a local Ollama model to rewrite the original song metadata into
    YouTube title/description/tags for an instrumental (vocals-removed) upload.
    """
    prompt = f"""You are a helpful assistant that writes YouTube metadata for an instrumental / vocal-removed version of an existing song.

Original title: {original_title}
Original description (context only, may be truncated): {(original_description or '')[:500]}
Original tags: {', '.join(original_tags[:15])}

Write NEW YouTube metadata for the INSTRUMENTAL / VOCALS-REMOVED version of this song.
Rules:
- "title": catchy, SEO-friendly, under 100 characters, must contain "Instrumental" or "No Vocals" or "Karaoke".
- "description": 2-4 natural sentences, mention it is an AI-generated vocal-removed/instrumental version of the original song.
- "tags": a list of 8-12 short relevant tags (single words or short phrases).

Respond with ONLY valid JSON, no extra text, in exactly this shape:
{{"title": "...", "description": "...", "tags": ["...", "..."]}}
"""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        result = json.loads(resp.read().decode('utf-8'))

    parsed = json.loads(result.get('response', '{}'))
    return {
        'title': (parsed.get('title') or original_title).strip(),
        'description': (parsed.get('description') or '').strip(),
        'tags': [str(t).strip() for t in (parsed.get('tags') or []) if str(t).strip()],
    }


def generate_thumbnail(thumbnail_url: str, output_path: str, overlay_text: str = "INSTRUMENTAL"):
    """
    Downloads the original YouTube thumbnail and overlays a branded
    "INSTRUMENTAL" style caption on a darkened/blurred copy of it.
    """
    if not thumbnail_url:
        return None

    tmp_path = output_path + '.src.jpg'
    urllib.request.urlretrieve(thumbnail_url, tmp_path)

    try:
        img = Image.open(tmp_path).convert('RGB')
        img = img.resize((1280, 720))

        # Darken the source image so overlay text stays readable
        overlay = Image.new('RGB', img.size, (0, 0, 0))
        img = Image.blend(img, overlay, 0.4)
        img = img.filter(ImageFilter.GaussianBlur(radius=1.5))

        draw = ImageDraw.Draw(img)
        font = None
        for font_path in [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]:
            try:
                font = ImageFont.truetype(font_path, 96)
                break
            except Exception:
                continue
        if font is None:
            font = ImageFont.load_default()

        text = overlay_text.upper()
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (img.width - text_w) / 2
        y = (img.height - text_h) / 2 - bbox[1]

        draw.text((x, y), text, font=font, fill=(255, 255, 255), stroke_width=6, stroke_fill=(0, 0, 0))

        img.save(output_path, quality=90)
        return output_path
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def main():
    parser = argparse.ArgumentParser(description="Fetch YouTube metadata, generate AI title/description/tags, and build a thumbnail.")
    parser.add_argument("--url", required=True, help="YouTube URL to read metadata from")
    parser.add_argument("--output-dir", required=True, help="Directory to save thumbnail.jpg into")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    info = fetch_youtube_info(args.url)

    try:
        generated = generate_ai_metadata(info['title'], info['description'], info['tags'])
    except Exception as e:
        print(f"Warning: AI metadata generation failed, falling back to original title: {e}", file=sys.stderr)
        generated = {'title': info['title'], 'description': '', 'tags': info['tags']}

    thumbnail_path = os.path.join(args.output_dir, 'thumbnail.jpg')
    thumbnail_file = None
    try:
        if generate_thumbnail(info['thumbnail'], thumbnail_path):
            thumbnail_file = 'thumbnail.jpg'
    except Exception as e:
        print(f"Warning: Thumbnail generation failed: {e}", file=sys.stderr)

    result = {
        'original': {
            'title': info['title'],
            'description': info['description'],
            'tags': info['tags'],
            'thumbnail': info['thumbnail'],
        },
        'generated': generated,
        'thumbnailFile': thumbnail_file,
    }

    print("METADATA_JSON:" + json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error in metadata generation: {e}", file=sys.stderr)
        sys.exit(1)
