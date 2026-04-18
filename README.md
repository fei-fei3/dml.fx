# FX Journal — Cross-Platform Trading Assistant

Native desktop apps for **Mac** and **Windows** with cloud sync via Supabase. Built with Next.js + Tauri.

## What you get

- ☁️ **Cloud sync** across all your devices (Supabase)
- 🔐 **Email/password auth** — your trades stay private
- 🖥️ **Native Mac app** (.dmg / .app)
- 🪟 **Native Windows app** (.exe / .msi) — built via GitHub Actions
- 🌐 **Web app** that runs anywhere (bonus — can deploy to Vercel)
- 📊 Full analytics, AI insights, live forecasts (same as the Claude artifact)

> **iOS opted out for now.** Easy to add later via Capacitor — just ask.

---

## Setup (one-time, ~30 min)

### Step 1 — Install prerequisites on your Mac

```bash
# Node.js (if you don't have it)
brew install node

# Rust (required for Tauri)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Tauri prerequisites
xcode-select --install
```

### Step 2 — Set up Supabase (free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (pick any region close to you)
3. Wait ~2 min for it to provision
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
5. Go to **SQL Editor** → New query → paste the contents of `supabase/schema.sql` → Run

### Step 3 — Configure the app

```bash
cd fx-journal
npm install
cp .env.example .env.local
```

Open `.env.local` and paste your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Step 4 — Run the web version (verify everything works)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, log a trade. If it persists after refresh — sync is working.

---

## Building native apps

### Mac app (build locally)

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/dmg/FX Journal_1.0.0_aarch64.dmg`

Double-click to install. Drag to Applications.

### Windows app (build via GitHub Actions — no Windows machine needed)

1. Push this project to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create fx-journal --private --source=. --push
   ```
2. Add Supabase secrets to your repo: **Settings → Secrets → Actions → New repository secret**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Go to **Actions** tab → run **"Build Windows App"**
4. When it finishes (~10 min), download the `.msi` from the workflow artifacts
5. Transfer to your Windows PC and install

The workflow also builds Mac in parallel if you want a clean build.

---

## File structure

```
fx-journal/
├── src/
│   ├── app/              # Next.js pages
│   ├── components/       # React components (FXJournal, charts, etc)
│   └── lib/              # Supabase client, helpers
├── supabase/
│   └── schema.sql        # Database schema — run this in Supabase
├── src-tauri/            # Tauri config for native builds
├── .github/workflows/    # GitHub Actions for Windows builds
└── .env.local            # Your Supabase credentials (gitignored)
```

---

## Troubleshooting

**"Supabase client missing env vars"** → check `.env.local` exists and has both keys, then restart `npm run dev`

**Tauri build fails on Mac** → run `xcode-select --install` and `rustup update`

**Windows GitHub Action fails** → check that you added both secrets in repo settings

**Trades not syncing** → check Supabase dashboard → Table Editor → `trades` table → make sure RLS policies from `schema.sql` ran

---

## Adding iOS later

When you're ready, install Capacitor:
```bash
npm install @capacitor/core @capacitor/ios
npx cap init
npx cap add ios
npx cap sync
npx cap open ios
```
You'll need an Apple Developer account ($99/yr) to install on a real iPhone.
