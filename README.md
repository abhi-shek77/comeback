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

The prototype saves onboarding choices, quests, XP, streak, and focus history in this browser's local storage. Daily quest completion resets on a new day; progress remains on this device and is not synced across browsers. There is no account, backend, or external service.

For the next design iteration, use the [first-use student test](docs/first-use-test.md) to gather feedback from a few students.
