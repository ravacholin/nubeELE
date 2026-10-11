# NubeELE

React/Vite frontend with an Express API for Spanish vocabulary activities.

## Development

Use Node.js 22.12 or newer and Bun with support for the committed lockfile:

```sh
bun install --frozen-lockfile
npm run dev
```

The Express server serves the frontend and `/api/*` on port 3000.
`npm run preview` serves only the static build and does not run the API.

## Word gestures

Tap or click a word to open its card. Hold it for half a second to select or
deselect it for retention or regeneration; use Shift + Enter or Shift + Space
with a keyboard. Dragging cancels selection. The eraser clears the board, keeps
saved words, and allows restoring the cleared words.

## Validation

```sh
npm run lint
npm run build
node --import tsx --test tests/*.test.ts
```

## Vercel

Deploy the repository root. `vercel.json` builds the Vite frontend into `dist`;
`api/[...path].ts` exposes the existing Express routes as a Vercel function.
Deploy both the frontend and the function, rather than uploading `dist` alone.
After deploying, verify that `POST /api/generate-cloud` with JSON
`{"prompt":"verduras"}` returns HTTP 200 and a JSON vocabulary cloud.

The curated vocabulary workflow works without credentials. For live Gemini
generation and neural speech, configure `GEMINI_API_KEY` in Vercel's environment
variables and redeploy. Keep keys out of source control and frontend build
variables. Do not copy the placeholder credentials from `.env.example`.

## PWA

The production build includes a web manifest, install icons and a service worker.
Open the app over HTTPS (or localhost) and use **Instalar NubeELE** when the browser
offers installation. On iPhone/iPad, use Safari's **Compartir → Añadir a pantalla de
inicio**. Installed apps open in a standalone window.

After an online visit prepares the offline cache, the last cloud, completed word
cards and saved words remain available without a connection. Generating or renewing
vocabulary and completing pending cards require a connection. Updates show an
**Actualizar** action and wait until the user chooses to reload. API requests and
API keys are never stored in the service worker cache.

The service worker is disabled during development. To verify installation and
offline reloads locally, run `npm run build` followed by
`NODE_ENV=production npm start`.
