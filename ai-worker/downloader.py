#!/usr/bin/env python3
import os
import argparse
import sys
import yt_dlp

def download_audio(url: str, output_dir: str) -> str:
    """
    Downloads audio from a YouTube URL and extracts it as a WAV file.
    Saves it as `audio.wav` inside the output directory.
    Returns the absolute path to the downloaded WAV file.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # We want to force the output filename to be "audio.wav".
    # yt-dlp with FFmpegExtractAudio postprocessor will rename the final converted
    # file matching the outtmpl base name.
    output_template = os.path.join(output_dir, 'audio.%(ext)s')
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '0',  # Best quality (VBR / high quality)
        }],
        'quiet': False,
        'no_warnings': False,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Sec-Fetch-Mode': 'navigate',
        }
    }
    
    final_output_path = os.path.join(output_dir, 'audio.wav')
    if os.path.exists(final_output_path):
        print(f"Removing existing file at {final_output_path}")
        os.remove(final_output_path)

    print(f"Downloading from URL: {url}")
    print(f"Saving using template: {output_template}")
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as e:
        err_msg = str(e)
        if any(term in err_msg.lower() for term in ["sign in", "age", "confirm your age", "confirm_age"]):
            raise RuntimeError("YouTube age restriction detected. This video requires age verification or sign-in and cannot be downloaded.")
        elif any(term in err_msg.lower() for term in ["geo-restricted", "country", "not available in your", "geoblocked"]):
            raise RuntimeError("YouTube geo-restriction detected. This video is country-locked.")
        elif "copyright" in err_msg.lower():
            raise RuntimeError("This video is blocked due to copyright restrictions.")
        else:
            raise RuntimeError(f"Failed to download audio from YouTube: {err_msg}")
        
    if not os.path.exists(final_output_path):
        # Fallback in case naming differed
        print("Warning: Expected audio.wav not found at standard path. Scanning output directory...")
        wav_files = [f for f in os.listdir(output_dir) if f.endswith('.wav')]
        if wav_files:
            fallback_path = os.path.join(output_dir, wav_files[0])
            os.rename(fallback_path, final_output_path)
            print(f"Renamed fallback file {fallback_path} to {final_output_path}")
        else:
            raise FileNotFoundError("Failed to download and extract audio in WAV format.")
            
    print(f"Successfully downloaded and extracted audio: {final_output_path}")
    return final_output_path

def main():
    parser = argparse.ArgumentParser(description="Download audio from YouTube and extract as WAV.")
    parser.add_argument("--url", required=True, help="YouTube URL to download")
    parser.add_argument("--output", required=True, help="Output directory to save the audio file")
    args = parser.parse_args()
    
    try:
        download_audio(args.url, args.output)
    except Exception as e:
        print(f"Error downloading audio: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
