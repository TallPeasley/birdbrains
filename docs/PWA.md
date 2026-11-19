# BirdBrains as an installable app (PWA)

The site installs to a phone's home screen and opens full screen like an app. There is no
app store step; the App Store / Play Store wrapper (Capacitor) is planned after launch.

## How students install it

- **Android (Chrome, Edge, Samsung Internet):** a "Get the BirdBrains app" strip appears under
  the top bar with an **Install** button. Chrome's menu > *Install app* works too.
- **iPhone / iPad (Safari, and Chrome on iOS 16.4+):** the same strip shows the steps, because
  Apple has no install button for websites: tap **Share**, then **Add to Home Screen**.
- **Desktop Chrome/Edge:** install icon in the address bar, or the strip's Install button.

Dismissing the strip hides it for 14 days on that device. It never shows inside the installed app.
Long-pressing the installed icon on Android offers **Upload work** and **Parent dashboard** shortcuts.

## What is in the repo

| File | Does |
|---|---|
| `app/manifest.ts` | Builds `/manifest.webmanifest` (name, colours, icons, shortcuts). |
| `app/layout.tsx` | iPhone tags (`apple-touch-icon`, standalone mode), theme colour, favicons. |
| `components/PwaSetup.tsx` | Registers the service worker, shows the install strip, opens Upload Work for the `?capture=1` shortcut. |
| `public/sw.js` | Service worker. Caches only this site's own files; API, Firebase and Stripe calls always go to the network. |
| `public/offline.html` | Shown when offline on a page the device has not opened before. |
| `public/icons/` | App icons. Regenerate with `node tools/make_pwa_icons.js` after a logo change. |
| `firebase.json` | `sw.js` and the manifest are served with `no-cache` so updates reach phones on the next open. |

## Camera

The upload sheet shows a **Take photo** button on phones and tablets. It opens the rear camera
directly (`capture="environment"`), in Safari, Chrome and the installed app. The dashed box still
opens the photo library / files for several pages at once.

## Updating

Deploys work as before (auto-deploy from `main`, or `./deploy-web.sh`). Pages are fetched from the
network first, so a new deploy shows on the next open. If a deploy ever leaves phones stuck on old
files, bump `VERSION` in `public/sw.js`; every device drops its old cache on the next visit.

## Known limits

- iPhone push notifications from a home-screen web app need iOS 16.4+ and a separate opt-in;
  not built. Grading results show when the student opens the app.
- Grading needs a connection. Offline, the app opens to pages already viewed, or the offline screen.
