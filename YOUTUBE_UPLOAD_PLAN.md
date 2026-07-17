# YouTube Auto-Uploader & Simplified Stack Plan (Database/Redis Removal)

Ei document-e step-by-step guideline dewa holo jate apni pore db/redis dynamically bad diye shudhu YouTube-e direct vocal video auto-upload feature implement korte paren.

---

## 1. Database and Redis Removal (Simplified Node.js Backend)

Amader database (PostgreSQL/Supabase) and Redis service bad diye server context-e jobs variable update track korte hobe.

### **Action Steps:**
1. **Remove Packages:** `backend/package.json` theke `bullmq`, `pg` tools remove korte hobe.
2. **In-Memory Store:** `backend/index.js` file-e database query bad diye direct variable mapping implement korte hobe:
   ```javascript
   // Temporary in-memory database
   const jobs = {};
   ```
3. **In-Memory Queue:** BullMQ er bodle Node.js runtime process queues block na kore, memory execution queue add korte hobe.
   Example:
   ```javascript
   const queue = [];
   let processing = false;

   async function processQueue() {
     if (processing || queue.length === 0) return;
     processing = true;
     const jobId = queue.shift();
     const job = jobs[jobId];

     try {
       job.status = 'downloading';
       // Call python download, separation, video create and YouTube upload
       // Using child_process spawn...
       job.status = 'completed';
     } catch (err) {
       job.status = 'failed';
       job.error_message = err.message;
     } finally {
       processing = false;
       processQueue(); // Process next job
     }
   }
   ```

---

## 2. Audio-to-Video conversion (FFmpeg)

YouTube custom audio formats support kore na. Tai audio separated dynamically convert hobar por target folder-e background status layout combine kore video design korte hobe.

### **FFmpeg Command Integration:**
Amader python worker segment (`uploader.py` ba separate script)-e FFmpeg shell subprocess use kore audio and a cover art image loop kore MP4 compile korte hobe:
```python
import subprocess

def create_video(audio_path, image_path, output_mp4_path):
    cmd = [
        'ffmpeg', '-y',
        '-loop', '1',
        '-i', image_path,
        '-i', audio_path,
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        output_mp4_path
    ]
    subprocess.run(cmd, check=True)
```

---

## 3. YouTube API Setup & Auto Upload

### **A. Google Cloud Console Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Ekta new project create korun and search bar-e **YouTube Data API v3** search kore ota active/enable korun.
3. **OAuth Consent Screen** setup korun (User Type: External, status testing e rakhle hobe). Scopes-e `youtube.upload` write permission selection dynamic select korun.
4. **Credentials** option-e giye **OAuth Client ID** create korun (Application type: Desktop App). Client ID & Client Secret generate hobe.

### **B. One-Time Refresh Token Generation:**
Terminal-e single user login consent access collect korar jonno python trigger script use korte hobe (ja target console update code-e configuration token set korbe):
`ai-worker/get_refresh_token.py` (Script example):
```python
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

def get_tokens():
    flow = InstalledAppFlow.from_client_secrets_file(
        "client_secrets.json", scopes=SCOPES
    )
    credentials = flow.run_local_server(port=0)
    print("Refresh Token: ", credentials.refresh_token)
    # Eita print hole .env-e save kore rakhben:
    # YOUTUBE_REFRESH_TOKEN = your_refresh_token
```

### **C. Video Upload script (`youtube_uploader.py`):**
Upload phase code format:
```python
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

def upload_video_to_youtube(video_path, title, description):
    creds = Credentials(
        token=None,
        refresh_token=os.getenv("YOUTUBE_REFRESH_TOKEN"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("YOUTUBE_CLIENT_ID"),
        client_secret=os.getenv("YOUTUBE_CLIENT_SECRET")
    )
    
    youtube = build("youtube", "v3", credentials=creds)
    
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": ["vocals", "separated", "acapella"],
            "categoryId": "10" # Music category
        },
        "status": {
            "privacyStatus": "private" # Default 'private' or 'public'
        }
    }
    
    media = MediaFileUpload(video_path, chunksize=-1, resumable=True)
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media
    )
    
    response = None
    while response is None:
        status, response = request.next_chunk()
        if response:
            print(f"Video uploaded! ID: {response['id']}")
            return response['id']
```

---

## 4. Auto Cleanup (Disk Space optimization)

Dynamic memory optimization validation standard loop runtime execute korar jonno job dynamic completed trigger return hole, path system clear path delete execution initialize korbo.

```python
import shutil

def cleanup_workspace(downloads_dir, separated_dir):
    try:
        if os.path.exists(downloads_dir):
            shutil.rmtree(downloads_dir)
        if os.path.exists(separated_dir):
            shutil.rmtree(separated_dir)
        print("Successfully cleaned up all processing files.")
    except Exception as e:
        print(f"Error cleaning workspace: {e}")
```

---

## 5. Environment Variables Setup (`.env`)

Implement korar somoy core variables setup hobe:
```env
# Remove Database & Redis references
# Added YouTube API variables
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
YOUTUBE_REFRESH_TOKEN=your_refresh_token_here
```
