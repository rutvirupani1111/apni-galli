# Apni Galli (अपनी गली)

A small illustrated street for a small business. Each building on a lane does a real job:

- **Haveli Gate**: a rolling shutter that shows the true open or closed status from the owner's hours, holidays and timezone. When the shop is closed, its letterbox takes an enquiry chit.
- **Shopfront Window**: a rack of magazine covers, one page per item, with Sold and Booked stamps.
- **Chai Counter**: bookings that cannot clash. A Postgres exclusion constraint guards every seat. Holds last 10 minutes, and buffers, seats, minimum notice, .ics files, reschedule and cancel are all supported.
- **Menu Board**: orders with a daily stock cap per item and pickup day, plus a UPI intent link and QR. Money goes straight to the owner.
- **Postbox Corner**: a newsletter with double opt-in, a consent record and one-click unsubscribe.
- **Noticeboard**: links with click counts, scheduled notes and Linktree import.
- **Workshop Loft** and **Rooftop**: the story, contact details, and a map that loads only after a tap.

Everything a visitor sends lands in the **Galla**, the owner's front desk. It has keyboard shortcuts, optimistic actions with undo, an IndexedDB outbox, ETag polling, swipe actions and CSV export.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 with CSS tokens, Neon Postgres (PGlite locally), zod, and `next/og` share images.
There are no animation libraries on visitor pages: motion uses CSS spring curves (`linear()`) and the Web Animations API.

## Data and security

- Raw SQL migrations live in `lib/migrations.ts` and are applied on first connection.
- Every table enables and forces row level security in the same migration that creates it.
- Each transaction runs `SET LOCAL ROLE galli_app` with `app.owner_id` and `app.role`, so the policies apply.
- Owners sign in with email and password. Passwords are hashed with scrypt, and sessions use an httpOnly cookie.
- Public writes go through zod validation, a honeypot field and a Postgres token-bucket rate limit. Turnstile is checked when its keys are set.
- `/api/cron/tick` handles expired holds, demo cleanup, reminders, the 08:00 digest and the postcard drip. Vercel's daily cron calls it with `CRON_SECRET`.

## Environment

See `.env.example`. With no `DATABASE_URL`, the app runs on a local PGlite folder.

## Known limits (honest)

- **Email:** without `RESEND_API_KEY`, every email is written to `outbox_emails` and shown to the owner in Settings > Daak. Nothing claims it was delivered.
- **Cron:** Vercel Hobby cron runs once a day, so reminders are only as accurate as the tick frequency. To make them accurate to about 10 minutes, point a free external scheduler at `/api/cron/tick`.
- **Hosting:** Vercel Hobby is for non-commercial use. Before a real seller takes orders, move to Vercel Pro (or Cloudflare). This is a launch blocker.
