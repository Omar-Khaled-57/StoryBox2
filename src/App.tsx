import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import HomeFeed from "./components/HomeFeed";
import StoryViewer from "./components/StoryViewer";
import SettingsPanel from "./components/SettingsPanel";
import ActivityIndicator, { ActivityItem } from "./components/ActivityIndicator";
import logoSrc from "./assets/logo.png";

export interface ImageRecord {
  id: string;
  path: string;
  date_taken: string | null;
  ai_analyzed: boolean;
  tags?: string[];
  vibe?: string;
}

export interface AiStatus {
  total_images: number;
  analyzed_images: number;
  pending_images: number;
  is_mock: boolean;
  engine_name: string;
  is_indexing_paused: boolean;
  is_analysis_paused: boolean;
  total_found: number;
  indexed_count: number;
}

export interface AiHealthStatus {
  available: boolean;
  vision_model?: string;
  vision_model_loaded?: boolean;
  text_model?: string;
  text_model_loaded?: boolean;
  message: string;
}

export interface Story {
  id: string;
  theme_type: string;
  caption: string;
  created_at: string;
  images: ImageRecord[];
  is_favorite: boolean;
  is_pinned: boolean;
}

type View = "home" | "favorites" | "settings";

// ─── activity helpers ───────────────────────────────────────────────────────
let _nextId = 0;
function mkId() { return String(++_nextId); }

function App() {
  const [view, setView] = useState<View>("home");
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scanLog, setScanLog] = useState("Ready to index");
  const [isScanning, setIsScanning] = useState(false);
  const [showNoPhotosPopup, setShowNoPhotosPopup] = useState(false);
  const [aiHealth, setAiHealth] = useState<AiHealthStatus | null>(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | null>(null);

  // Activity list shown in the nav indicator
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const addActivity = (label: string): string => {
    const id = mkId();
    setActivities((prev) => [...prev, { id, label }]);
    return id;
  };

  const removeActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const loadStories = useCallback(async () => {
    try {
      const result = await invoke<Story[]>("get_stories");
      setStories(result);
    } catch (e) {
      console.error("Failed to load stories:", e);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

    useEffect(() => {
        const unlistenIndexing = listen<{message: string; path: string}>("indexing-progress", (event) => {
            setActivities(prev => {
                const idx = prev.findIndex(a => a.id === "indexing");
                if (idx === -1) {
                    return [...prev, { 
                        id: "indexing", 
                        label: "Indexing (1)", 
                        progress: 5, 
                        statusMessage: event.payload.message 
                    }];
                }
                const newActivities = [...prev];
                const current = newActivities[idx];
                const currentProgress = current.progress || 0;
                const match = current.label.match(/\((\d+)\)/);
                const count = match ? parseInt(match[1]) + 1 : 1;
                
                newActivities[idx] = { 
                    ...current,
                    label: `Indexing (${count})`,
                    statusMessage: event.payload.message,
                    progress: Math.min(currentProgress + 0.2, 99)
                };
                return newActivities;
            });
            setScanLog(event.payload.message);
        });

        const unlistenAnalysis = listen<{message: string; id: string}>("analysis-progress", (event) => {
            setActivities(prev => {
                const idx = prev.findIndex(a => a.id === "analysis");
                if (idx === -1) {
                    return [...prev, { 
                        id: "analysis", 
                        label: "AI Processing (1)", 
                        progress: 5, 
                        statusMessage: event.payload.message 
                    }];
                }
                const newActivities = [...prev];
                const current = newActivities[idx];
                const currentProgress = current.progress || 0;
                const match = current.label.match(/\((\d+)\)/);
                const count = match ? parseInt(match[1]) + 1 : 1;

                newActivities[idx] = { 
                    ...current, 
                    label: `AI Processing (${count})`,
                    statusMessage: event.payload.message,
                    progress: Math.min(currentProgress + 0.2, 99) 
                };
                return newActivities;
            });
            setScanLog(event.payload.message);
            loadStories();
        });

        const unlistenRefresh = listen("refresh-stories", () => {
            console.log("[App] Stories refreshed by backend");
            loadStories();
        });

        const unlistenNoPhotos = listen("no-photos-found", () => {
            console.log("[App] No photos found on startup");
            setShowNoPhotosPopup(true);
        });

        const unlistenMobileScan = listen("trigger-mobile-scan", async (_event) => {
            console.log("[App] Mobile scan triggered");
            try {
                const { requestPermissions, getImages, MediaLibrarySource } = await import("@universalappfactory/tauri-plugin-medialibrary");
                const permissions = await requestPermissions({ source: MediaLibrarySource.ExternalStorage });
                if (permissions?.postNotification !== "granted") {
                    console.warn("[App] Media library permission not granted:", permissions?.postNotification);
                }

                const result = await getImages({
                    limit: 1000,
                    offset: 0,
                    source: MediaLibrarySource.ExternalStorage
                });
                
                const images = result?.items || [];
                console.log(`[App] Mobile media library found ${images.length} images`);
                
                setActivities(prev => [
                    ...prev.filter(a => a.id !== "indexing"), 
                    { id: "indexing", label: `Indexing Mobile (${images.length})`, progress: 0 }
                ]);
                
                const CHUNK_SIZE = 5;
                for (let i = 0; i < images.length; i += CHUNK_SIZE) {
                    const chunk = images.slice(i, i + CHUNK_SIZE);
                    await Promise.all(chunk.map((img: any) => invoke("index_mobile_image", { path: img.path })));
                    setActivities(prev => prev.map(a => 
                        a.id === "indexing" ? { ...a, progress: Math.min((i / images.length) * 100, 99) } : a
                    ));
                }
                
                setActivities(prev => prev.map(a => 
                    a.id === "indexing" ? { ...a, label: `Mobile Scan Complete`, progress: 100 } : a
                ));
                setTimeout(() => setActivities(prev => prev.filter(a => a.id !== "indexing")), 5000);
                loadStories();
            } catch (e) {
                console.error("Failed to run mobile scan:", e);
            }
        });

        const unlistenScanComplete = listen<number>("scan-complete", (event) => {
            const count = event.payload;
            console.log(`[App] Scan complete. Found ${count} images.`);
            setActivities(prev => prev.map(a => 
                a.id === "indexing" ? { ...a, label: `Scan Complete (${count} found)`, progress: 100 } : a
            ));
            setTimeout(() => {
                setActivities(prev => prev.filter(a => a.id !== "indexing"));
            }, 5000);
            loadStories();
        });

        const unlistenAiHealth = listen<AiHealthStatus>("ai-health-status", (event) => {
            console.log("[App] AI Health Status Update:", event.payload);
            setAiHealth(event.payload);
        });

        const unlistenStoryUpdated = listen<{id: string; caption: string}>("story-updated", (event) => {
            console.log("[App] Story updated in background:", event.payload.id);
            setStories(prev => prev.map(s => s.id === event.payload.id ? { ...s, caption: event.payload.caption } : s));
        });

        // Initial check on mount
        invoke<AiHealthStatus>("check_ai_availability").then(setAiHealth).catch(console.error);

        return () => {
            unlistenIndexing.then(f => f());
            unlistenAnalysis.then(f => f());
            unlistenRefresh.then(f => f());
            unlistenNoPhotos.then(f => f());
            unlistenMobileScan.then(f => f());
            unlistenScanComplete.then(f => f());
            unlistenAiHealth.then(f => f());
            unlistenStoryUpdated.then(f => f());
        };
    }, [loadStories]);

  const handleGenerateStory = async () => {
    setIsGenerating(true);
    const aid = addActivity("Generating story…");
    try {
      const story = await invoke<Story | null>("generate_story");
      if (story) {
        setStories((prev) => [story, ...prev]);
        setActiveStory(story);
        if (story.theme_type === "random") {
          setScanLog("Note: AI processing still pending or timed out. Template-based story created.");
        } else {
          setScanLog(`AI Story generated: ${story.caption}`);
        }
      } else {
        setScanLog("No photos were found to create a story. Try adding a folder first.");
      }
    } catch (e) {
      console.error("Failed to generate story:", e);
      setScanLog(`AI Story Error: ${e}`);
    } finally {
      setIsGenerating(false);
      removeActivity(aid);
    }
  };

  const handleAddLocation = async () => {
    try {
      const dir = await open({ directory: true, multiple: false });
      if (!dir) { setScanLog("Location selection cancelled."); return; }
      setIsScanning(true);
      setView("settings");
      setScanLog(`Scanning location: ${dir}…`);
      
      setActivities(prev => [...prev.filter(a => a.id !== "indexing"), { id: "indexing", label: "Indexing Files", progress: 0 }]);
      const count = await invoke<number>("start_scan", { dir });
      setScanLog(`Found ${count} images. Indexing in background…`);
      
      // Update the indexing activity to show the total
      setActivities(prev => prev.map(a => a.id === "indexing" ? { ...a, label: `Indexing (${count})` } : a));
      loadStories();
    } catch (e) {
      setScanLog(`Error adding location: ${e}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanDevice = async () => {
    try {
      setIsScanning(true);
      setView("settings");
      setScanLog("Scanning device (Pictures, Desktop, Documents, Downloads)…");
      
      setActivities(prev => [...prev.filter(a => a.id !== "indexing"), { id: "indexing", label: "Scanning Device", progress: 0 }]);
      const count = await invoke<number>("start_scan_device");
      setScanLog(`Found ${count} images. Indexing in background…`);
      
      setActivities(prev => prev.map(a => a.id === "indexing" ? { ...a, label: `Indexing (${count})` } : a));
      loadStories();
    } catch (e) {
      setScanLog(`Error scanning device: ${e}`);
    } finally {
      setIsScanning(false);
    }
  };

  const navigateToSettingsSection = (sectionId: string) => {
    setSettingsInitialSection(sectionId);
    setView("settings");
  };

  const handleDeleteStory = async (id: string) => {
    try {
      await invoke("delete_story", { id });
      setStories((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error("Failed to delete story:", e);
    }
  };

  const handleTogglePin = async (id: string) => {
    try {
      const is_pinned = await invoke<boolean>("toggle_story_pin", { id });
      setStories((prev) =>
        [...prev].map((s) => (s.id === id ? { ...s, is_pinned } : s))
          .sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0);
          })
      );
    } catch (e) {
      console.error("Failed to toggle pin:", e);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const is_favorite = await invoke<boolean>("toggle_story_favorite", { id });
      setStories((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_favorite } : s))
      );
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
  };

  return (
    <div className="flex flex-col-reverse sm:flex-row w-screen h-screen overflow-hidden bg-surface-950 text-surface-50 font-sans selection:bg-brand-500/30">
      {activeStory && (
        <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />
      )}

      {/* Styled Responsive Navigation */}
      <nav className="flex flex-row sm:flex-col items-center justify-between sm:justify-start w-full sm:w-20 h-20 sm:h-full px-4 py-0 sm:py-8 sm:px-0 gap-2 sm:gap-6 shrink-0 z-10 border-t sm:border-t-0 sm:border-r border-white/5 bg-surface-900/50 backdrop-blur-xl shadow-xl">
        <div className="logo hidden sm:flex items-center justify-center mb-4">
          <img
            src={logoSrc}
            alt="StoryBox"
            className="w-11 h-11 rounded-2xl shadow-lg shadow-brand-500/30 ring-1 ring-white/10"
            draggable={false}
          />
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex flex-row sm:flex-col justify-center gap-4 sm:gap-4 flex-1 sm:w-full sm:px-3 h-full sm:h-auto items-center">
          <button
            className={`flex items-center justify-center w-12 sm:w-full aspect-square rounded-2xl border-none cursor-pointer transition-all duration-300 active:scale-95 group ${
              view === "home" 
                ? "bg-brand-500/15 text-brand-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                : "bg-transparent text-surface-400 hover:bg-surface-800 hover:text-white"
            }`}
            onClick={() => setView("home")}
            title="Home"
          >
            <svg className="w-6 h-6 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          
          <button
            className={`flex items-center justify-center w-12 sm:w-full aspect-square rounded-2xl border-none cursor-pointer transition-all duration-300 active:scale-95 group ${
              view === "settings" 
                ? "bg-brand-500/15 text-brand-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                : "bg-transparent text-surface-400 hover:bg-surface-800 hover:text-white"
            }`}
            onClick={() => setView("settings")}
            title="Settings"
          >
            <svg className="w-6 h-6 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
          
          <button
            className={`flex items-center justify-center w-12 sm:w-full aspect-square rounded-2xl border-none cursor-pointer transition-all duration-300 active:scale-95 group ${
              view === "favorites" 
                ? "bg-red-500/15 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                : "bg-transparent text-surface-400 hover:bg-surface-800 hover:text-white"
            }`}
            onClick={() => setView("favorites")}
            title="Favorites"
          >
            <svg className="w-6 h-6 transition-transform group-hover:scale-110 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>

          {/* Portrait-only Add Location Button */}
          <button
            className="sm:hidden flex items-center justify-center w-12 aspect-square rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg shadow-brand-500/30 cursor-pointer transition-all duration-300 active:scale-95 group relative overflow-hidden"
            onClick={handleAddLocation}
            title="Add Folder Location"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
          </button>
        </div>

        {/* Activity Indicator */}
        <ActivityIndicator activities={activities} />

        {/* Landscape-only Add Location Action Button */}
        <div className="hidden sm:flex sm:w-full sm:px-3 sm:mb-4 h-full sm:h-auto items-center">
           <button
             className="flex sm:flex-col items-center justify-center w-12 sm:w-full aspect-square rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg shadow-brand-500/30 cursor-pointer transition-all duration-300 hover:scale-[1.05] hover:shadow-brand-500/50 hover:from-brand-500 hover:to-brand-300 active:scale-95 group relative overflow-hidden"
             onClick={handleAddLocation}
             title="Add Folder Location"
           >
             <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <svg className="w-6 h-6 sm:w-7 sm:h-7 sm:mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
             <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider opacity-90">Add</span>
           </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-[1_1_100%] overflow-hidden flex flex-col relative bg-gradient-to-br from-surface-950 to-surface-900 border-l border-white/5">
        {view === "home" && (
          <HomeFeed
            stories={stories}
            onStoryClick={setActiveStory}
            onGenerate={handleGenerateStory}
            isGenerating={isGenerating}
            onDeleteStory={handleDeleteStory}
            onTogglePin={handleTogglePin}
            onToggleFavorite={handleToggleFavorite}
            aiHealth={aiHealth}
            onNavigateToSettings={navigateToSettingsSection}
          />
        )}
        {view === "favorites" && (
          <HomeFeed
            stories={stories.filter(s => s.is_favorite)}
            onStoryClick={setActiveStory}
            onGenerate={handleGenerateStory}
            isGenerating={isGenerating}
            onDeleteStory={handleDeleteStory}
            onTogglePin={handleTogglePin}
            onToggleFavorite={handleToggleFavorite}
            aiHealth={aiHealth}
            onNavigateToSettings={navigateToSettingsSection}
            title="Your Favorites"
          />
        )}
        {view === "settings" && (
          <SettingsPanel
            scanLog={scanLog}
            isScanning={isScanning}
            onScan={handleAddLocation}
            onScanDevice={handleScanDevice}
            aiHealth={aiHealth}
            setAiHealth={setAiHealth}
            initialSection={settingsInitialSection}
            onInitialSectionHandled={() => setSettingsInitialSection(null)}
          />
        )}
      </main>

      {/* No Photos Found Popup */}
      {showNoPhotosPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-surface-900 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                  <path d="M12 12v9" />
                  <path d="m8 17 4 4 4-4" />
                </svg>
              </div>
              
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold text-surface-50">Deep Silence...</h3>
                <p className="text-sm text-surface-400 leading-relaxed">
                  No photos were found to create a story. Try adding a folder first.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowNoPhotosPopup(false);
                  setView("settings");
                }}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-bold text-sm tracking-wider uppercase hover:bg-brand-400 active:scale-[0.98] transition-all shadow-lg shadow-brand-500/20"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
