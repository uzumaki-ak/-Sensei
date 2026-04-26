# Full Stack AI Career Coach with Next JS, Neon DB, Tailwind, Prisma, Inngest, Shadcn UI Tutorial 🔥🔥
## https://youtu.be/UbXpRv5ApKA

![sensai](https://github.com/user-attachments/assets/eee79242-4056-4d19-b655-2873788979e1)

### Make sure to create a `.env` file with following variables -

```
DATABASE_URL=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

GEMINI_API_KEY=

# Optional: Gmail automation
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=

# Optional: API fallbacks for nightly hunt (scraper-first then APIs)
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
RAPIDAPI_KEY=
RAPIDAPI_JSEARCH_HOST=jsearch.p.rapidapi.com
INDIANAPI_API_KEY=

# Optional: hunt tuning for local testing
HUNT_MAX_QUERIES_PER_USER=3
HUNT_MAX_URLS_PER_USER=4
HUNT_DISCOVERY_TIMEOUT_MS=20000
HUNT_SCRAPE_TIMEOUT_MS=30000
HUNT_MIN_CREATED_BEFORE_FALLBACK=2
HUNT_MAX_FALLBACK_PER_QUERY=5
JOB_SOURCE_TIMEOUT_MS=12000

# Optional: timeline retention window in days (1-30), default 2
EVENT_TIMELINE_RETENTION_DAYS=2
```

## Personal DB Chatbot

Route: `/advanced/personal-chatbot`

What it does:
- Answers from the signed-in user's own DB context (profile, resumes, jobs, and tool histories).
- Includes a built-in feature handbook so recruiters can ask: what each feature does, use cases, and test steps.
- Shows assistant citations (`[S1]`, `[S2]`) for traceability.

Suggested demo questions:
- `What does each advanced feature do and how should I test it?`
- `Give me a 3-minute recruiter walkthrough script for this platform.`
- `Based on my data, which project story is best for this selected role?`

## Docker Deploy

The repo includes:
- `Dockerfile` (Next.js standalone production image + Prisma migrate on startup)
- `docker-compose.yml` (app + postgres)

### 1) Build and run

```bash
docker compose up --build
```

App:
- http://localhost:3000

Postgres (compose default):
- host: `localhost`
- port: `5432`
- user: `postgres`
- password: `postgres`
- db: `ai_career_coach`

### 2) Environment

Add your required env vars in `.env` (Clerk + AI provider keys at minimum).  
If you want to use the compose postgres, set:

```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/ai_career_coach?schema=public
```
