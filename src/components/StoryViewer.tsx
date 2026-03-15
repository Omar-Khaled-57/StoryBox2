import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Story } from "../App";

interface StoryViewerProps {
  story: Story;
  onClose: () => void;
}

const SEGMENT_DURATION = 5000; // ms per slide

export default function StoryViewer({ story, onClose }: StoryViewerProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isFullView, setIsFullView] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const currentImage = story.images[index];

  // Fetch base64 image whenever index changes
  useEffect(() => {
    if (!currentImage) return;
    setImgSrc(null);
    setImgLoaded(false);
    invoke<string>("get_cached_image_base64", { id: currentImage.id, imageType: "display" })
      .then(setImgSrc)
      .catch(console.error);
  }, [currentImage]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= story.images.length) { onClose(); return i; }
      return i + 1;
    });
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();
  }, [story.images.length, onClose]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();
  }, []);

  // Auto-advance timer — paused while image is loading OR user holds
  useEffect(() => {
    const isHeld = paused || !imgLoaded;
    if (isHeld) return;
    startTimeRef.current = Date.now() - elapsedRef.current;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min((elapsed / SEGMENT_DURATION) * 100, 100);
      setProgress(pct);
      if (elapsed >= SEGMENT_DURATION) {
        goNext();
      }
    }, 50);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [index, paused, imgLoaded, goNext]);

  // Reset progress on index change
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
  }, [index]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  // Build subject label from AI tags
  const subjectLabel = currentImage?.tags && currentImage.tags.length > 0
    ? currentImage.tags.join(" · ")
    : null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in" onContextMenu={(e) => e.preventDefault()}>
      <div className="relative w-full h-full max-w-md overflow-hidden bg-[#050505] flex flex-col shadow-2xl sm:rounded-3xl sm:h-[92vh] sm:border sm:border-white/10">

        {/* Background Blurred Image Layer */}
        {imgSrc && (
          <img
            key={`bg-${currentImage.id}`}
            src={imgSrc}
            className={`absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-30 transition-opacity duration-1000 ${
              imgLoaded ? "opacity-30" : "opacity-0"
            }`}
            alt=""
          />
        )}

        {/* Main Foreground Image — only shown once loaded */}
        {imgSrc && (
          <img
            key={currentImage.id}
            src={imgSrc}
            className={`absolute inset-0 w-full h-full transition-opacity duration-500 z-[2] ${
              imgLoaded ? "opacity-100" : "opacity-0"
            } ${
              isFullView ? "object-contain" : "object-cover"
            }`}
            alt=""
            onLoad={() => {
              setImgLoaded(true);
            }}
            onError={() => setImgLoaded(true)}
          />
        )}

        {/* Shimmer placeholder while loading */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-surface-900 animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <svg className="w-8 h-8 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path opacity="0.25" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                <path d="M12 2v4"/>
              </svg>
              <span className="text-xs text-white/30 font-medium tracking-widest uppercase">Loading…</span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 z-[1] pointer-events-none" />

        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-4 z-10">
          {story.images.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-[width] duration-[50ms] ease-linear"
                style={{
                  width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 flex items-start justify-between px-4 z-10 drop-shadow-md">
          <div className="flex flex-col gap-0.5 pr-4">
            <span className="text-sm font-semibold text-white leading-tight">{story.caption}</span>
            <span className="text-[0.65rem] text-white/70 font-bold uppercase tracking-widest">
              {story.theme_type === "random" ? "✨ Random Story" : "🤖 AI Story"}
            </span>
          </div>
          <button 
            className="shrink-0 bg-black/10 backdrop-blur-md border-none text-white w-8 h-8 rounded-full cursor-pointer text-sm flex items-center justify-center transition-all hover:bg-white/25 active:scale-95 bg-black" 
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tap zones */}
        <div className="absolute inset-0 flex z-[5] select-none">
          <div
            className="flex-[0.4] cursor-pointer"
            onClick={goPrev}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
          <div
            className="flex-[0.6] cursor-pointer"
            onClick={goNext}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
        </div>

        {/* Footer — subject tags + filename */}
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-start gap-2 px-5 z-10 pointer-events-none">
          {/* AI subject tags */}
          {subjectLabel && (
            <div className="flex flex-wrap gap-1">
              {currentImage.vibe && (
                <span className="text-[0.65rem] font-extrabold uppercase tracking-widest bg-brand-500 text-white px-3 py-1 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.5)] border border-white/20">
                  {currentImage.vibe}
                </span>
              )}
              {currentImage.tags!.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[0.65rem] font-bold bg-black/50 backdrop-blur-xl text-white px-2 py-1 rounded-full border border-white/10 shadow-lg">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* File info row */}
          <div className="flex justify-between items-center w-full text-white/40 text-[0.7rem] font-medium tracking-wide drop-shadow-sm">
            <span>{index + 1} / {story.images.length}</span>
            {currentImage?.path && (
              <span className="max-w-[70%] overflow-hidden overflow-ellipsis whitespace-nowrap direction-rtl text-right">
                {currentImage.path.split(/[\\\/]/).pop()}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Full Image Toggle Button - Bottom Right */}
      <button
        className="fixed bottom-6 right-6 z-[1100] w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center transition-all hover:bg-white/20 hover:scale-110 active:scale-95 shadow-2xl group"
        onClick={(e) => {
          e.stopPropagation();
          setIsFullView(!isFullView);
        }}
        title={isFullView ? "Zoom View" : "Full View"}
      >
        {isFullView ? (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
          </svg>
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        )}
      </button>
    </div>
  );
}
