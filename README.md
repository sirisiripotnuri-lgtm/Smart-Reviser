# 🧠 Memory Assistant — With Real Database

> A personal spaced repetition system that helps you capture, review, and truly retain what you learn — with voice notes, smart scheduling, and daily habit tracking.

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Screenshots](#screenshots)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Overview

Memory Assistant is a smart learning application built on the **Forgetting Curve** principle by Hermann Ebbinghaus. Instead of letting knowledge fade, it automatically reschedules your notes for review at the perfect moment — 1 day, 3 days, 7 days, and 15 days after you first learned something.

It combines the power of:
- 📝 A **notes app** — quickly capture anything you learn
- 🔁 A **spaced repetition engine** — schedules reviews based on your memory
- 📅 A **habit tracker** — keeps your daily learning streak alive
- 🎙️ A **voice recorder** — attach audio explanations to your notes
- 🔔 A **reminder system** — nudges you to review at your chosen time

---

## Features

### ✦ Note Capture
- Type or paste any newly learned content
- Add an optional title and tags for easy searching
- Each note is timestamped and queued for review automatically

### 🎙 Voice Notes
- Record your own verbal explanation while adding a note
- Voice is stored with the note and plays back during review
- Especially powerful for students — hear yourself explain it in your own words

### 🔁 Spaced Repetition System
- Reviews auto-scheduled at: **+1 day → +3 days → +7 days → +15 days → Mastered**
- After each review, answer: **"Remembered"** or **"Forgot"**
  - Remembered → interval increases to next level
  - Forgot → resets to Day 1
- Notes marked **Mastered** are retired from the review queue

### 📋 Sidebar Notes List
- All note titles listed in the left sidebar at all times
- Click any title to open the full note in a modal overlay
- Search and color-coded status dots (🟢 mastered · 🟡 due · 🔴 overdue · 🔵 upcoming)
- Voice note indicator 🎙 shown next to notes that have audio

### 📅 Calendar View
- Monthly calendar on the Dashboard
- Color-coded daily dots:
  - 🟢 **Green** — you added notes that day
  - 🟡 **Yellow** — a review is scheduled
  - 🔴 **Red** — you missed a scheduled review

### 📋 Daily Task System
- Dashboard shows two daily goals:
  1. **Learn something new** — add at least one note today
  2. **Review pending** — complete all due flashcards
- Day streak counter motivates consistent learning

### ✦ Leisure Mode ("I'm Free Now")
- One-click button that instantly shows all pending reviews
- Great for spontaneous study sessions

### 🔔 Smart Reminders (Alarms)
- Set custom times for review reminders (e.g., 7:00 PM)
- Choose which days of the week to receive reminders
- Toggle individual alarms on/off
- Uses browser Notifications API

### 🔐 User Authentication
- Register and sign in with username + password
- Each user's notes are stored separately
- Session is remembered between visits (no repeated logins)
- Data stored locally on your device — fully private

### 📊 Progress Tracker
- Stats: Total notes, mastered count, total reviews, accuracy %
- 7-day activity bar chart (added vs reviewed)
- Level distribution across all 4 spaced repetition levels
- Top topics by tag frequency
- Full notes table with status badges

### 🗑️ Delete Notes
- Delete button on every note row with inline confirmation
- Available in Dashboard, Review picker, Progress table, and Note modal
- Prevents accidental deletion with a Yes / No confirmation step

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 (JSX) |
| Charts | Recharts |
| Build Tool | Vite |
| Styling | Inline CSS with CSS variables |
| Storage | `window.storage` (browser persistent key-value) |
| Audio | Web MediaRecorder API |
| Notifications | Web Notifications API |
| Auth | Client-side hashing (simpleHash) |

> **Note:** This is a fully frontend app — no backend server required. All data is stored in your browser's local storage.

---

## ▶️ First Time Setup (do once)

### 1. Install Node.js
Download from https://nodejs.org → choose **LTS** version

### 2. Open this folder in VS Code
```
File → Open Folder → select "memory-app" folder
```

### 3. Open Terminal in VS Code
```
Terminal → New Terminal   (or Ctrl + `)
```

### 4. Install all dependencies
```bash
npm install
```

---

## 🚀 Running the App (Every Time)

You need **2 terminals** running at the same time:

### Terminal 1 — Start the Database Server
```bash
npm run server
```
You will see:
```
🧠 Memory Assistant Database Server
📦 Database file: db.json
🚀 Running at: http://localhost:4000
```

### Terminal 2 — Start the React App
```bash
npm start
```
Opens at → **http://localhost:3000**

---

## ⚡ One Command (Start Both Together)
```bash
npm run dev
```
This starts both server + app at once automatically.

---

## 📱 Open on Phone (Same WiFi)

1. Find your PC's IP address:
   - **Windows**: Open Command Prompt → type `ipconfig` → look for IPv4 Address (e.g. 192.168.1.5)
   - **Mac**: System Settings → WiFi → Details → IP Address

2. On your phone browser go to:
   ```
   http://192.168.1.5:3000
   ```

3. Add to Home Screen:
   - **iPhone**: Safari → Share → "Add to Home Screen"
   - **Android**: Chrome → 3-dot menu → "Add to Home Screen"

---

## Project Structure

```
memory-assistant/
├── db.json          ← YOUR DATABASE (all users + notes saved here)
├── server.js        ← Database server (reads/writes db.json)
├── src/
│   └── App.jsx              ← Entire application (single file)
├── public/
│   └── vite.svg
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

### Key Components (inside App.jsx)

| Component | Purpose |
|---|---|
| `AuthScreen` | Login and registration UI |
| `Sidebar` | Navigation + scrollable notes list |
| `NoteModal` | Full note viewer (opens on title click) |
| `VoiceRecorder` | Record and preview voice notes |
| `VoicePlayback` | Play voice notes during review |
| `ReviewCard` | Flashcard UI for spaced repetition |
| `NotePicker` | Select notes for practice sessions |
| `MiniCalendar` | Color-coded monthly calendar |
| `DashboardView` | Main home screen with stats |
| `AddNoteView` | Note creation form |
| `ReviewView` | Due reviews + Practice mode |
| `ProgressView` | Charts, stats, and all notes table |
| `AlarmView` | Reminder management |

---

## How It Works

### The Spaced Repetition Algorithm

When you add a note, it enters **Level 1** and is scheduled for review in 1 day.

```
Level 1 → Review in  1 day
Level 2 → Review in  3 days
Level 3 → Review in  7 days
Level 4 → Review in 15 days
Level 5 → MASTERED  (retired from queue)
```

During review, you see the title first, then reveal the content. After reading:

- Press **✓ Remembered** → note advances to the next level
- Press **✗ Forgot** → note resets to Level 1

This mirrors how the human brain actually consolidates long-term memory.

### Voice Notes Flow

```
Add Note → Record Voice → Save together
                   ↓
           During Review → "Reveal Content" → Voice plays automatically
                   ↓
           Note Modal   → Play anytime with ▶ button
```
## 💾 How the Database Works

| Action | What happens |
|--------|-------------|
| Register | Account saved to `db.json` permanently |
| Login | Checks `db.json` — if user exists, signs in |
| Add Note | Saved to `db.json` under your username |
| Wrong username | "No account found. Please register." |
| Wrong password | "Incorrect password." |
| Refresh page | Auto-logged in (session in browser) |
| Sign out | Session cleared, account stays in `db.json` |

### db.json looks like this:
```json
{
  "users": {
    "john": {
      "username": "john",
      "name": "John Smith",
      "hash": "abc123",
      "created": "2024-01-15T10:00:00.000Z"
    }
  },
  "notes": {
    "john": [
      { "id": "abc", "title": "My Note", "content": "..." }
    ]
  }
}
```

---

## Future Improvements

- [ ] **Flask + SQLite backend** — move storage to a real database
- [ ] **Export notes** — download as PDF or CSV
- [ ] **Import notes** — paste from Notion, Google Docs, Markdown
- [ ] **Rich text editor** — bold, bullets, code blocks in note content
- [ ] **Mobile app** — React Native version
- [ ] **AI-generated quiz questions** — auto-create questions from your notes
- [ ] **Shared decks** — share a set of notes with friends or classmates
- [ ] **Offline PWA** — install as an app and use without internet
- [ ] **Email reminders** — send a daily digest via email
- [ ] **Dark / light theme toggle**

---

## Tips for Best Results

1. **Add notes immediately** after learning — don't wait until the end of the day
2. **Be detailed in your content** — write as if explaining to your past self
3. **Use voice notes** — speaking forces deeper processing than reading
4. **Review every day** — even 5 minutes keeps your streak alive
5. **Don't skip Forgot** — honest tracking makes the algorithm work better
6. **Use tags** — helps you spot which topics need more attention in Progress

---

## ❓ Troubleshooting

| Problem | Fix |
|---------|-----|
| "Server Not Running" error | Run `npm run server` in a terminal first |
| `npm` not found | Install Node.js from nodejs.org, restart VS Code |
| Port 3000 in use | Press Y when asked to use 3001 |
| Port 4000 in use | Change `PORT = 4000` in server.js to 4001, and `API = "http://localhost:4001"` in App.jsx |
| Can't connect on phone | Make sure both devices on same WiFi |