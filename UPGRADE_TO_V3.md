# BULL FX v3 — Upgrade Guide (Subscription / Credit System)

This version adds the AIMS affiliate gating, monthly credit system, admin panel, and moves AI calls to a secure backend.

## What changed

- 🔒 **Anthropic API key** is no longer in the browser — moved to Supabase Edge Functions
- 🪙 **Credit system** — users earn 1 GB per lot traded (max 5/mo), spend MB per AI call
- 📊 **Admin panel** at top-right shield icon — CSV import, user management
- 🆔 **MT5 login** — users sign up with email + MT5 number, can log in with either
- ✅ **Eligibility gating** — AI/Forecast tabs locked until deposit verified + 1 lot traded

## Migration steps

### 1. Update the database

In Supabase SQL Editor, run the entire NEW `supabase/schema.sql`. It uses `if not exists` and `drop policy if exists` so it's safe to re-run.

**Then make yourself an admin:**
```sql
update profiles set is_admin = true where email = 'YOUR_EMAIL_HERE';
```

### 2. Install Supabase CLI (if you haven't)

```bash
brew install supabase/tap/supabase
supabase login
```

### 3. Link your project

```bash
cd ~/Downloads/fx-journal
supabase link --project-ref YOUR_PROJECT_REF
```
(Find your project ref in Supabase Dashboard → Settings → General → Reference ID)

### 4. Set Edge Function secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 5. Deploy the Edge Functions

```bash
supabase functions deploy ai-insights
supabase functions deploy forecast
supabase functions deploy import-csv
```

### 6. Remove the old browser API key

Open `.env.local` and **delete** the `NEXT_PUBLIC_ANTHROPIC_API_KEY` line. It's no longer needed (and was insecure anyway).

### 7. Reinstall + run

```bash
npm install
npm run dev
```

Your existing trades will still be there. You'll need to:
1. Sign in
2. Go to Admin Panel (shield icon, top right)
3. Upload your AIMS CSV
4. Verify your own deposit ✓
5. AI features unlock

## How the system works

**For your users:**
1. They sign up via your AIMS affiliate link
2. They register on BULL FX with email + MT5 number
3. You verify their $1k deposit in admin panel
4. Each week (or daily), you upload AIMS CSV
5. System auto-calculates their lots-this-month, credits 1 GB per lot
6. They use MB on AI Insights (4 MB) and Forecasts (20 MB)
7. Credits reset monthly, capped at 5 GB

**For you (admin):**
- Upload CSVs whenever AIMS provides new data
- Verify deposits manually as users sign up
- Optionally grant bonus MB to specific users
- See everyone's status in Users tab

## Native app build (still works)

After all the above is set up and tested in browser, build the desktop app:
```bash
npm run tauri build
```
The native app uses the same Supabase + Edge Functions, so it just works.
