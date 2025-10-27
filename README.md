# Turbo Next.js Mock Exam (No DB)

Simple Turborepo with a single Next.js app that:

- Loads questions from local JSON (`/public/data/questions.json`)
- Shuffles questions and options client‑side
- Lets user select answers and see instant scoring
- Includes very simple "login" using `/public/data/login.json` (checked on client and stored in `localStorage`)

## Run

```bash
# at repo root
npm install
npm run dev
# then open the app workspace directly:
npm run dev -w apps/exam
# App at http://localhost:3000
```

> You can also run just the app:
```bash
cd apps/exam
npm install
npm run dev
```

## JSON Files

- `public/data/questions.json` — your full question bank
- `public/data/login.json` — demo user(s)
- `public/data/exam.json` — exam metadata
- `public/data/attempt.json` — schema example (the app saves attempts to browser `localStorage`, not this file)

No database. Everything is static files + client state.
