# SlimTucci Workout Diary

A personal workout diary PWA for Alexander Tucci (SlimTucci). Plain HTML/CSS/JS with no build step, backend, or accounts. All data stays on the phone in localStorage.

## Files
- `index.html`, `styles.css`, `app.js`: the app
- `manifest.webmanifest`, `icons/`: home-screen install
- `sw.js`: offline cache. **Bump `VERSION` in sw.js on every deploy** so phones pick up the update.
- `tests/e2e_test.py`: Playwright test at 390x844
- `screenshots/`: phone screenshots

## Weeks
Weeks run **Sunday → Saturday**. Week 1 is the Sun–Sat week that contains the program start date (set under More). Labels look like `Week 3 · Oct 4–10`.

## Run locally
    python3 -m http.server 8765        # in this folder, then open http://localhost:8765
    python3 tests/e2e_test.py          # in another shell (needs: pip install playwright && python3 -m playwright install chromium)

## Deploy (any static HTTPS host)
Upload this folder as-is. `tests/`, `screenshots/` and `README.md` are optional.
- GitHub Pages: push to a repo, then Settings → Pages → deploy from the branch root (`.nojekyll` is included).
- Netlify: `npx netlify-cli deploy --prod --dir .`
- Cloudflare Pages: `npx wrangler pages deploy . --project-name slimtucci-diary`

## Backups
Go to More → Export JSON to download `slimtucci-diary-YYYY-MM-DD.json`. Use Import JSON to replace this phone's data with a backup.
