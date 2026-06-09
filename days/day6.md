# Day 6: Synced Waveform Player (Wavesurfer.js)

Today's focus is building the core audio experience: a dual-track interactive player that synchronizes playback between separated Vocal and Instrumental tracks using `wavesurfer.js`.

## Tasks Checklist
- [ ] **Dual Waveform Canvas**: Load vocal and instrumental audio assets concurrently.
- [ ] **Synchronized Playback Controls**: Bind global play, pause, and seek events to trigger across both player instances.
- [ ] **Vocal/Instrumental Mixer**: Add volume controls for each track (independent volume sliders, mute/unmute buttons, and a crossfader slider).
- [ ] **Audio Download Buttons**: Provide direct links to download high-quality MP3 tracks from Cloudflare R2.

---

## Technical Details

### Component Interface: `frontend/src/components/Player.tsx`
- Load Wavesurfer instances for two container divs (`#vocal-waveform`, `#instrumental-waveform`).
- Keep instances synchronized:
```javascript
// Sync seeking/clicking on either track
vocalWavesurfer.on('interaction', (newProgress) => {
  instrumentalWavesurfer.setTime(vocalWavesurfer.getDuration() * newProgress);
});
instrumentalWavesurfer.on('interaction', (newProgress) => {
  vocalWavesurfer.setTime(instrumentalWavesurfer.getDuration() * newProgress);
});
```

### Mixer Controls
- **Vocal Volume**: Controls volume of vocal instance.
- **Instrumental Volume**: Controls volume of instrumental instance.
- **Crossfader**: Controls the mix ratio between vocals and instrumentals. Binds to an input range `[0, 1]`, adjusting volume weights:
  - Vocal Volume = `(1 - crossfadeValue) * masterVolume`
  - Instrumental Volume = `crossfadeValue * masterVolume`

---

## Verification
1. Load a completed job in the frontend.
2. Click **Play** and verify that both waveforms begin animating and playing audio in perfect sync.
3. Drag the seek bar on one waveform; confirm the other waveform playhead jumps to the exact same relative timestamp.
4. Move the crossfader left to hear only vocals, and right to hear only instrumentals. Check that both tracks are aligned.
