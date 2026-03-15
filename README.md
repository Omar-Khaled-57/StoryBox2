# StoryBox 📦✨

Welcome to **StoryBox**! A beautiful, AI-powered photo storytelling app built with Tauri. 

StoryBox locally indexes your photos and automatically crafts stunning stories, captions, and themes using powerful local AI models. Let your memories come to life, automatically!

---

## 🌟 Personal Note from the Developer
> Hi there! 👋 
> 
> **This is my first cross-platform Tauri application.** 
> The app originally started as a simple desktop app and was later converted to cross-platform to support mobile devices. Because it's an early iteration of the cross-platform version, some things may not work perfectly yet. 
> 
> *Note: iOS has not been fully debugged or tested, so there may be issues if you run it on an iPhone or iPad.*
>
> Thanks for checking it out and bearing with the early-stage quirks!

---

## 🚀 Project Overview

StoryBox acts as your personal AI storyteller. By scanning your local device or specific folders, the app indexes your images fully locally and then uses AI (via models like Ollama, moondream, llama3) to analyze the vibes and context. Every 12 hours, a brand new story is automatically generated from your photo collection. To keep things clean, a 24-hour cleanup cycle automatically removes unpinned stories.

Your memories stay safe, local, and incredibly organized!

## ✨ Features

- **Local AI Analysis**: Uses powerful local LLMs to generate tags, vibes, and narrative captions for your photos.
- **Automated Story Generation**: Sit back and let the app build a new story for you automatically every 12 hours.
- **Smart Cleanup**: Unpinned stories are automatically cleaned up every 24 hours to keep your feed fresh. You can also delete all stories manually.
- **Pin & Favorite**: Save your favorite stories forever by pinning or favoriting them.
- **Background Indexing**: Scans your devices and custom folders intelligently in the background. Does not require server upload!
- **Cross-Platform**: Designed to run on Windows, Android, and potentially iOS.

## 🛠️ Project Structure

- `src/` — The React/TypeScript frontend (built with Vite and TailwindCSS).
- `src-tauri/` — The Rust backend powering the Tauri application and local OS integrations.
- `public/` — Static assets and icons.

## 💻 Development Setup

To get started with development, you'll need the following prerequisites installed:
1. **Node.js** (v18 or newer)
2. **Rust** and Cargo (for Tauri backend)
3. **Android Studio** (if you plan to build for Android)
4. **Ollama** (for local AI model processing)

### Clone & Install
```bash
git clone https://github.com/Omar-Khaled-57/StoryBox2/
cd StoryBox
npm install
```

## 🎮 How to Run the App

For standard desktop development (Windows/macOS/Linux), start the Vite plus Tauri rust dev server:
```bash
npm run tauri dev
```

For Android development:
```bash
npm run tauri android dev
```

## 📦 Build Instructions

When you're ready to compile the app for distribution:

**Build for Windows (Desktop):**
```bash
npm run tauri build
```

**Build for Android (APK):**
```bash
npm run tauri android build --apk

