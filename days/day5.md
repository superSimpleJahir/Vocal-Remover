# Day 5: Next.js Frontend Foundation & Sleek UI

Today's focus is styling and establishing the user interface layout inside the Next.js React application. We will follow a sleek, dark-themed developer palette with micro-animations and glassmorphism cards.

## Tasks Checklist
- [ ] **Configure Tailwind & Theme**: Establish base design variables (deep slate backgrounds, neon gradients, glow effects).
- [ ] **URL Input Component**: Create a validation-ready YouTube search bar with loading states and hover effects.
- [ ] **Progress/Status Card**: Create an elegant dashboard component showing processing status with visual stepper (Pending ➔ Downloading ➔ Separating ➔ Uploading ➔ Ready).
- [ ] **State & API Integration**: Wire client input state to trigger the API backend and run an interval-based polling hook (`useInterval`) to check status.

---

## Technical Details

### Styling System: `frontend/src/app/globals.css`
Define CSS variables for custom colors:
- Background: Deep Obsidian Slate (`#0B0F19`)
- Primary Brand Accent: Neon Indigo (`#6366F1`)
- Secondary Accent: Electric Blue/Cyan (`#06B6D4`)
- Glass Overlay Card: Transparent dark card with backdrop blur and subtle border.

```css
@layer base {
  body {
    background-color: #0b0f19;
    color: #f3f4f6;
  }
}
```

### URL Submission Component
- Input checks: Validate YouTube URL pattern (regex check).
- Feedback message: Show helpful warnings if the URL format is invalid.
- Action: Send `POST` request to `NEXT_PUBLIC_API_URL/api/jobs`.

### Status Polling Logic
Once a job is submitted, store `jobId` in component state and poll `GET /api/jobs/:id` every 2 seconds. Disable polling once status transitions to `completed` or `failed`.

---

## Verification
1. Run local dev server: `npm run dev` from `/frontend`.
2. Open the page in browser. Verify responsive UI adapts nicely on mobile and desktop layout.
3. Submit a YouTube link and check that the progress card correctly handles API responses and advances status stages.
