# StoryBox

Welcome to **StoryBox**! A beautiful, AI-powered photo storytelling app built with Tauri.

StoryBox locally indexes your photos and automatically crafts stunning stories, captions, and themes using powerful local AI models. Let your memories come to life, automatically!

---

## Features

- **Local AI Analysis**: Uses powerful local LLMs (Ollama) to generate tags, vibes, and narrative captions for your photos.
- **Automated Story Generation**: Stories are automatically generated on a configurable schedule (default: every 12 hours).
- **Smart Cleanup**: Unpinned stories are automatically cleaned up every 24 hours to keep your feed fresh.
- **Pin & Favorite**: Save your favorite stories forever by pinning or favoriting them.
- **Background Indexing**: Scans your devices and custom folders intelligently in the background. Does not require server upload!
- **Cross-Platform**: Runs on Windows, macOS, Linux, Android, and iOS.

## Platform Support

| Platform | Status | Notes |
|---|---|---|
| Windows | ✅ Fully supported | Desktop: Pictures, OneDrive, custom folders |
| macOS | ✅ Fully supported | Desktop: Pictures, Apple Photos library |
| Linux | ✅ Fully supported | Desktop: Pictures directory |
| Android | ✅ Supported | Uses `tauri-plugin-medialibrary` for device gallery access |
| iOS | ⚠️ Supported (untested) | Uses `tauri-plugin-ios-photos` (native Photos framework). Cannot be debugged or built without a macOS + Xcode environment — community testing welcome |

### iOS Details

The iOS code path is fully wired:
- `Info.plist` includes `NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription`
- Uses the native [Photos framework](https://developer.apple.com/documentation/photos) via `tauri-plugin-ios-photos` (v0.3)
- Requests photo library authorization, reads the user library album, and indexes photos via base64 image data
- Device scanning delegates to the frontend (same pattern as Android)

To build for iOS you need a macOS machine with Xcode:
```bash
npm run tauri ios build
```

## Project Structure

- `src/` — The React/TypeScript frontend (built with Vite and TailwindCSS).
- `src-tauri/` — The Rust backend powering the Tauri application and local OS integrations.
- `public/` — Static assets and icons.

## Prerequisites

| Tool | Required For | Install |
|------|-------------|---------|
| **Node.js** v18+ | Frontend build | [nodejs.org](https://nodejs.org) |
| **Rust** & Cargo | Tauri backend | [rustup.rs](https://rustup.rs) |
| **Ollama** | AI analysis on desktop | [ollama.com/download](https://ollama.com/download) |
| **Android Studio** | Android build (optional) | [developer.android.com/studio](https://developer.android.com/studio) |

### Ollama Setup (Required for AI Features)

StoryBox uses Ollama to analyze photos and generate captions locally. The app works without it (falls back to template-based stories), but AI features require Ollama running.

```bash
# 1. Install Ollama from https://ollama.com/download

# 2. Start the Ollama server
ollama serve

# 3. Pull the required models (about 2-3 GB each)
ollama pull moondream     # vision model — analyzes images
ollama pull llama3        # text model — writes captions
```

> The app connects to `http://localhost:11434` by default. If you run Ollama on a different machine, change the URL in Settings → AI Storyteller.

### Android Build Setup
```bash
# Set ANDROID_HOME to your SDK path (Windows example):
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")

# Initialize the Android project (one-time)
npm run tauri android init
```

### Clone & Install
```bash
git clone https://github.com/Omar-Khaled-57/StoryBox2/
cd StoryBox
npm install
```

## How to Run the App

For standard desktop development (Windows/macOS/Linux), start the Vite plus Tauri rust dev server:
```bash
npm run tauri dev
```

For Android development:
```bash
npm run tauri android dev
```

For iOS development (macOS + Xcode required):
```bash
npm run tauri ios dev
```

## Build Instructions

When you're ready to compile the app for distribution:

**Build for Windows (Desktop):**
```bash
npm run tauri build
```

**Build for Android (APK):**
```bash
npm run tauri android build --apk
```

**Build for iOS (IPA, requires macOS + Xcode):**
```bash
npm run tauri ios build
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Rust (Tauri 2), SQLite (sqlx), image processing via `image` crate
- **AI**: Ollama (local LLM inference) with Mock fallback for development
- **Mobile**: Android via `tauri-plugin-medialibrary`, iOS via `tauri-plugin-ios-photos`
