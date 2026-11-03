# Comeback

A calm, game-like routine recovery prototype built with React, TypeScript, Vite, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

Vite prints a local URL to open in your browser. Create a production build with `npm run build`, or preview it with `npm run preview`.

## Prototype screens

- Welcome page and two-step onboarding for a comeback goal, daily study target, and starting focus length.
- A personalized dashboard with level, XP progress, daily quests, weekly focus time, and a forgiving streak reset.
- Focus room with 5, 15, and 25 minute timer presets, an optional task label, and a session-complete state.
- Journey page with weekly focus history, level milestones, and achievements.
- Responsive desktop sidebar and mobile bottom navigation.

## Deploy to Vercel

The project is ready to import from GitHub. Create a Vercel project from `abhi-shek77/comeback`; Vercel uses `npm run build` and publishes `dist/` as configured in [`vercel.json`](vercel.json).

Before the first deployment, add these project environment variables in Vercel for **Production** (and **Preview** if you plan to test previews):

- `VITE_SUPABASE_URL` — the Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the browser-safe publishable key. Do not use a Supabase secret/service-role key.

After Vercel assigns the production domain, set Supabase **Authentication → URL Configuration** Site URL to that domain and add the production domain to allowed redirect URLs. Keep `http://localhost:5173/**` for local development. Redeploy after changing Vercel environment variables.

The app works in local demo mode and saves progress in this browser. Optional Supabase email-link sign-in syncs progress and study spaces across devices.

## Enable Supabase sync

1. Create a Supabase project and open its SQL Editor.
2. Run the SQL in the numbered files under `supabase/migrations/`, in timestamp order. They create the user data tables, enable row-level security, and limit each account to its own rows.
3. Copy `.env.example` to `.env.local`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project API settings. Only use the publishable key in the browser; never put a service-role/secret key in a `VITE_` variable.
4. In Supabase Auth URL configuration, add your local app URL (usually `http://localhost:5173`) to the allowed redirect URLs, and configure email sign-in for the project.
5. Restart the dev server with `npm run dev`. The **Sign in** button will send a one-time link to your email. On first sign-in, current local progress is copied into the account.

Without those project settings, the app stays in local demo mode. Database migrations are not applied automatically by the frontend.

For the next design iteration, use the [first-use student test](docs/first-use-test.md) to gather feedback from a few students.
