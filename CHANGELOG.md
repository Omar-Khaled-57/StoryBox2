# StoryBox Changelog

A running log of every change, fix, and decision during development.

---

## v2.1.1 — iOS, Docs & Housekeeping

**Focus**: Wire iOS Photos framework support, rewrite documentation with clear setup instructions, and add this changelog.

### 🚀 New Features

- **iOS Photos framework support** — added `tauri-plugin-ios-photos` (v0.3) for native `PHPhotoLibrary` access. The `trigger-mobile-scan` handler now has an iOS branch: `requestPhotosAuth()` → `requestAlbums()` → `requestAlbumMedias()` → base64 images indexed via `index_ios_image_data` command.
- **`Info.plist`** — created with `NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription` keys.
- **iOS capability** — `ios-photos:default` permission registered in `capabilities/default.json`.
- **CHANGELOG.md** — this file, modelled after the BoardFlow changelog format.

### 📝 Documentation

- **README rewritten** — added Prerequisites table, dedicated Ollama Setup section with exact `ollama pull` commands, Android Build Setup section with `ANDROID_HOME` and `android init` steps, platform support table with iOS details, and build instructions for all platforms.

### 🧹 Changes

| File | What changed |
|------|-------------|
| `CHANGELOG.md` | **New** |
| `README.md` | Full rewrite: Ollama setup, platform table, Android/iOS build steps |
| `src-tauri/Info.plist` | **New** — iOS photo library usage descriptions |
| `src-tauri/Cargo.toml` | Added `tauri-plugin-ios-photos` behind `[target.'cfg(target_os = "ios")']` |
| `src-tauri/src/lib.rs` | Added `index_ios_image_data` command, conditional iOS plugin registration |
| `src-tauri/src/scanner.rs` | Clarified iOS/Android branching |
| `src-tauri/capabilities/default.json` | Added `ios-photos:default` permission |
| `src/App.tsx` | iOS photo scan branch in `trigger-mobile-scan` handler |
| `package.json` | Added `@gbyte/tauri-plugin-ios-photos` |

<details>
<summary><strong>v2.1.0 — Architecture, Automation & Cleanup</strong></summary>

**Focus**: Clean up the codebase, fix bugs, schedule automation, and stabilize the AI processing pipeline.

### 🚀 New Features

- **Automated story generation** — `run_automation_tasks()` is now called every 30 minutes via a background `tokio::spawn` loop in `lib.rs`. Auto-generates stories and cleans up unpinned stories older than 24 hours (matching the README's advertised behaviour that was previously never scheduled).

### 🐛 Bug Fixes

- **Vibe parsing truncation** (`ai.rs:196`) — the vibe extractor split on whitespace, so multi-word vibes like "very peaceful" were truncated to "very". Changed to split only on sentence-ending punctuation (`.` `,` `\n`), preserving multi-word vibes.
- **Missing CSS utilities** — `scrollbar-hide`, `animate-fade-in`, `animate-zoom-in`, `animate-slide-up`, `animate-in`, `zoom-in-95`, `slide-in-from-top-4`, `animate-scale-in` were referenced in components but never defined. Added keyframe animations and utility classes to `index.css`.
- **Unlisten cleanup in App.tsx** — sequential `.then(f => f())` on each `unlisten` promise replaced with `Promise.all(...).then(fns => fns.forEach(f => f()))`.
- **Gitignore missing artifacts** — added `output/`, `distos/`, `src-tauri/build_error.txt`.

### 🧹 Code Cleanup

- **Removed dead `greet` command** — unused Tauri boilerplate.
- **Removed `moondream` npm package** — unused; AI runs in Rust.
- **Removed `notify` and `dotenvy` Rust crates** — unused dependencies.
- **Version consolidation** — updated all references to **2.1.0**.
- **App identity** — changed identifier to `com.storybox.app`, product name to `StoryBox`.

| File | What changed |
|------|-------------|
| `src-tauri/Cargo.toml` | Removed `notify`/`dotenvy` |
| `src-tauri/src/lib.rs` | Removed `greet`, added periodic automation timer |
| `src-tauri/src/ai.rs` | Fixed vibe parsing for multi-word vibes |
| `src-tauri/src/stories.rs` | `run_automation_tasks` is now actually called |
| `src-tauri/tauri.conf.json` | Updated app name, version, identifier |
| `package.json` | Removed `moondream`, updated name/version |
| `.gitignore` | Added `output/`, `distos/`, `src-tauri/build_error.txt` |
| `src/App.tsx` | Cleaned up unlisten pattern |
| `src/index.css` | Added missing animation/scrollbar utility classes |
| `src/components/SettingsPanel.tsx` | Version string updated |

</details>
