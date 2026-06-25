"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Loader2,
  Music,
  Sliders,
  Sparkles
} from "lucide-react";

interface PlayerProps {
  vocalUrl: string;
  instrumentalUrl: string;
  vocalNoSilenceUrl?: string;
  youtubeUrl: string;
  onReset: () => void;
}

export default function Player({ vocalUrl, instrumentalUrl, vocalNoSilenceUrl, youtubeUrl, onReset }: PlayerProps) {
  const vocalContainerRef = useRef<HTMLDivElement>(null);
  const instrumentalContainerRef = useRef<HTMLDivElement>(null);
  const vocalNoSilenceContainerRef = useRef<HTMLDivElement>(null);

  const vocalWSRef = useRef<any>(null);
  const instrumentalWSRef = useRef<any>(null);
  const vocalNoSilenceWSRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Mixer States
  const [vocalVolume, setVocalVolume] = useState(100);
  const [vocalMuted, setVocalMuted] = useState(false);

  const [instrumentalVolume, setInstrumentalVolume] = useState(100);
  const [instrumentalMuted, setInstrumentalMuted] = useState(false);

  const [masterVolume, setMasterVolume] = useState(80);
  const [masterMuted, setMasterMuted] = useState(false);

  const [crossfade, setCrossfade] = useState(50); // 0 (100% vocal) to 100 (100% instrumental)

  // Loading States
  const [isLoadingVocal, setIsLoadingVocal] = useState(true);
  const [isLoadingInstrumental, setIsLoadingInstrumental] = useState(true);
  const [error, setError] = useState("");

  // Silence-Removed States
  const [isNoSilencePlaying, setIsNoSilencePlaying] = useState(false);
  const [noSilenceCurrentTime, setNoSilenceCurrentTime] = useState(0);
  const [noSilenceDuration, setNoSilenceDuration] = useState(0);
  const [isLoadingNoSilence, setIsLoadingNoSilence] = useState(true);
  const [noSilenceVolume, setNoSilenceVolume] = useState(100);
  const [noSilenceMuted, setNoSilenceMuted] = useState(false);

  // Helper to format time
  const formatTime = (time: number) => {
    if (isNaN(time) || time === null) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Function to calculate and update volumes reactively
  const updateVolumes = () => {
    const vWS = vocalWSRef.current;
    const iWS = instrumentalWSRef.current;
    if (!vWS && !iWS) return;

    // Convert values to 0..1 scale
    const mVolume = masterMuted ? 0 : masterVolume / 100;
    const vVolFactor = vocalMuted ? 0 : vocalVolume / 100;
    const iVolFactor = instrumentalMuted ? 0 : instrumentalVolume / 100;

    // Linear Crossfader math: 
    // crossfade = 0   => vocal weight = 1, instrumental weight = 0
    // crossfade = 50  => vocal weight = 0.5, instrumental weight = 0.5
    // crossfade = 100 => vocal weight = 0, instrumental weight = 1
    const crossfadeValue = crossfade / 100;
    const vocalWeight = 1 - crossfadeValue;
    const instrumentalWeight = crossfadeValue;

    const finalVocalVol = vocalWeight * mVolume * vVolFactor;
    const finalInstrumentalVol = instrumentalWeight * mVolume * iVolFactor;

    if (vWS) {
      vWS.setVolume(Math.min(Math.max(finalVocalVol, 0), 1));
    }
    if (iWS) {
      iWS.setVolume(Math.min(Math.max(finalInstrumentalVol, 0), 1));
    }
  };

  // Handle volume updates reactively when state changes
  useEffect(() => {
    updateVolumes();
  }, [vocalVolume, vocalMuted, instrumentalVolume, instrumentalMuted, masterVolume, masterMuted, crossfade]);

  // Load Wavesurfer instances
  useEffect(() => {
    let active = true;
    let wsVocalInstance: any = null;
    let wsInstrumentalInstance: any = null;

    const initWavesurfer = async () => {
      try {
        const WaveSurfer = (await import("wavesurfer.js")).default;

        if (!active) return;
        if (!vocalContainerRef.current || !instrumentalContainerRef.current) return;

        // Create Vocal Wavesurfer instance
        wsVocalInstance = WaveSurfer.create({
          container: vocalContainerRef.current,
          waveColor: "rgba(139, 92, 246, 0.2)", // Translucent purple
          progressColor: "#a78bfa", // Vivid purple
          cursorColor: "#c084fc",
          cursorWidth: 2,
          height: 80,
          barWidth: 2,
          barGap: 3,
          barRadius: 2,
          url: vocalUrl,
        });

        // Create Instrumental Wavesurfer instance
        wsInstrumentalInstance = WaveSurfer.create({
          container: instrumentalContainerRef.current,
          waveColor: "rgba(6, 182, 212, 0.2)", // Translucent cyan
          progressColor: "#67e8f9", // Vivid cyan
          cursorColor: "#22d3ee",
          cursorWidth: 2,
          height: 80,
          barWidth: 2,
          barGap: 3,
          barRadius: 2,
          url: instrumentalUrl,
        });

        vocalWSRef.current = wsVocalInstance;
        instrumentalWSRef.current = wsInstrumentalInstance;

        // Set up event listeners
        wsVocalInstance.on("ready", (dur: number) => {
          if (!active) return;
          setIsLoadingVocal(false);
          setDuration(dur);
          updateVolumes();
        });

        wsInstrumentalInstance.on("ready", () => {
          if (!active) return;
          setIsLoadingInstrumental(false);
          updateVolumes();
        });

        wsVocalInstance.on("timeupdate", (time: number) => {
          if (!active) return;
          setCurrentTime(time);
        });

        // Sync seeking on vocal waveform
        wsVocalInstance.on("interaction", (newTime: number) => {
          if (wsInstrumentalInstance) {
            wsInstrumentalInstance.setTime(newTime);
          }
        });

        // Sync seeking on instrumental waveform
        wsInstrumentalInstance.on("interaction", (newTime: number) => {
          if (wsVocalInstance) {
            wsVocalInstance.setTime(newTime);
          }
        });

        // Reset state on playback end
        wsVocalInstance.on("finish", () => {
          if (wsInstrumentalInstance) {
            wsInstrumentalInstance.pause();
            wsInstrumentalInstance.setTime(0);
          }
          wsVocalInstance.setTime(0);
          setIsPlaying(false);
        });

      } catch (err) {
        console.error("Error loading wavesurfer:", err);
        if (active) {
          setError("Could not load waveform visualization library.");
        }
      }
    };

    initWavesurfer();

    return () => {
      active = false;
      if (wsVocalInstance) wsVocalInstance.destroy();
      if (wsInstrumentalInstance) wsInstrumentalInstance.destroy();
    };
  }, [vocalUrl, instrumentalUrl]);

  // Load Silence-Removed Wavesurfer instance
  useEffect(() => {
    let active = true;
    let wsNoSilenceInstance: any = null;
    if (!vocalNoSilenceUrl) return;

    const initWavesurfer = async () => {
      try {
        const WaveSurfer = (await import("wavesurfer.js")).default;

        if (!active) return;
        if (!vocalNoSilenceContainerRef.current) return;

        wsNoSilenceInstance = WaveSurfer.create({
          container: vocalNoSilenceContainerRef.current,
          waveColor: "rgba(139, 92, 246, 0.2)", // Translucent purple
          progressColor: "#a78bfa", // Vivid purple
          cursorColor: "#c084fc",
          cursorWidth: 2,
          height: 80,
          barWidth: 2,
          barGap: 3,
          barRadius: 2,
          url: vocalNoSilenceUrl,
        });

        vocalNoSilenceWSRef.current = wsNoSilenceInstance;

        wsNoSilenceInstance.on("ready", (dur: number) => {
          if (!active) return;
          setIsLoadingNoSilence(false);
          setNoSilenceDuration(dur);
          
          // Apply initial volume
          const vol = noSilenceMuted ? 0 : noSilenceVolume / 100;
          wsNoSilenceInstance.setVolume(vol);
        });

        wsNoSilenceInstance.on("timeupdate", (time: number) => {
          if (!active) return;
          setNoSilenceCurrentTime(time);
        });

        wsNoSilenceInstance.on("finish", () => {
          wsNoSilenceInstance.setTime(0);
          setIsNoSilencePlaying(false);
        });

      } catch (err) {
        console.error("Error loading silence-removed wavesurfer:", err);
      }
    };

    initWavesurfer();

    return () => {
      active = false;
      if (wsNoSilenceInstance) wsNoSilenceInstance.destroy();
    };
  }, [vocalNoSilenceUrl]);

  // Handle solo player volume updates reactively
  useEffect(() => {
    const ws = vocalNoSilenceWSRef.current;
    if (ws) {
      ws.setVolume(noSilenceMuted ? 0 : noSilenceVolume / 100);
    }
  }, [noSilenceVolume, noSilenceMuted]);

  // Master Playback controls
  const togglePlay = () => {
    const vWS = vocalWSRef.current;
    const iWS = instrumentalWSRef.current;
    if (!vWS || !iWS) return;

    // Pause the silence-removed player if it is playing
    const nsWS = vocalNoSilenceWSRef.current;
    if (nsWS && isNoSilencePlaying) {
      nsWS.pause();
      setIsNoSilencePlaying(false);
    }

    if (isPlaying) {
      vWS.pause();
      iWS.pause();
      setIsPlaying(false);
    } else {
      // Sync playheads before playing
      const currentVTime = vWS.getCurrentTime();
      iWS.setTime(currentVTime);
      
      vWS.play();
      iWS.play();
      setIsPlaying(true);
    }
  };

  const handleResetPlayback = () => {
    const vWS = vocalWSRef.current;
    const iWS = instrumentalWSRef.current;
    if (vWS) vWS.setTime(0);
    if (iWS) iWS.setTime(0);
    setCurrentTime(0);
  };

  const toggleNoSilencePlay = () => {
    const nsWS = vocalNoSilenceWSRef.current;
    if (!nsWS) return;

    // Pause the main mixer if it is playing
    const vWS = vocalWSRef.current;
    const iWS = instrumentalWSRef.current;
    if (isPlaying) {
      if (vWS) vWS.pause();
      if (iWS) iWS.pause();
      setIsPlaying(false);
    }

    if (isNoSilencePlaying) {
      nsWS.pause();
      setIsNoSilencePlaying(false);
    } else {
      nsWS.play();
      setIsNoSilencePlaying(true);
    }
  };

  const vocalWeightPercent = 100 - crossfade;
  const instrumentalWeightPercent = crossfade;

  return (
    <div className="w-full space-y-6">
      {/* Session Metadata Info */}
      <div className="p-5 rounded-2xl border border-glass bg-obsidian-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
        <div className="space-y-1 flex-1">
          <span className="text-xs font-mono uppercase tracking-widest text-indigo-400">Current Session</span>
          <div className="flex items-center gap-2">
            <span className="text-rose-500 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">YouTube</span>
            <span className="font-semibold text-white truncate max-w-md block md:max-w-xl text-sm">
              {youtubeUrl}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onReset}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all duration-300 border border-glass shadow-md active:scale-95"
          >
            New Separation
          </button>
        </div>
      </div>

      {/* Main Console Board */}
      <div className="p-8 rounded-3xl border border-glass bg-obsidian-card glow-card shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Accent Glow */}
        <div className="absolute -left-20 -top-20 w-48 h-48 rounded-full blur-[100px] opacity-10 bg-indigo-500"></div>
        <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full blur-[100px] opacity-10 bg-cyan-500"></div>

        <div className="flex justify-between items-center mb-8 pb-4 border-b border-glass relative z-10">
          <div>
            <h3 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <span>Stem Mixer Console</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">Mix and monitor the vocal and instrumental components in real-time</p>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-white/[0.03] border border-glass px-3 py-1.5 rounded-lg">
            SYNCED PLAYBACK
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-400 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Stacked Waveform Track Canvas */}
        <div className="space-y-6 relative z-10">
          
          {/* Vocal Track Panel */}
          <div className="p-5 rounded-2xl border border-glass bg-black/20 hover:border-purple-500/20 transition-all duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="text-xs font-bold tracking-wider uppercase text-purple-400">Vocals</span>
                <span className="text-[10px] font-mono text-slate-500">vocals.wav</span>
              </div>
              
              {/* Individual vocal controls */}
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                <div className="flex items-center gap-2 flex-1 sm:flex-none">
                  <button
                    onClick={() => setVocalMuted(!vocalMuted)}
                    className={`p-2 rounded-lg border border-glass transition-colors ${
                      vocalMuted ? "bg-purple-950/40 text-purple-400 border-purple-500/30" : "text-slate-400 hover:text-white"
                    }`}
                    title="Mute Vocals"
                  >
                    {vocalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={vocalVolume}
                    onChange={(e) => setVocalVolume(parseInt(e.target.value))}
                    className="w-24 h-1.5 rounded-lg bg-slate-800 accent-purple-500 cursor-pointer appearance-none outline-none"
                    disabled={vocalMuted}
                  />
                  <span className="text-xs font-mono text-slate-400 w-8 text-right">
                    {vocalMuted ? "Mute" : `${vocalVolume}%`}
                  </span>
                </div>

                <a
                  href={vocalUrl}
                  download="vocals.wav"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-xs font-bold rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 hover:text-white border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Download</span>
                </a>
              </div>
            </div>

            {/* Waveform Canvas */}
            <div className="relative bg-black/40 rounded-xl p-2.5 border border-glass">
              {isLoadingVocal && (
                <div className="absolute inset-0 flex items-center justify-center bg-obsidian-card rounded-xl z-20 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading Vocals...</span>
                  </div>
                </div>
              )}
              <div ref={vocalContainerRef} id="vocal-waveform" className="w-full"></div>
            </div>
          </div>

          {/* Instrumental Track Panel */}
          <div className="p-5 rounded-2xl border border-glass bg-black/20 hover:border-cyan-500/20 transition-all duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                <span className="text-xs font-bold tracking-wider uppercase text-cyan-400">Instrumental</span>
                <span className="text-[10px] font-mono text-slate-500">instrumental.wav</span>
              </div>
              
              {/* Individual instrumental controls */}
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                <div className="flex items-center gap-2 flex-1 sm:flex-none">
                  <button
                    onClick={() => setInstrumentalMuted(!instrumentalMuted)}
                    className={`p-2 rounded-lg border border-glass transition-colors ${
                      instrumentalMuted ? "bg-cyan-950/40 text-cyan-400 border-cyan-500/30" : "text-slate-400 hover:text-white"
                    }`}
                    title="Mute Instrumental"
                  >
                    {instrumentalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={instrumentalVolume}
                    onChange={(e) => setInstrumentalVolume(parseInt(e.target.value))}
                    className="w-24 h-1.5 rounded-lg bg-slate-800 accent-cyan-500 cursor-pointer appearance-none outline-none"
                    disabled={instrumentalMuted}
                  />
                  <span className="text-xs font-mono text-slate-400 w-8 text-right">
                    {instrumentalMuted ? "Mute" : `${instrumentalVolume}%`}
                  </span>
                </div>

                <a
                  href={instrumentalUrl}
                  download="instrumental.wav"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-xs font-bold rounded-lg bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-300 hover:text-white border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Download</span>
                </a>
              </div>
            </div>

            {/* Waveform Canvas */}
            <div className="relative bg-black/40 rounded-xl p-2.5 border border-glass">
              {isLoadingInstrumental && (
                <div className="absolute inset-0 flex items-center justify-center bg-obsidian-card rounded-xl z-20 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading Instrumental...</span>
                  </div>
                </div>
              )}
              <div ref={instrumentalContainerRef} id="instrumental-waveform" className="w-full"></div>
            </div>
          </div>
        </div>

        {/* Master Mixer Console Dashboard */}
        <div className="mt-8 pt-8 border-t border-glass relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          
          {/* Master Transport Controls */}
          <div className="flex items-center justify-between md:justify-start gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                disabled={isLoadingVocal || isLoadingInstrumental}
                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-cyan-500/30 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
              </button>
              
              <button
                onClick={handleResetPlayback}
                disabled={isLoadingVocal || isLoadingInstrumental}
                className="p-3.5 rounded-xl border border-glass bg-white/[0.02] hover:bg-white/5 text-slate-400 hover:text-white transition-colors active:scale-95 disabled:opacity-50"
                title="Restart playback"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col">
              <span className="text-lg font-mono font-bold tracking-tight text-white">
                {formatTime(currentTime)}
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                Duration {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Crossfader Section */}
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
              <span className="text-purple-400 flex items-center gap-1">
                Vocals <span className="font-mono text-[10px] bg-purple-500/10 px-1 rounded">{vocalWeightPercent}%</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">CROSSFADER</span>
              <span className="text-cyan-400 flex items-center gap-1">
                <span className="font-mono text-[10px] bg-cyan-500/10 px-1 rounded">{instrumentalWeightPercent}%</span> Instrumental
              </span>
            </div>
            
            <input
              type="range"
              min="0"
              max="100"
              value={crossfade}
              onChange={(e) => setCrossfade(parseInt(e.target.value))}
              className="w-full h-2 rounded-lg bg-slate-800 accent-gradient-crossfader cursor-pointer appearance-none outline-none border border-slate-700/50"
            />
            
            <div className="flex justify-between text-[9px] text-slate-500 font-semibold tracking-wide">
              <span>ONLY VOCALS</span>
              <span>EQUAL MIX</span>
              <span>ONLY ACCOMPANIMENT</span>
            </div>
          </div>

          {/* Master Volume Section */}
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => setMasterMuted(!masterMuted)}
              className={`p-3 rounded-xl border border-glass transition-colors ${
                masterMuted ? "bg-rose-950/40 text-rose-400 border-rose-500/30" : "text-slate-400 hover:text-white bg-white/[0.02] hover:bg-white/5"
              }`}
              title="Mute Master Volume"
            >
              {masterMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <div className="flex flex-col gap-1.5 flex-1 max-w-[150px]">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Master Volume</span>
                <span className="font-mono">{masterMuted ? "Mute" : `${masterVolume}%`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-lg bg-slate-800 accent-indigo-500 cursor-pointer appearance-none outline-none"
                disabled={masterMuted}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Dedicated Silence-Removed Vocal Player Panel */}
      {vocalNoSilenceUrl && (
        <div className="p-8 rounded-3xl border border-glass bg-obsidian-card glow-card shadow-2xl relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute -left-20 -top-20 w-48 h-48 rounded-full blur-[100px] opacity-10 bg-purple-500"></div>

          <div className="flex justify-between items-center mb-8 pb-4 border-b border-glass relative z-10">
            <div>
              <h3 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Vocal Solo (Silence Removed)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">Continuous vocal track with silent gaps extracted</p>
            </div>
            <div className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
              SOLO MODE
            </div>
          </div>

          {/* Player controls & waveform */}
          <div className="space-y-6 relative z-10">
            <div className="p-5 rounded-2xl border border-glass bg-black/20 hover:border-purple-500/20 transition-all duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="text-xs font-bold tracking-wider uppercase text-purple-400">Silence-Free Vocals</span>
                  <span className="text-[10px] font-mono text-slate-500">vocals_no_silence.mp3</span>
                </div>
                
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <button
                      onClick={() => setNoSilenceMuted(!noSilenceMuted)}
                      className={`p-2 rounded-lg border border-glass transition-colors ${
                        noSilenceMuted ? "bg-purple-950/40 text-purple-400 border-purple-500/30" : "text-slate-400 hover:text-white"
                      }`}
                      title="Mute Vocals"
                    >
                      {noSilenceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={noSilenceVolume}
                      onChange={(e) => setNoSilenceVolume(parseInt(e.target.value))}
                      className="w-24 h-1.5 rounded-lg bg-slate-800 accent-purple-500 cursor-pointer appearance-none outline-none"
                      disabled={noSilenceMuted}
                    />
                    <span className="text-xs font-mono text-slate-400 w-8 text-right">
                      {noSilenceMuted ? "Mute" : `${noSilenceVolume}%`}
                    </span>
                  </div>

                  <a
                    href={vocalNoSilenceUrl}
                    download="vocals_no_silence.mp3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 py-2 px-3.5 text-xs font-bold rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 hover:text-white border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Download</span>
                  </a>
                </div>
              </div>

              {/* Waveform Canvas */}
              <div className="relative bg-black/40 rounded-xl p-2.5 border border-glass">
                {isLoadingNoSilence && (
                  <div className="absolute inset-0 flex items-center justify-center bg-obsidian-card rounded-xl z-20 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading Silence-Free Vocals...</span>
                    </div>
                  </div>
                )}
                <div ref={vocalNoSilenceContainerRef} id="vocals-no-silence-waveform" className="w-full"></div>
              </div>
            </div>
            
            {/* Solo Player Transport Control */}
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={toggleNoSilencePlay}
                disabled={isLoadingNoSilence}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-indigo-500/30 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isNoSilencePlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>
              
              <button
                onClick={() => {
                  const nsWS = vocalNoSilenceWSRef.current;
                  if (nsWS) nsWS.setTime(0);
                  setNoSilenceCurrentTime(0);
                }}
                disabled={isLoadingNoSilence}
                className="p-3 rounded-xl border border-glass bg-white/[0.02] hover:bg-white/5 text-slate-400 hover:text-white transition-colors active:scale-95 disabled:opacity-50"
                title="Restart playback"
              >
                <RotateCcw className="w-4.5 h-4.5" />
              </button>

              <div className="flex flex-col">
                <span className="text-md font-mono font-bold tracking-tight text-white">
                  {formatTime(noSilenceCurrentTime)}
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                  Duration {formatTime(noSilenceDuration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
