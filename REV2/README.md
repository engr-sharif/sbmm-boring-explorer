# SBMM Boring Explorer REV2

REV2 is a standalone, next-generation version of the SBMM Boring Explorer built without modifying the legacy app files.

## Included improvements

- **Normalized GeoJSON data pipeline** from legacy `data.js` and `boundaries.js`.
- **Data validation checks** for geometry, campaign values, duplicate keys, and numeric fields.
- **Boundary overlays** with labels.
- **Marker clustering** for scalable rendering.
- **Accessible controls** (no inline handlers, keyboard-selectable result rows, labeled controls).
- **Saved views** in `localStorage`.
- **Export tools** for filtered CSV and GeoJSON.
- **Comparison panel** (up to 3 borings).
- **PWA baseline** with service worker caching and web manifest.

## Run

```bash
cd REV2
npm run check
python3 -m http.server 8080
# open http://localhost:8080
```

## Publish so others can open in browser

You have two options:

1. **Local browser only (no publishing needed):**
   - Run a local static server and open `http://localhost:8080`.
2. **Hosted browser access (recommended):**
   - Push to GitHub and enable **GitHub Pages** using the included workflow at
     `.github/workflows/deploy-rev2-pages.yml`.
   - In your GitHub repo settings, set **Pages → Build and deployment → Source = GitHub Actions**.
   - After the workflow succeeds, your REV2 site will be available at your repo's Pages URL.

### Notes for Pages

- The workflow deploys the `REV2/` folder directly as the Pages artifact.
- Any push to `main` that changes `REV2/**` will auto-deploy.

## Notes

- REV2 consumes source records from the legacy repository as input only (read-only pipeline).
- The legacy `index.html` and runtime are untouched.
