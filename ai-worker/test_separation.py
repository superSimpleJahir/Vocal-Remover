#!/usr/bin/env python3
import os
import shutil
import sys
import argparse

try:
    from dotenv import load_dotenv
    # Load env variables from root .env
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)
    dotenv_path = os.path.join(project_root, '.env')
    load_dotenv(dotenv_path)
except ImportError:
    pass

# Add current directory to path so we can import downloader and separator
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from downloader import download_audio
    from separator import separate_audio
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Test script for downloading and separating YouTube audio.")
    parser.add_argument(
        "--url", 
        default="https://www.youtube.com/watch?v=T-2nPAW3T2s",  # A short video (~5 seconds)
        help="YouTube URL to test with (default: a short 5-second video)"
    )
    args = parser.parse_args()

    # Define output directories relative to project root
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)
    test_dir = os.path.join(project_root, "test_runs")
    downloads_dir = os.path.join(test_dir, "downloads")
    separated_dir = os.path.join(test_dir, "separated")

    print(f"Cleaning up previous test runs in {test_dir}...")
    if os.path.exists(test_dir):
        try:
            shutil.rmtree(test_dir)
        except Exception as e:
            print(f"Warning: Failed to clean up {test_dir}: {e}")
    os.makedirs(test_dir, exist_ok=True)

    print("\n--- Step 1: Downloading audio from YouTube ---")
    try:
        audio_path = download_audio(args.url, downloads_dir, allow_fallback=True)
        print(f"Success! Audio downloaded to: {audio_path}")
    except Exception as e:
        print(f"Failed to download audio: {e}")
        sys.exit(1)

    print("\n--- Step 2: Separating audio tracks using Demucs ---")
    try:
        separate_audio(audio_path, separated_dir)
        print("Success! Separation execution finished.")
    except Exception as e:
        print(f"Failed to separate audio: {e}")
        sys.exit(1)

    # Verification
    # By default, demucs names output folder based on the filename (which is 'audio')
    # and default model is htdemucs
    model = os.getenv("DEMUCS_MODEL", "htdemucs")
    expected_vocals = os.path.join(separated_dir, model, "audio", "vocals.wav")
    expected_no_vocals = os.path.join(separated_dir, model, "audio", "no_vocals.wav")

    print("\n--- Step 3: Verifying output files ---")
    all_ok = True
    if not os.path.exists(expected_vocals):
        print(f"ERROR: Expected vocals file not found at: {expected_vocals}")
        all_ok = False
    else:
        print(f"Verified vocals file exists: {expected_vocals} ({os.path.getsize(expected_vocals)} bytes)")

    if not os.path.exists(expected_no_vocals):
        print(f"ERROR: Expected instrumental file not found at: {expected_no_vocals}")
        all_ok = False
    else:
        print(f"Verified instrumental file exists: {expected_no_vocals} ({os.path.getsize(expected_no_vocals)} bytes)")

    if all_ok:
        print("\nSANITY TEST COMPLETED SUCCESSFULLY! All files verified.")
        sys.exit(0)
    else:
        print("\nSANITY TEST FAILED! Some expected output files were missing.")
        sys.exit(1)

if __name__ == "__main__":
    main()
