#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import boto3
import shutil
from botocore.config import Config
from dotenv import load_dotenv


# Load env variables from root .env
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(base_dir)
dotenv_path = os.path.join(project_root, '.env')
load_dotenv(dotenv_path)

R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME')
R2_PUBLIC_URL = os.getenv('R2_PUBLIC_URL', 'https://pub-your-id.r2.dev')

def is_placeholder(val):
    if not val:
        return True
    return any(p in val.lower() for p in ['your-cloudflare', 'your-r2', 'your-bucket', 'placeholder'])

def convert_wav_to_mp3(input_wav: str, output_mp3: str):
    """
    Converts a WAV file to MP3 format using FFmpeg.
    """
    if not os.path.exists(input_wav):
        raise FileNotFoundError(f"WAV file not found at: {input_wav}")
        
    cmd = [
        'ffmpeg', '-y',
        '-i', input_wav,
        '-codec:a', 'libmp3lame',
        '-qscale:a', '2',
        output_mp3
    ]
    print(f"Converting WAV to MP3: {' '.join(cmd)}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg conversion failed: {result.stderr.decode('utf-8')}")
    print(f"Conversion completed: {output_mp3}")

def remove_silence_from_wav(input_wav: str, output_wav: str):
    """
    Removes silence from a WAV file using FFmpeg's silenceremove filter.
    Falls back to copying the input_wav to output_wav if silence removal fails.
    """
    if not os.path.exists(input_wav):
        raise FileNotFoundError(f"WAV file not found at: {input_wav}")
        
    cmd = [
        'ffmpeg', '-y',
        '-i', input_wav,
        '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-45dB',
        output_wav
    ]
    print(f"Removing silence from WAV: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            print(f"Warning: FFmpeg silence removal exited with code {result.returncode}. Stderr: {result.stderr.decode('utf-8')}", file=sys.stderr)
            raise RuntimeError("FFmpeg silence removal failed")
            
        if not os.path.exists(output_wav) or os.path.getsize(output_wav) == 0:
            print("Warning: Silence removal output is missing or empty. Falling back to original vocals.", file=sys.stderr)
            raise RuntimeError("Empty silence removal output")
            
        print(f"Silence removal completed successfully: {output_wav}")
    except Exception as e:
        print(f"Error during silence removal ({e}). Falling back to copying original file.", file=sys.stderr)
        if os.path.exists(output_wav):
            try:
                os.remove(output_wav)
            except Exception:
                pass
        shutil.copy2(input_wav, output_wav)
        print("Copied original WAV to silence-removed output as fallback.")

def upload_file_to_r2(local_path: str, r2_key: str) -> str:
    """
    Uploads a local file to Cloudflare R2 bucket.
    Returns the public URL of the uploaded file.
    """
    # Check if we should use mock upload
    if (is_placeholder(R2_ACCOUNT_ID) or 
        is_placeholder(R2_ACCESS_KEY_ID) or 
        is_placeholder(R2_SECRET_ACCESS_KEY) or 
        is_placeholder(R2_BUCKET_NAME)):
        print(f"[MOCK UPLOAD] S3 credentials are placeholder or empty. Skipping actual upload for key: {r2_key}")
        return f"{R2_PUBLIC_URL.rstrip('/')}/{r2_key}"

    print(f"Uploading {local_path} to R2 bucket {R2_BUCKET_NAME} with key {r2_key}...")
    
    endpoint_url = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    s3_client = boto3.client(
        service_name='s3',
        endpoint_url=endpoint_url,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version='s3v4')
    )
    
    # Upload file
    extra_args = {
        'ContentType': 'audio/mpeg' if local_path.endswith('.mp3') else 'audio/wav'
    }
    
    s3_client.upload_file(
        Filename=local_path,
        Bucket=R2_BUCKET_NAME,
        Key=r2_key,
        ExtraArgs=extra_args
    )
    
    public_url = f"{R2_PUBLIC_URL.rstrip('/')}/{r2_key}"
    print(f"Successfully uploaded {r2_key}. Public URL: {public_url}")
    return public_url

def main():
    parser = argparse.ArgumentParser(description="Convert separated tracks and upload to Cloudflare R2.")
    parser.add_argument("--job-id", required=True, help="Job UUID")
    parser.add_argument("--input-dir", required=True, help="Directory containing separated audio tracks")
    args = parser.parse_args()
    
    job_id = args.job_id
    input_dir = args.input_dir
    
    # Locate Demucs output
    # Demucs output folder is under {input_dir}/{model}/audio/
    model = os.getenv("DEMUCS_MODEL", "htdemucs")
    vocals_wav = os.path.join(input_dir, model, "audio", "vocals.wav")
    no_vocals_wav = os.path.join(input_dir, model, "audio", "no_vocals.wav")
    
    if not os.path.exists(vocals_wav) or not os.path.exists(no_vocals_wav):
        # Scan input_dir recursively for vocals.wav and no_vocals.wav (just in case)
        found_vocals = None
        found_no_vocals = None
        for root, dirs, files in os.walk(input_dir):
            if "vocals.wav" in files:
                found_vocals = os.path.join(root, "vocals.wav")
            if "no_vocals.wav" in files:
                found_no_vocals = os.path.join(root, "no_vocals.wav")
        
        if found_vocals and found_no_vocals:
            vocals_wav = found_vocals
            no_vocals_wav = found_no_vocals
        else:
            raise FileNotFoundError(f"Could not locate vocals.wav or no_vocals.wav in {input_dir}")
            
    # Converted MP3 files local paths
    vocals_mp3 = os.path.join(input_dir, "vocals.mp3")
    vocals_no_silence_mp3 = os.path.join(input_dir, "vocals_no_silence.mp3")
    instrumental_mp3 = os.path.join(input_dir, "instrumental.mp3")
    
    # Locate/create path for vocals_no_silence.wav
    vocals_no_silence_wav = os.path.join(os.path.dirname(vocals_wav), "vocals_no_silence.wav")

    # 1. Process Silence Removal on vocals
    print("Processing silence removal from vocals...")
    remove_silence_from_wav(vocals_wav, vocals_no_silence_wav)

    # 2. Convert to MP3
    print("Converting vocals.wav to vocals.mp3...")
    convert_wav_to_mp3(vocals_wav, vocals_mp3)
    
    print("Converting vocals_no_silence.wav to vocals_no_silence.mp3...")
    convert_wav_to_mp3(vocals_no_silence_wav, vocals_no_silence_mp3)
    
    print("Converting no_vocals.wav to instrumental.mp3...")
    convert_wav_to_mp3(no_vocals_wav, instrumental_mp3)
    
    # 3. Upload to R2
    vocals_key = f"tracks/{job_id}/vocals.mp3"
    vocals_no_silence_key = f"tracks/{job_id}/vocals_no_silence.mp3"
    instrumental_key = f"tracks/{job_id}/instrumental.mp3"
    
    vocal_url = upload_file_to_r2(vocals_mp3, vocals_key)
    vocal_no_silence_url = upload_file_to_r2(vocals_no_silence_mp3, vocals_no_silence_key)
    instrumental_url = upload_file_to_r2(instrumental_mp3, instrumental_key)
    
    # 4. Print URLs for parent Node process to capture
    print(f"VOCAL_URL: {vocal_url}")
    print(f"VOCAL_NO_SILENCE_URL: {vocal_no_silence_url}")
    print(f"INSTRUMENTAL_URL: {instrumental_url}")
    print("UPLOAD_SUCCESS")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error in uploader: {e}", file=sys.stderr)
        sys.exit(1)
