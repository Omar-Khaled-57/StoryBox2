import { useState, useRef, useEffect } from "react";

export interface ActivityItem {
  id: string;
  label: string;
  progress?: number; 
  statusMessage?: string;
}

interface ActivityIndicatorProps {
  activities: ActivityItem[];
}

export default function ActivityIndicator({ activities }: ActivityIndicatorProps) {
  const busy = activities.length > 0;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex sm:w-full sm:px-3 sm:mt-2 items-center justify-center">
      <button
        onClick={() => setOpen((v) => !v)}
        title={busy ? "Activity in progress — click for details" : "All done"}
        className={`
          flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300
          ${busy
            ? "border-brand-500/60 bg-brand-500/10 text-brand-400 shadow-md shadow-brand-500/20"
            : "border-white/10 bg-white/5 text-emerald-400 hover:bg-white/10"
          }
        `}
      >
        {busy ? (
          /* Spinner */
          <svg
            className="w-5 h-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3"/>
            <path d="M12 2v4" stroke="currentColor"/>
          </svg>
        ) : (
          /* Checkmark */
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div
          className={`
            absolute z-50 w-56 rounded-2xl bg-surface-900/95 backdrop-blur-xl border border-white/10
            shadow-2xl shadow-black/50 p-3 text-sm
            /* position: above on mobile (bottom nav), left on desktop (side nav) */
            bottom-14 left-1/2 -translate-x-1/2
            sm:bottom-auto sm:left-full sm:top-1/2 sm:-translate-y-1/2 sm:translate-x-0 sm:ml-3
          `}
        >
          {/* Arrow */}
          <div className={`
            absolute w-2.5 h-2.5 bg-surface-900/95 border-white/10 -rotate-45
            bottom-[-6px] left-1/2 -translate-x-1/2 border-b border-r
            sm:bottom-auto sm:left-[-6px] sm:top-1/2 sm:-translate-y-1/2
            sm:translate-x-0 sm:border-b-0 sm:border-r-0 sm:border-l sm:border-t
          `}/>

          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-surface-400 mb-2 px-1">
            {busy ? "In Progress" : "Status"}
          </p>
          {activities.length === 0 ? (
            <div className="flex items-center gap-2 px-1 py-1.5 text-emerald-400">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span className="text-white/80 font-medium">All done — nothing running</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {activities.map((act) => (
                <li key={act.id} className="flex flex-col gap-1.5 px-1 py-2 rounded-xl border border-white/5 bg-white/5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse shrink-0"/>
                    <span className="text-white/80 font-semibold text-[0.75rem] leading-snug">{act.label}</span>
                  </div>
                  
                  {act.statusMessage && (
                    <span className="text-surface-400 text-[0.65rem] truncate px-4">
                      {act.statusMessage}
                    </span>
                  )}

                  {typeof act.progress === 'number' && (
                    <div className="px-4 pb-1">
                      <div className="w-full bg-surface-800 rounded-full h-1 overflow-hidden">
                        <div 
                          className="bg-brand-500 h-full transition-all duration-500 ease-out" 
                          style={{ width: `${act.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
