# Day 3: Backend Express API & Task Queue Setup

Today's focus is building the Node.js Express server to handle client requests, save job metadata in Neon DB, and queue long-running audio separation tasks using Redis and BullMQ.

## Tasks Checklist
- [ ] **Express Server Initialization**: Setup Express server with standard middleware (`cors`, `express.json`).
- [ ] **Database Integration**: Connect server to Neon DB using `pg.Pool` client and verify connection.
- [ ] **Queue setup**: Setup BullMQ Queue client configured with Redis connection settings.
- [ ] **API Endpoints**:
  - `POST /api/jobs`: Validates YouTube URL format, inserts a `pending` job into Neon DB, pushes the task to Redis queue, and returns the generated UUID.
  - `GET /api/jobs/:id`: Queries the database and returns the processing status (`pending`, `downloading`, `separating`, `uploading`, `completed`, `failed`), progress metrics, and URLs.

---

## Technical Details

### Backend Structure
- `backend/index.js` - Server starter, router definitions, and API routes.
- `backend/db.js` - Neon database pool helper.
- `backend/queue.js` - BullMQ Queue instance connection.

### API Specifications

#### Create Processing Job
- **Route**: `POST /api/jobs`
- **Body**: `{ "youtubeUrl": "https://www.youtube.com/watch?v=..." }`
- **Response**: `{ "id": "uuid-here", "status": "pending" }`

#### Get Job Status
- **Route**: `GET /api/jobs/:id`
- **Response**:
```json
{
  "id": "uuid-here",
  "youtube_url": "https://www.youtube.com/watch?v=...",
  "status": "separating",
  "error_message": null,
  "vocal_url": null,
  "instrumental_url": null,
  "created_at": "2026-06-09T06:00:00Z"
}
```

---

## Verification
1. Run local Redis using Docker or direct installation.
2. Start the Express server: `npm run dev` from `/backend`.
3. Submit a POST request using Postman or cURL:
   ```bash
   curl -X POST http://localhost:5000/api/jobs -H "Content-Type: application/json" -d "{\"youtubeUrl\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}"
   ```
4. Query the status endpoint to verify database retrieval.
