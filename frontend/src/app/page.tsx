"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Music, 
  Search, 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  Copy,
  Check,
  Clock,
  Sliders,
  Volume2
} from "lucide-react";
import Player from "@/components/Player";


const Youtube = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface Job {
  id: string;
  youtube_url: string;
  status: 'pending' | 'downloading' | 'separating' | 'uploading' | 'completed' | 'failed';
  error_message?: string;
  vocal_url?: string;
  instrumental_url?: string;
  vocal_no_silence_url?: string;
  created_at?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";



export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Status mapping to display steps and percentages
  const getStatusProgress = (status: Job['status']) => {
    switch (status) {
      case "pending": return 15;
      case "downloading": return 35;
      case "separating": return 65;
      case "uploading": return 85;
      case "completed": return 100;
      case "failed": return 100;
      default: return 0;
    }
  };

  const getStatusStepIndex = (status: Job['status']) => {
    switch (status) {
      case "pending": return 0;
      case "downloading": return 1;
      case "separating": return 2;
      case "uploading": return 3;
      case "completed": return 4;
      default: return -1;
    }
  };

  const stepLabels = [
    { label: "Queued", desc: "Waiting for slot" },
    { label: "Download", desc: "Downloading audio" },
    { label: "AI Separate", desc: "Extracting stems" },
    { label: "Upload", desc: "Saving to Cloud" },
    { label: "Finished", desc: "Stems ready" }
  ];

  // Helper to validate youtube links
  const validateUrl = (url: string) => {
    if (!url) return "YouTube URL is required";
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace("www.", "");
      if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
        return "";
      }
      return "Only YouTube links are supported (youtube.com or youtu.be)";
    } catch (_) {
      return "Please enter a valid URL (e.g. https://www.youtube.com/watch?v=...)";
    }
  };

  // Timer effect for elapsed processing time
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const isProcessing = activeJob && 
      activeJob.status !== "completed" && 
      activeJob.status !== "failed";

    if (isProcessing) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeJob]);

  // Polling hook using standard useEffect
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    const pollJobStatus = async () => {
      if (!activeJob) return;
      
      try {
        const res = await fetch(`${API_URL}/api/jobs/${activeJob.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch job status");
        }
        
        const updatedJob: Job = await res.json();
        
        // Only update if state actually changed to avoid state flicker
        if (updatedJob.status !== activeJob.status) {
          setActiveJob(updatedJob);
        } else if (updatedJob.status === "completed" && (updatedJob.vocal_url !== activeJob.vocal_url)) {
          setActiveJob(updatedJob);
        }
      } catch (err) {
        console.error("Error polling job status:", err);
      }
    };

    const isProcessing = activeJob && 
      activeJob.status !== "completed" && 
      activeJob.status !== "failed";

    if (isProcessing) {
      pollInterval = setInterval(pollJobStatus, 2000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeJob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const urlValidationError = validateUrl(youtubeUrl);
    if (urlValidationError) {
      setError(urlValidationError);
      return;
    }

    setLoading(true);
    setElapsedSeconds(0);
    setActiveJob(null);

    try {
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to submit job");
      }

      const jobData = await response.json();
      setActiveJob({
        id: jobData.id,
        status: jobData.status,
        youtube_url: youtubeUrl
      });
    } catch (err: any) {
      setError(err.message || "Failed to establish connection with server");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setYoutubeUrl("");
    setActiveJob(null);
    setError("");
    setElapsedSeconds(0);
  };

  const formatElapsed = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const currentStepIndex = activeJob ? getStatusStepIndex(activeJob.status) : -1;
  const progressPercent = activeJob ? getStatusProgress(activeJob.status) : 0;
  const isProcessing = activeJob && activeJob.status !== "completed" && activeJob.status !== "failed";

  return (
    <div className="min-h-screen bg-obsidian text-slate-100 flex flex-col items-center py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Absolute background elements for premium feel */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-4xl flex flex-col flex-1 relative z-10">
        
        {/* Header Section */}
        <header className="flex justify-between items-center mb-16 border-b border-glass pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                VocalSplit <span className="text-gradient font-black">AI</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest">ADVANCED STEM SEPARATION</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full border border-glass bg-white/[0.02] text-xs text-indigo-400 font-semibold flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            v1.0.0
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col justify-center items-center gap-12">
          
          {!activeJob ? (
            /* Input Page State */
            <div className="w-full max-w-2xl text-center space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
                  Separate Vocals & <br />
                  <span className="text-gradient">Instrumentals</span> Flawlessly
                </h2>
                <p className="text-slate-400 text-lg max-w-lg mx-auto font-medium">
                  Enter a YouTube link below, and watch our artificial intelligence isolate vocals from the accompaniment.
                </p>
              </div>

              {/* URL input form */}
              <form onSubmit={handleSubmit} className="relative group p-1.5 rounded-2xl bg-white/[0.02] border border-glass glow-card focus-within:border-indigo-500/50 transition-all duration-300 max-w-xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex items-center px-4 gap-3">
                    <Youtube className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="Paste YouTube link here..."
                      disabled={loading}
                      className="bg-transparent border-none outline-none w-full text-white placeholder-slate-500 text-sm py-3"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="py-3 px-6 rounded-xl font-bold text-white transition-all bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-98 flex items-center justify-center gap-2 border border-white/10"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Split Audio</span>
                        <Search className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Error messages */}
              {error && (
                <div className="flex items-center justify-center gap-2 text-rose-400 bg-rose-950/20 border border-rose-900/30 py-3 px-4 rounded-xl max-w-md mx-auto text-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Specs Badge */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium pt-8">
                <div className="flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-indigo-500/80" />
                  High Fidelity WAV Files
                </div>
                <span className="text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-500/80" />
                  Demucs 2-Stem Isolation
                </div>
                <span className="text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-500/80" />
                  Under 60s Processing
                </div>
              </div>
            </div>
          ) : (
            /* Active job / Progress / Completed state */
            <div className="w-full space-y-10">
              
              {/* Job Header Info */}
              {activeJob.status !== "completed" && (
                <div className="p-5 rounded-2xl border border-glass bg-obsidian-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
                  <div className="space-y-1 flex-1">
                    <span className="text-xs font-mono uppercase tracking-widest text-indigo-400">Current Session</span>
                    <div className="flex items-center gap-2">
                      <Youtube className="w-5 h-5 text-rose-500 shrink-0" />
                      <span className="font-semibold text-white truncate max-w-md block md:max-w-xl text-sm">
                        {activeJob.youtube_url}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end text-xs">
                      <span className="text-slate-400 font-mono">ID: {activeJob.id.slice(0, 8)}...</span>
                      <span className="text-slate-500 mt-0.5">Created just now</span>
                    </div>
                    
                    {/* Cancel/Reset button */}
                    {!isProcessing && (
                      <button
                        onClick={handleReset}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all border border-glass"
                      >
                        New Split
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Status Stepper / Progress Section */}
              {activeJob.status !== "failed" && activeJob.status !== "completed" && (
                <div className="p-8 rounded-3xl border border-glass bg-obsidian-card glow-card shadow-2xl relative">
                  
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-wide">Processing Pipeline</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Demucs neural network is isolating audio signals</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-indigo-400 font-semibold bg-indigo-950/20 px-3 py-1 rounded-full border border-indigo-900/30">
                      <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
                      <span>{formatElapsed(elapsedSeconds)}</span>
                    </div>
                  </div>

                  {/* Visual Stepper */}
                  <div className="relative mb-12 mt-4">
                    {/* Background track line */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -translate-y-1/2 rounded-full z-0"></div>
                    
                    {/* Active track progress bar */}
                    <div 
                      className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 -translate-y-1/2 rounded-full transition-all duration-700 ease-out z-0"
                      style={{ width: `${(currentStepIndex / 4) * 100}%` }}
                    ></div>

                    {/* Stepper Node list */}
                    <div className="flex justify-between relative z-10">
                      {stepLabels.map((step, idx) => {
                        const isCompleted = idx < currentStepIndex;
                        const isActive = idx === currentStepIndex;
                        const isPending = idx > currentStepIndex;

                        let nodeColor = "bg-slate-900 border-slate-700 text-slate-400";
                        if (isCompleted) nodeColor = "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20";
                        if (isActive) nodeColor = "bg-obsidian border-cyan-400 text-cyan-400 glow-active pulse-glow";

                        return (
                          <div key={idx} className="flex flex-col items-center text-center max-w-[80px]">
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-500 ${nodeColor}`}>
                              {isCompleted ? (
                                <Check className="w-4 h-4 stroke-[3]" />
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>
                            <span className={`text-[11px] font-bold mt-3 transition-colors duration-300 ${isActive ? 'text-cyan-400' : isCompleted ? 'text-indigo-400' : 'text-slate-500'}`}>
                              {step.label}
                            </span>
                            <span className="text-[9px] text-slate-600 font-medium hidden md:block mt-0.5 max-w-[90px]">
                              {step.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Simulated loader status text description */}
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-glass flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    <span className="text-sm text-slate-300">
                      {activeJob.status === "pending" && "Waiting in job queue. Please stand by..."}
                      {activeJob.status === "downloading" && "Connecting to YouTube to extract audio stream in high fidelity..."}
                      {activeJob.status === "separating" && "Running Meta Demucs neural net: Separating audio. This might take 30-40 seconds..."}
                      {activeJob.status === "uploading" && "Stems isolated! Committing audio files to Cloudflare R2 cloud storage..."}
                    </span>
                  </div>
                </div>
              )}

              {/* Failed card */}
              {activeJob.status === "failed" && (
                <div className="p-8 rounded-3xl border border-rose-900/30 bg-rose-950/10 glow-card shadow-2xl text-center space-y-6 max-w-xl mx-auto">
                  <div className="w-16 h-16 rounded-full bg-rose-900/20 text-rose-500 flex items-center justify-center mx-auto border border-rose-800/30">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">Audio Separation Failed</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                      {activeJob.error_message || "An unexpected error occurred during processing. Please try another link."}
                    </p>
                  </div>

                  <button
                    onClick={handleReset}
                    className="py-2.5 px-6 rounded-xl font-bold text-white transition-all bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 active:scale-98 border border-white/10"
                  >
                    Try Another URL
                  </button>
                </div>
              )}

              {/* Completed / Results Card */}
              {activeJob.status === "completed" && (
                <div className="animate-fade-in w-full">
                  {activeJob.vocal_url && activeJob.instrumental_url && (
                    <Player
                      vocalUrl={activeJob.vocal_url}
                      instrumentalUrl={activeJob.instrumental_url}
                      vocalNoSilenceUrl={activeJob.vocal_no_silence_url}
                      youtubeUrl={activeJob.youtube_url}
                      onReset={handleReset}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
