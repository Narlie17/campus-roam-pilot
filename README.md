# Campus Roam Pilot Run — website

Your own HTTPS link, free on GitHub Pages: `https://YOUR-USERNAME.github.io/campus-roam-pilot/`.
- Students open the link on their phone and tap **Add to Home Screen**. It then opens like an app, with its own icon, and works offline.
- Campus data refreshes on its own **every 6 hours**: events, Eagle Engage orgs and events, library hours, college news and buildings.
- Each time a student opens the app it ranks everything against their interests, major, follows, campus and the gaps between their classes.

## Put it online (one time, ~10 minutes)

1. Sign in at github.com (free account) → **+** → **New repository**. Name it `campus-roam-pilot`, set it to **Public**, and click **Create**.
2. Click **uploading an existing file**. Drag in **everything inside this folder** (not the folder itself), then click **Commit changes**.
   - The web uploader skips the hidden `.github` folder. Add the two workflow files by hand: **Add file → Create new file**, name it `.github/workflows/refresh-data.yml`, paste in that file's contents, and commit. Repeat for `.github/workflows/check-data.yml`.
   - On a Mac, press **Cmd + Shift + .** in Finder to show hidden folders.
3. **Settings → Pages:** set Source to *Deploy from a branch*, Branch to `main` and `/ (root)`, then click **Save**. Your link appears at the top within about a minute.
4. **Settings → Actions → General → Workflow permissions:** choose **Read and write permissions** and click **Save**. Without this, the refresh can't save new data.
5. **Actions → Refresh campus data → Run workflow.** This loads today's events right away. After that it runs every 6 hours by itself.
6. Put your link in `config.js` → `studentUrl` (pencil icon → edit → Commit). Also add a `contactEmail` you own.

Send students the link. Admin console: `YOUR-LINK/admin.html`. Leave it out of student messages.

## What updates by itself

| What | How often |
|---|---|
| University calendar + Eagle Engage events, org directory, library hours, college news, buildings | Every 6 hours (GitHub Action → `data/` → `data.js`) |
| The app on each phone | Fetches the newest data every time it's opened. If it has been in the background 3+ hours or the day changes, it reloads itself. With no signal it uses the last good copy. |
| "🆕 New for you since your last visit", "Happening today", "Don't miss this week", the gap plan | Recalculated on every open from the student's interests, major, follows and classes |
| Broken links, stale data, next term's dates | Checked every Monday. You get a GitHub issue named "ROAM data check" if something needs you. |

Each semester, add the next term's dates to `data/campus.json` (the Monday check will remind you).

## Usage data (optional, recommended for the pilot)

Without Supabase, every feature works, but each student's data stays on their phone and the admin console is locked. To see sign-ups, usage, check-ins and feedback:
1. Follow the Supabase steps in the V14 README.
2. Paste the Project URL and anon key into `config.js`.
3. In Supabase → Authentication → URL Configuration, add your GitHub Pages link as Site URL and Redirect URL.

## Files
- `index.html`, `student.js`, `shared.js`, `styles.css`, `config.js`: the student app
- `data.js`: generated each refresh from `data/`
- `admin.html`, `admin.js`: the admin console
- `manifest.webmanifest`, `icons/`, `sw.js`: home-screen install and offline support
- `scripts/refresh-data.mjs`: pulls the public data
- `scripts/build-data.mjs`: builds `data.js`
- `scripts/check-data.mjs`: the weekly checks
- `.github/workflows/`: the schedules
- `schema.sql`: Supabase database
- `PILOT_PRIVACY_NOTICE_TEMPLATE.md`: fill in and publish before recruiting

ROAM is an independent student project, not an official Georgia Southern University service. It uses only publicly published university information.
