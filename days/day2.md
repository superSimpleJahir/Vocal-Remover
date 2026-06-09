# Day 2: Python Core Separation (yt-dlp & Demucs)

Today's focus is building the core AI worker logic: downloading audio from YouTube URLs using `yt-dlp` and splitting the audio tracks using the `demucs` model.

## Tasks Checklist
- [ ] **Download Script**: Implement `ai-worker/downloader.py` to extract high-quality audio files from YouTube URLs.
- [ ] **Separation Script**: Implement `ai-worker/separator.py` to execute Demucs 2-stem separation.
- [ ] **Sanity Test**: Create a local test script `ai-worker/test_separation.py` to verify the download and separation loop.

---

## Technical Details

### Dependencies
Create `ai-worker/requirements.txt` containing:
```text
yt-dlp==2024.3.10
demucs==4.0.1
boto3==1.34.84
psycopg2-binary==2.9.9
python-dotenv==1.0.1
```

### Downloader: `ai-worker/downloader.py`
Uses `yt-dlp` to fetch audio streams from YouTube. It converts them to standard `wav` format and stores them in a local temporary directory:
- Input: YouTube URL, Output Directory.
- Outputs a single high-quality WAV audio file.

### Separator: `ai-worker/separator.py`
Executes Demucs using the command-line or PyTorch library interface:
```bash
demucs --two-stems=vocals -d cpu input_audio.wav
```
- Splits audio into:
  - `vocals.wav`: Vocal tracks.
  - `no_vocals.wav`: Instrumental tracks.
- Includes checking for CUDA availability to use GPU acceleration when available.

---

## Verification
Run a simple script to verify the audio is downloaded and split:
```bash
python ai-worker/downloader.py --url "YOUR_YOUTUBE_URL" --output "./downloads"
python ai-worker/separator.py --input "./downloads/audio.wav" --output "./separated"
```
Check that the `separated/htdemucs/audio/` directory contains `vocals.wav` and `no_vocals.wav`.
