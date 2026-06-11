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
- Supabase client, PostgreSQL, and Drizzle ORM
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

Supabase and database values are only required once you start saving boards or running Drizzle commands.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run db:generate
npm run db:push
npm run db:studio
```

## Docker

Run the whole stack (web app + Postgres) with Docker:

```bash
docker compose up --build -d
# one-time: create tables in the container database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dayofmusic npm run db:push
```

Then open [http://localhost:3000](http://localhost:3000). Without Supabase keys the app
runs in shared-journal mode (no sign-in) persisting to the bundled Postgres. To enable
auth, put `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in a `.env` file
next to `docker-compose.yml` and rebuild — they are inlined at build time.

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
