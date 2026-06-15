use crate::processor::IndexingJob;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult};
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use crate::processor::ProcessingState;
use tokio::sync::mpsc::Sender;

pub fn start_folder_watcher(
    tx: Sender<IndexingJob>,
    _state: Arc<ProcessingState>,
) -> notify::Result<()> {
    let (debounced_tx, mut debounced_rx) = std::sync::mpsc::channel();

    let mut debouncer = new_debouncer(
        std::time::Duration::from_secs(2),
        None,
        debounced_tx,
    )?;

    // Watch standard picture directories
    let watch_dirs = discover_watch_dirs();
    for dir in &watch_dirs {
        if dir.exists() {
            println!("[Watcher] Watching: {:?}", dir);
            let _ = debouncer.watcher().watch(dir, RecursiveMode::Recursive);
        }
    }

    // Spawn a blocking thread to process file system events
    std::thread::spawn(move || {
        for event in debounced_rx {
            match event {
                DebounceEventResult::Ok(events) => {
                    for event in events {
                        for path in &event.paths {
                            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                                let ext_lower = ext.to_lowercase();
                                if matches!(ext_lower.as_str(), "jpg" | "jpeg" | "png" | "webp")
                                    && path.is_file()
                                {
                                    let _ = tx.blocking_send(IndexingJob { path: path.to_path_buf() });
                                }
                            }
                        }
                    }
                }
                DebounceEventResult::Err(errors) => {
                    for e in errors {
                        eprintln!("[Watcher] Error: {}", e);
                    }
                }
            }
        }
    });

    Ok(())
}

fn discover_watch_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();

    if let Some(user_dirs) = directories::UserDirs::new() {
        if let Some(p) = user_dirs.picture_dir() {
            dirs.push(p.to_path_buf());
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(home) = std::env::var("USERPROFILE") {
            let home_path = std::path::PathBuf::from(home);
            for var in &["OneDrive", "One Drive"] {
                let od_pics = home_path.join(var).join("Pictures");
                if od_pics.exists() {
                    dirs.push(od_pics);
                }
            }
        }
    }

    dirs.sort();
    dirs.dedup();
    dirs
}
