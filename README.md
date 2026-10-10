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

For a local production server, run `npm run build` followed by
`NODE_ENV=production npm start`.
