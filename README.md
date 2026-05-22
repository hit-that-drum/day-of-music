# Day of Music

React web app for turning music release info into a weekly calendar image.

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

## Notes

The current PNG export is client-side through `html-to-image`. For production share links, add a server-side image route with `next/og` `ImageResponse`.

Remote album artwork can fail browser-side PNG export when the image host blocks CORS. Cache or proxy album covers through your own route or Supabase Storage before exporting final images.

The `/api/music/search` route is ready for Spotify Bearer tokens once PKCE auth is connected.

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
