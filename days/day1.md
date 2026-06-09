# Day 1: Workspace Setup & Infrastructure

Today's focus is initializing the project structure, dependencies, configuration files, and defining the database schema.

## Completed Tasks
- [x] **Initialize Next.js project**: Frontend set up inside `/frontend` with TypeScript, Tailwind CSS, ESLint, and App Router.
- [x] **Initialize Backend project**: Created `backend/package.json` with Express, BullMQ, pg client, dotenv, and cors.
- [x] **Database Schema**: Created `backend/schema.sql` for the PostgreSQL / Neon DB database to track processing jobs.
- [x] **Workspace Configuration**: Created a unified `.env.example` in the root and configured `.gitignore` to prevent tracking of dependency folders, builds, audio files, and keys.

## Remaining Tasks
- [ ] **AI Worker Setup**: Define python requirements in `ai-worker/requirements.txt`.
- [ ] **Verify Local Redis**: Ensure Redis server is active for BullMQ queue management.

---

## File Details

### Database Schema: `backend/schema.sql`
Defines a `jobs` table with a custom status enum (`pending`, `downloading`, `separating`, `uploading`, `completed`, `failed`) and trigger logic to auto-update modification timestamps.

### Gitignore Configuration: `.gitignore`
Standard configurations to keep the workspace clean, ignoring large temporary video/audio files (`.mp3`, `.wav`), virtual environments (`venv/`), Node dependencies (`node_modules/`), and `.env` secrets.

---

## How to Proceed
1. Set up your Neon DB PostgreSQL instance and execute `backend/schema.sql`.
2. Configure your local `.env` using `.env.example` as a template.
3. Install backend dependencies using `npm install` inside `/backend`.
