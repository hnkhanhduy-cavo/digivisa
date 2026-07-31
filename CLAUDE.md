# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

DigiVisa is a visa-processing / airport fast-track / private-pickup booking site: a React SPA backed by Cloudflare Pages Functions for 9Pay payment processing, with Firebase (Auth + Firestore) as the data layer.

## Commands

- `npm install` — install dependencies (npm/package-lock.json; no yarn/pnpm)
- `npm run dev` — runs `tsx server.ts`, an Express server wrapping Vite middleware, on port 3000
- `npm run build` — `vite build` then bundles `server.ts` with esbuild into `dist/server.cjs`
- `npm start` — `node dist/server.cjs`, serves the built `dist/` in production mode
- `npm run lint` — `tsc --noEmit` (type-check only; there is no ESLint/Prettier/Biome configured)
- There is no test suite in this repo (no jest/vitest/playwright, no `*.test.*` files) and no CI (no `.github/workflows`).

## Architecture

- **`src/App.tsx`** — root SPA shell. Owns language (`EN`/`VI`), auth user, and `activeService` (`visa | fasttrack | pickup`). Navigation is conditional rendering inside `AnimatePresence`. A hidden route, hash `#/verynoice`, opens the admin login modal.
- **`functions/api/`** — Cloudflare Pages Functions (file-based routing; no `wrangler.toml`). Two endpoints:
  - `9pay-create-payment.ts` — signs and posts to 9Pay's create-payment REST API, returns `{ paymentUrl, orderId }`.
  - `9pay-webhook.ts` — `onRequestPost` (9Pay IPN receiver) and `onRequestGet` (status-poll endpoint used by the frontend).
- **Payment flow (9Pay redirect + Inquire):** form submit → order saved with `amountVnd` + `Pending` → `POST /api/9pay-create-payment` builds signed portal URL → browser redirects to 9Pay. **Source of truth = Inquire** via `GET/POST /api/9pay-verify?orderId=…` (3-part GET signature). Paid only when inquire `status === 5` AND amount matches Firestore. Return URL is UX-only (`App.tsx` shows “Đang xác nhận…” then calls verify) — never trust `?payment=success` / `result` / `checksum` query params. Tracker/OMS re-inquire unpaid orders from the last 24h (debounced); optional batch `POST /api/9pay-sync-unpaid`. `9pay-webhook` stays IPN-ready (`verifyAndDecode`) but is unused until Merchant View can register `ipn_url`. Helpers: `functions/api/_ninepay.ts`. Test with `npm run dev:pages` (`npm run dev` does not serve `functions/`).
- **Data layer:** Firestore (`orders` collection, single collection, no security-rules file present in repo) is best-effort/secondary; `localStorage` (via `src/utils/storage.ts`'s `safeStorage` wrapper, which falls back to an in-memory object if storage is blocked) is the primary client-side source of truth. Firebase Auth (email/password + email-verification gate) handles customer accounts; there's no server-side session.
- **Cross-cutting utils in `src/utils/`:**
  - `translations.ts` — `EN`/`VI` dictionary; nearly every component takes a `language` prop and indexes into it.
  - `pricing.ts` — fee calculation and a USD→VND lookup table, also duplicated inline in `App.tsx`'s `getConvertedPrice` — check both places when touching pricing.
  - `orderUtils.ts` — splits bundled "combo" (FastTrack + AirportPickup) orders into separate legs for the OMS/tracker views.
  - `firebase.ts`, `ninepay.ts`, `paymentPolling.ts` — Firebase/Firestore access and the payment/data-layer logic described above.
- `src/types.ts` is the single source of domain types (`Order`, `VisaApplication`, `FastTrackBooking`, etc.), imported by nearly every component.
- `digivisaver2/` is a stale duplicate snapshot of the app that predates the 9Pay/Firebase-auth work (missing those files entirely) — not part of the active build; confirm with the user before editing or removing it.

## Known gaps to be aware of

- 9Pay keys live in Cloudflare env (`NINEPAY_*` via `wrangler.toml` / `.dev.vars` / Pages secrets) — never in the client bundle.
- Firestore REST writes from Pages Functions are still unauthenticated; `firestore.rules` blocks clients from forging Paid on create and restricts payment-field updates. Prefer a service account for IPN writes in production.
- "Admin"/staff login (`AdminLoginModal.tsx`) is a client-side hardcoded password check (default `admin123`, plus an always-accepted bypass `verynoice123`) — not a real auth boundary.
- `firebase.json` configures Firebase Hosting for the static `dist/` build, while `functions/api/` depends on Cloudflare Pages Functions — the two deploy targets are inconsistent; confirm which platform is actually live before assuming Cloudflare is authoritative.
