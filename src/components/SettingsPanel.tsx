import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AiStatus, AiHealthStatus } from "../App";

interface SettingsPanelProps {
  scanLog: string;
  isScanning: boolean;
  onScan: () => void;
  onScanDevice: () => void;
  aiHealth: AiHealthStatus | null;
  setAiHealth: (health: AiHealthStatus | null) => void;
  initialSection?: string | null;
  onInitialSectionHandled?: () => void;
}

export default function SettingsPanel({ 
  scanLog, 
  isScanning, 
  onScan, 
  onScanDevice,
  aiHealth,
  setAiHealth,
  initialSection,
  onInitialSectionHandled
}: SettingsPanelProps) {
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const fetchStatus = async () => {
    try {
      const status = await invoke<AiStatus>("get_ai_status");
      setAiStatus(status);
    } catch (e) {
      console.error("Failed to get AI status:", e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialSection) {
      const element = document.getElementById(initialSection);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        onInitialSectionHandled?.();
      }
    }
  }, [initialSection, onInitialSectionHandled]);

  const analyzedPct = aiStatus && aiStatus.total_images > 0
    ? Math.round((aiStatus.analyzed_images / aiStatus.total_images) * 100)
    : 0;

  const indexingPct = aiStatus && aiStatus.total_found > 0
    ? Math.round((aiStatus.indexed_count / aiStatus.total_found) * 100)
    : 100;

  const isPrioritizingIndexing = aiStatus && aiStatus.total_found > 5 && (aiStatus.indexed_count / aiStatus.total_found) < 0.7;

  return (
    /* Outer container: Absolute inset-0 handles the scrolling boundary relative to App's <main> */
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar">
      {/* Inner container: Controls max-width and vertical spacing */}
      <div className="max-w-3xl mx-auto px-6 py-10 pb-40 flex flex-col gap-8 animate-fade-in">
        
        <header className="mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 shadow-lg shadow-brand-500/5">
              <SettingsIcon />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-surface-50 leading-none">Settings</h1>
              <p className="text-surface-400 text-sm mt-1.5 font-medium">Configure your library and AI parameters.</p>
            </div>
          </div>
        </header>

        {/* ── Library ────────────────────────────────────────────── */}
        <Section icon={<FolderIcon />} title="Library Locations" description="Manage where StoryBox looks for your memories.">
          <div className="flex flex-col gap-5">
            {/* Scan log console */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500/20 to-brand-600/0 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative flex items-center gap-3 bg-surface-950/80 border border-white/5 rounded-xl px-4 py-3.5 shadow-inner">
                <div className="flex items-center justify-center w-5 h-5">
                  {isScanning ? (
                    <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-600" />
                  )}
                </div>
                <span className="font-mono text-[11px] text-brand-300 flex-1 min-w-0 truncate tracking-tight uppercase opacity-90">
                  {isScanning && aiStatus ? `Discovering: ${aiStatus.total_found} found so far...` : scanLog}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className={`flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl bg-surface-800 border border-white/5 text-surface-200 font-bold text-xs uppercase tracking-widest transition-all hover:bg-surface-700 hover:text-white active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${isScanning ? "opacity-30" : ""}`}
                onClick={onScanDevice}
                disabled={isScanning}
              >
                <DeviceIcon />
                <span>Scan Device</span>
              </button>
              <button
                className={`flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl bg-brand-600 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-600/20 hover:bg-brand-500 hover:shadow-brand-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${isScanning ? "animate-pulse" : ""}`}
                onClick={onScan}
                disabled={isScanning}
              >
                <FolderPlusIcon />
                <span>{isScanning ? "Scanning…" : "Add Folder"}</span>
              </button>
            </div>

            {aiStatus && (aiStatus.pending_images > 0 || aiStatus.is_indexing_paused) && (
              <button
                onClick={async () => {
                   await invoke(aiStatus.is_indexing_paused ? "resume_indexing" : "stop_indexing");
                   fetchStatus();
                }}
                className={`w-full py-3 rounded-xl border font-bold text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${
                  aiStatus.is_indexing_paused 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white" 
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white"
                }`}
              >
                {aiStatus.is_indexing_paused ? "▶ Resume Indexing" : "|| Pause Indexing"}
              </button>
            )}
          </div>
        </Section>

        {/* ── AI Settings ────────────────────────────────────────── */}
        <Section icon={<BrainIcon />} title="AI Storyteller" description="Choose how your story titles and captions are generated.">
          <AiSettingsSection />
        </Section>

        {/* ── AI Health & Models ─────────────────────────────────── */}
        <Section id="ai-health-check" icon={<ShieldIcon />} title="AI Health Check" description="Verify connection to local AI models.">
          <div className="flex flex-col gap-4">
            {!aiHealth ? (
               <div className="flex flex-col items-center justify-center py-4 gap-3 bg-surface-950/40 rounded-2xl border border-white/5 italic text-surface-500 text-xs">
                 Checking AI availability...
               </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${
                  aiHealth.available 
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                    : "bg-red-500/5 border-red-500/20 text-red-400"
                }`}>
                  <div className={`p-2 rounded-xl ${aiHealth.available ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    {aiHealth.available ? <CheckIcon /> : <InfoIcon />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold uppercase tracking-tight">{aiHealth.available ? "Ollama Connected" : "Ollama Disconnected"}</span>
                    <p className="text-xs opacity-80 leading-relaxed font-medium">{aiHealth.message}</p>
                  </div>
                </div>

                {aiHealth.available && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <ModelBadge label="Vision" name={aiHealth.vision_model} loaded={aiHealth.vision_model_loaded} />
                     <ModelBadge label="Text" name={aiHealth.text_model} loaded={aiHealth.text_model_loaded} />
                  </div>
                )}

                <button
                  onClick={async () => {
                    setAiHealth(null);
                    const health = await invoke<AiHealthStatus>("check_ai_availability");
                    setAiHealth(health);
                  }}
                  className="w-full py-3 rounded-xl bg-surface-800 border border-white/5 text-surface-200 text-xs font-bold uppercase tracking-widest hover:bg-surface-700 hover:text-white transition-all active:scale-95"
                >
                  Refresh Health Status
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* ── AI Status ─────────────────────────────────────────── */}
        <Section icon={<SparkIcon />} title="AI Intelligence" description="Real-time status of semantic analysis and image tagging.">
          {loadingStatus ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <span className="w-8 h-8 border-3 border-surface-800 border-t-brand-500 rounded-full animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest text-surface-500">Connecting to Engine…</span>
            </div>
          ) : aiStatus ? (
            <div className="flex flex-col gap-6">
              {/* Progress Ring / Bar Combo */}
              <div className="p-5 bg-surface-950/40 rounded-2xl border border-white/5 shadow-inner">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-surface-400 mb-1">
                      {isPrioritizingIndexing ? "Flash Indexing Active" : "AI Intelligence Queue"}
                    </span>
                    <span className={`text-sm font-bold ${aiStatus.pending_images > 0 ? (isPrioritizingIndexing ? "text-cyan-400" : "text-amber-400") : "text-emerald-400"}`}>
                      {isPrioritizingIndexing ? "Prioritizing photos over AI..." : (aiStatus.pending_images > 0 ? "Background Processing Active" : "Up to Date")}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-white">
                        {isPrioritizingIndexing ? aiStatus.indexed_count : aiStatus.analyzed_images}
                      </span>
                      <span className="text-xs font-bold text-surface-500">
                        / {isPrioritizingIndexing ? aiStatus.total_found : aiStatus.total_images}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-surface-500 uppercase tracking-widest">
                       {isPrioritizingIndexing ? "Images Indexed" : "Images Analyzed"}
                    </span>
                  </div>
                </div>
                
                <div className="h-3 bg-surface-800/50 rounded-full overflow-hidden p-1 border border-white/5 relative">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                    style={{ width: `${isPrioritizingIndexing ? indexingPct : analyzedPct}%` }}
                  />
                  {aiStatus.is_analysis_paused && !isPrioritizingIndexing && (
                    <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.3em]">Analysis Paused</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                   <div className="flex gap-2">
                     <button
                        onClick={async () => {
                           await invoke(aiStatus.is_analysis_paused ? "resume_analysis" : "stop_analysis");
                           fetchStatus();
                        }}
                        className={`px-4 py-2 rounded-lg border font-bold text-[9px] uppercase tracking-widest transition-all active:scale-95 ${
                          aiStatus.is_analysis_paused 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white" 
                            : "bg-surface-800 border-white/10 text-surface-400 hover:bg-surface-700 hover:text-white"
                        }`}
                     >
                       {aiStatus.is_analysis_paused ? "Resume Analysis" : "Pause Analysis"}
                     </button>
                   </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Library" value={aiStatus.total_images} icon={<ImageIcon />} />
                <StatBox label="Analyzed" value={aiStatus.analyzed_images} color="emerald" icon={<CheckIcon />} />
                <StatBox label="Pending" value={aiStatus.pending_images} color={aiStatus.pending_images > 0 ? "amber" : "dim"} icon={<ClockIcon />} />
              </div>

              {/* Engine Specs */}
              <div className="flex flex-col gap-0.5 rounded-xl border border-white/5 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 bg-white/3">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-surface-400">Inference Engine</span>
                   <div className="flex items-center gap-2">
                     <span className={`w-1.5 h-1.5 rounded-full ${aiStatus.is_mock ? "bg-amber-400 animate-pulse" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"}`} />
                     <span className="text-xs font-bold text-surface-100">{aiStatus.engine_name}</span>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              AI Status Unavailable (External Engine)
            </div>
          )}
        </Section>
        
        {/* ── Maintenance ────────────────────────────────────────── */}
        <Section icon={<TrashIcon />} title="Maintenance" description="Manage and housekeep your generated stories.">
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-brand-400">Repair AI Analysis</span>
                <span className="text-[10px] text-surface-500 font-medium whitespace-pre-line">
                  Identify images with garbled or empty tags and re-queue them for analysis.{"\n"}
                  (Fixes "(arabic)" or numeric junk tags)
                </span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const count = await invoke<number>("trigger_junk_reanalysis");
                    alert(`Found and re-queued ${count} images for repair.`);
                  } catch (e) {
                    console.error(`Error during repair: ${e}`);
                  }
                }}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-widest hover:bg-brand-500 hover:text-white transition-all active:scale-95"
              >
                Start Repair
              </button>
            </div>

            <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-purple-400">Diagnostic Dry Run</span>
                <span className="text-[10px] text-surface-500 font-medium">Test image analysis and caption generation with the current model.</span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const result: any = await invoke("test_ai_generation");
                    console.log("Diagnostic Result:", result);
                    alert(`Success: ${result.success}\nCaption: ${result.generated_caption}\nTags: ${result.tags.join(", ")}`);
                  } catch (e) {
                    alert(`Diagnostic failed: ${e}`);
                  }
                }}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all active:scale-95"
              >
                Test AI
              </button>
            </div>

            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-red-400">Delete All Stories</span>
                <span className="text-[10px] text-surface-500 font-medium">This will permanently remove stories from your library, except for your Favorites.</span>
              </div>
              <button
                onClick={async () => {
                  try {
                    await invoke("delete_all_stories");
                    window.location.reload(); // Refresh to clear feed
                  } catch (e) {
                    console.error(`Error deleting all stories: ${e}`);
                  }
                }}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                Clear All
              </button>
            </div>

            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-red-400">Reset</span>
                <span className="text-[10px] text-surface-500 font-medium">Clear everything: database, settings, and index. The app will restart.</span>
              </div>
              <button
                onClick={async () => {
                  if (confirm("Are you SURE? This will delete EVERYTHING and restart the app.")) {
                    try {
                      await invoke("reset_app");
                    } catch (e) {
                      alert(`Error resetting app: ${e}`);
                    }
                  }
                }}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                Reset App
              </button>
            </div>
          </div>
        </Section>

        {/* ── App Information ───────────────────────────────────── */}
        <Section icon={<InfoIcon />} title="App Information" description="Technical details of the current StoryBox build.">
          <div className="flex flex-col rounded-2xl border border-white/5 overflow-hidden bg-surface-950/40">
            <ManifestRow label="Version" value="2.0.3-alpha" />
            <ManifestRow label="Architecture" value="Tauri 2 · React · Rust" />
            <ManifestRow label="Backend DB" value="SQLite via sqlx" />
            <ManifestRow label="Asset Pipeline" value="500px thumbs · 1080px display" />
            <ManifestRow label="Job Runner" value="Parallel Core Scaling · MPSC (100)" last />
          </div>
        </Section>

        {/* Support Footer */}
        <footer className="mt-4 flex flex-col items-center gap-4 py-6 px-10 rounded-3xl bg-brand-500/5 border border-brand-500/10 text-center">
           <p className="text-surface-400 text-xs font-medium max-w-sm leading-relaxed">
             StoryBox uses local AI to protect your privacy. No data ever leaves your device for analysis.
           </p>
           <div className="flex gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
              <TauriLogo />
              <ReactLogo />
              <RustLogo />
           </div>
        </footer>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AiSettingsSection() {
  const [provider, setProvider] = useState<string>("mock");
  const [url, setUrl] = useState("http://localhost:11434");
  const [model, setModel] = useState("llama3");
  const [visionModel, setVisionModel] = useState("moondream");
  const [autoGenInterval, setAutoGenInterval] = useState(12);
  const [cleanupInterval, setCleanupInterval] = useState(24);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    invoke<[string, string, string, string, number, number]>("get_ai_settings")
      .then(([p, u, m, v, ag, cl]) => {
        setProvider(p);
        setUrl(u);
        setModel(m);
        setVisionModel(v);
        setAutoGenInterval(ag);
        setCleanupInterval(cl);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await invoke("update_ai_settings", { 
        provider, 
        baseUrl: url, 
        modelName: model, 
        visionModelName: visionModel,
        autoGenIntervalHours: Number(autoGenInterval),
        cleanupIntervalHours: Number(cleanupInterval)
      });
      setMessage("Settings saved!");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-surface-400">AI Intelligence Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setProvider("mock")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              provider === "mock" 
                ? "bg-brand-500/10 border-brand-500 text-brand-400" 
                : "bg-surface-900 border-white/5 text-surface-400 hover:border-white/10"
            }`}
          >
            Mock Simulation
          </button>
          <button
            onClick={() => setProvider("ollama")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              provider === "ollama" 
                ? "bg-brand-500/10 border-brand-500 text-brand-400" 
                : "bg-surface-900 border-white/5 text-surface-400 hover:border-white/10"
            }`}
          >
            Ollama (Real Local)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-brand-500/5 rounded-2xl border border-brand-500/10">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-surface-400">Auto-Generate (Hours)</label>
          <input 
            type="number" 
            min="1"
            value={autoGenInterval} 
            onChange={e => setAutoGenInterval(parseInt(e.target.value) || 1)}
            className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-brand-500 shadow-inner"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-surface-400">Expiration (Hours)</label>
          <input 
            type="number"
            min="1"
            value={cleanupInterval} 
            onChange={e => setCleanupInterval(parseInt(e.target.value) || 1)}
            className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-brand-500 shadow-inner"
          />
        </div>
      </div>

      {provider === "ollama" && (
        <div className="flex flex-col gap-4 p-4 bg-surface-950/60 rounded-2xl border border-white/5 animate-scale-in">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Ollama API URL</label>
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)}
              className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-brand-500 transition-colors shadow-inner"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Story Model (Text)</label>
              <input 
                type="text" 
                value={model} 
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. llama3"
                className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-brand-500 transition-colors shadow-inner"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Vision Model (Image)</label>
              <input 
                type="text" 
                value={visionModel} 
                onChange={e => setVisionModel(e.target.value)}
                placeholder="e.g. moondream"
                className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-brand-500 transition-colors shadow-inner"
              />
            </div>
          </div>
          <p className="text-[10px] text-surface-500 font-medium italic">
            Note: Real vision analysis takes 2-5s per image. Use `moondream` for best performance.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mt-2">
        <span className="text-xs font-semibold text-brand-400/80">{message}</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-surface-50 text-surface-950 text-xs font-bold uppercase tracking-wider hover:bg-white active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Config"}
        </button>
      </div>
    </div>
  );
}

function Section({ id, icon, title, description, children }: { id?: string; icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="relative group">
      {/* Indicator clipping wrapper */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="indicator absolute left-[-1px] top-0 bottom-0 z-10 w-[4px] bg-brand-500/20 rounded-full group-hover:bg-brand-500 transition-all duration-500" />
      </div>
      
      <div className="glass-card p-6 flex flex-col gap-5 border border-white/5 shadow-2xl relative z-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="text-brand-400 w-5 h-5">{icon}</span>
            <h2 className="text-lg font-bold text-surface-50 tracking-tight">{title}</h2>
          </div>
          <p className="text-xs text-surface-500 font-medium ml-7 tracking-wide">{description}</p>
        </div>
        <div className="flex flex-col flex-1">
          {children}
        </div>
      </div>
    </section>
  );
}

function StatBox({ label, value, color, icon }: { label: string; value: number; color?: "emerald" | "amber" | "dim"; icon: React.ReactNode }) {
  const colorClasses = 
    color === "emerald" ? "text-emerald-400 bg-emerald-400/5" :
    color === "amber" ? "text-amber-400 bg-amber-400/5" :
    color === "dim" ? "text-surface-500 bg-surface-500/5" :
    "text-brand-400 bg-brand-400/5";
  
  return (
    <div className="flex flex-col gap-1.5 bg-surface-950/60 border border-white/5 rounded-2xl p-4 transition-transform hover:scale-[1.02]">
      <div className={`p-1.5 rounded-lg w-fit ${colorClasses}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-black text-white tracking-tight leading-none">{value.toLocaleString()}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500">{label}</span>
      </div>
    </div>
  );
}

function ModelBadge({ label, name, loaded }: { label: string; name?: string; loaded?: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-surface-950/60 border border-white/5 rounded-xl">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500">{label}</span>
        {loaded !== undefined && (
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${loaded ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            {loaded ? "Ready" : "Missing"}
          </span>
        )}
      </div>
      <span className="text-xs font-bold text-surface-200 truncate">{name || "Not Specified"}</span>
    </div>
  );
}

function ManifestRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between items-center px-5 py-3.5 hover:bg-white/5 transition-colors ${!last ? "border-b border-white/5" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-widest text-surface-500">{label}</span>
      <span className="text-xs font-bold text-surface-200">{value}</span>
    </div>
  );
}

// SVG icons
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
}
function FolderIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function SparkIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
}
function InfoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}
function DeviceIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}
function FolderPlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>;
}
function ImageIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>;
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function BrainIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M12.50016,29l-2.62921.0519a8.729,8.729,0,0,1-8.87079-8.7284v-.3018a8.3648,8.3648,0,0,1,1.90109-5.37l.1137-.1379A23.39639,23.39639,0,0,1,15.46249,6.67986"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M40.37144,38.114A8.00134,8.00134,0,0,1,25.00016,35"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M17.92875,25a4.92858,4.92858,0,0,1-4.92859-4.9286"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M20.00016,35l.42229.8446A33.885,33.885,0,0,1,23.76116,47"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M29.74645,47a33.87775,33.87775,0,0,0-1.034-5.253"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M16.92875,10A5.64548,5.64548,0,0,1,22.3291,6H23"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M27.7466,25h-9.5c-2.76141,0-5.5,2.10942-5.5,4.87082a5,5,0,0,0,5,5h9s1.70239,1.1349,3.29369,2.1957a10.74328,10.74328,0,0,0,5.96,1.8043A10.96518,10.96518,0,0,0,46.9997,28.12642L47,26.05472a15.27948,15.27948,0,0,0-.8732-5.093q-.244-.6906-.55234-1.35317"/>
      <circle fill="currentColor" cx="16.1145" cy="12.97726" r="1.5" transform="translate(-4.40407 15.63712) rotate(-46.2312)"/>
      <circle fill="currentColor" cx="13" cy="17" r="1.5"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M22.30369,28.05378A5.0014,5.0014,0,0,0,17.69662,25"/>
      <circle fill="currentColor" cx="23" cy="30.97726" r="1.5" transform="translate(-15.28008 26.1579) rotate(-46.2312)"/>
      <circle fill="currentColor" cx="31" cy="25" r="1.5"/>
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M43,23.99994a4,4,0,0,1,4,4"/>
      <g>
        <rect fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" height="12" width="12" x="31" y="4"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="34" x2="36" y1="12" y2="12"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="38" x2="40" y1="12" y2="12"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="34" x2="36" y1="8" y2="8"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="38" x2="40" y1="8" y2="8"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="37" x2="37" y1="16" y2="21"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="41" x2="41" y1="16" y2="21"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="31" x2="26" y1="6" y2="6"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="31" x2="26" y1="10" y2="10"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="31" x2="26" y1="14" y2="14"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="33" x2="33" y1="16" y2="21"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="43" x2="48" y1="6" y2="6"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="43" x2="48" y1="10" y2="10"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="43" x2="48" y1="14" y2="14"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="40.99999" x2="40.99993" y1="4" y2="0"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="36.99999" x2="36.99993" y1="4" y2="0"/>
        <line fill="none" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" x1="32.99999" x2="32.99993" y1="4" y2="0"/>
      </g>
    </svg>
  );
}
function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
}
function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}

function TauriLogo() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-sky-400 opacity-50"><path d="M12 2L1 12l11 10 11-10L12 2zm0 18.2L3.8 12 12 3.8l8.2 8.2-8.2 8.2z"/></svg>;
}
function ReactLogo() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-cyan-400 opacity-50"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>;
}
function RustLogo() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400 opacity-50"><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>;
}
