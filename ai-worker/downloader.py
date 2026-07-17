#!/usr/bin/env python3
import os
import argparse
import sys
import yt_dlp

def download_audio(url: str, output_dir: str, allow_fallback: bool = False) -> str:
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
        'extractor_args': {
            'youtube': {
                'player_client': ['android']
            }
        },
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
    except Exception as e:
        if not allow_fallback:
            print(f"Error: YouTube download failed: {e}", file=sys.stderr)
            raise e
            
        print(f"Warning: YouTube download failed ({e}). Falling back to downloading a sample audio file for testing...", file=sys.stderr)
        import urllib.request
        import subprocess
        fallback_url = "https://ccrma.stanford.edu/~jos/mp3/pno-cs.mp3"
        temp_mp3_path = os.path.join(output_dir, 'temp_fallback.mp3')
        
        try:
            # Download the fallback file
            print(f"Downloading fallback audio from: {fallback_url}")
            urllib.request.urlretrieve(fallback_url, temp_mp3_path)
            
            # Convert fallback MP3 to WAV using FFmpeg
            print(f"Converting fallback MP3 to WAV format...")
            cmd = ['ffmpeg', '-y', '-i', temp_mp3_path, final_output_path]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg fallback conversion failed: {result.stderr.decode('utf-8')}")
            
            # Clean up temp file
            if os.path.exists(temp_mp3_path):
                os.remove(temp_mp3_path)
            
            print(f"Successfully downloaded and converted fallback audio file to {final_output_path}")
        except Exception as fallback_err:
            raise RuntimeError(f"YouTube download failed, and fallback audio download also failed: {fallback_err}. Original error: {e}")
        
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
    parser.add_argument("--allow-fallback", action="store_true", help="Allow fallback to sample piano audio on failure")
    args = parser.parse_args()
    
    try:
        download_audio(args.url, args.output, allow_fallback=args.allow_fallback)
    except Exception as e:
        print(f"Error downloading audio: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
