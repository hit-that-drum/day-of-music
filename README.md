# Day of Music

React web app for turning music release info into a weekly calendar image.
The repo also contains a sibling **iOS / Android app** under [`mobile/`](./mobile/),
built with Expo + Expo Router. It follows the same data model as the web app.
See [`mobile/README.md`](./mobile/README.md) for dev and TestFlight instructions.

## Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand for editor state
- TanStack Query for server state
- Supabase (auth + Postgres, queried directly via supabase-js with RLS)
- lucide-react icons
- html-to-image PNG export
- Installable PWA support

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment

Copy `.env.example` to `.env.local` and fill in the values you need.

Auth and cross-device journal persistence need a Supabase project: set the two
`NEXT_PUBLIC_SUPABASE_*` values, then run the SQL in
[`supabase/migrations/0001_journal_entries.sql`](./supabase/migrations/0001_journal_entries.sql)
once (Supabase Dashboard → SQL editor). The table is queried directly from the
client with supabase-js; the RLS policies in that file are the authorization layer.

Without Supabase keys the app runs unauthenticated and persists to localStorage.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Docker

```bash
docker compose up --build -d
```

Then open [http://localhost:3000](http://localhost:3000). Supabase keys go in a `.env`
file next to `docker-compose.yml` and require a rebuild when changed — they are
inlined into the client bundle at build time.

## Notes

The current PNG export is client-side through `html-to-image`. For production share links, add a server-side image route with `next/og` `ImageResponse`.

Remote album artwork can fail browser-side PNG export when the image host blocks CORS. Cache or proxy album covers through your own route or Supabase Storage before exporting final images.

The `/api/music/search` route proxies the free [iTunes Search API](https://performance-partners.apple.com/search-api) — no API key or auth required. Catalog IDs are Apple Music IDs, so it can later be swapped for the paid Apple Music API without client changes. Albums added from search are stored locally (localStorage) and overlaid on the static catalog.

## Installable App

This project includes a web app manifest, app icons, mobile metadata, and a production service worker.

To test installability locally:

```bash
npm run build
npm run start
```

Then open [http://localhost:3000](http://localhost:3000).

- Chrome or Edge desktop: use the install button in the address bar, or the in-app Install button when it appears.
- Android Chrome: open the browser menu and choose Install app.
- iPhone Safari: use Share, then Add to Home Screen.
