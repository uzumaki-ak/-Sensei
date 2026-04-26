# Sensei AI Career Coach

A full-stack, multi-tool AI career platform built with **Next.js 16**, **Prisma**, **Clerk**, and **Inngest**.

It combines job discovery, application workflow automation, interview prep, company intelligence, role-specific RAG, multi-agent planning, and personal AI copiloting in one workspace.

## What This Project Includes

- End-to-end job pipeline: discovery -> kanban -> outreach -> interview prep.
- AI-first modules for resume, cover letter, interview simulation, company intel, GitHub gap analysis, and negotiation prep.
- Advanced platform labs: RAG Copilot, Multi-Agent Studio, Prompt Eval Lab, Event Timeline, Personal Chatbot.
- Real-time updates with Pusher and optional Telegram sniper alerts.
- Scheduled automation with Inngest cron jobs.
- PostgreSQL-backed history for all major advanced features.

## Core Feature Map

### Overview

- `Industry Insights` (`/dashboard`)
- `Midnight Job Hunt` (`/jobs/hunt`)
- `Job Kanban` (`/jobs/kanban`)

### AI Tools

- `Build Resume` (`/resume`)
- `Cover Letter` (`/ai-cover-letter`)
- `Interview Prep` (`/interview`)

### Advanced AI

- `Reverse Recruiter` (`/advanced/reverse-recruiter`)
- `GitHub Analyzer` (`/advanced/github-analyzer`)
- `Company Intel` (`/advanced/company-intel`)
- `Cold Email Drip` (`/advanced/drip-campaigns`)
- `Offer Copilot` (`/advanced/offer-copilot`)
- `Interview Simulator` (`/advanced/interview-simulator`)
- `Telegram Sniper` (`/advanced/telegram-sniper`)

### Platform Labs

- `RAG Copilot` (`/advanced/rag-copilot`)
- `Multi-Agent Studio` (`/advanced/multi-agent-studio`)
- `Prompt Eval Lab` (`/advanced/prompt-eval-lab`)
- `Event Timeline` (`/advanced/event-timeline`)
- `Personal Chatbot` (`/advanced/personal-chatbot`)

### Interview Meet Experience

- Meeting entry: `/meet`
- Room runtime: `/meet/[code]`
- Real-time room with transcript, candidate flow, and post-evaluation support.

## Tech Stack

- Frontend: Next.js 16 App Router, React 19, Tailwind CSS, Radix UI, Lucide
- Auth: Clerk
- Database: PostgreSQL + Prisma
- Background Jobs: Inngest
- Real-time: Pusher
- AI Providers:
  - Gemini
  - OpenRouter
  - Groq
  - Euron
  - Provider-order fallback orchestration
- External Integrations:
  - Gmail API OAuth + send/drafts
  - Telegram Bot API
  - Job source APIs (Adzuna, RapidAPI JSearch, Indian API)
- Crawler Runtime:
  - Python + Playwright + stealth layer (for URL discovery and scraping)
- Deployment:
  - Vercel (primary)
  - Docker standalone mode (optional)

## Architecture Overview

1. User authenticates via Clerk.
2. Protected app routes are enforced in `proxy.js`.
3. UI calls Server Actions in `actions/*`.
4. Actions read/write Prisma models in PostgreSQL.
5. AI generation runs through either:
   - Gemini direct modules, or
   - provider fallback orchestration in `lib/ai-fallback.js`.
6. Background workflows (industry insights, nightly hunt) run via Inngest.
7. Realtime events broadcast through Pusher channels.
8. Optional alerting sends Telegram notifications to each user’s stored `telegramChatId`.

## Multi-User Data Model Behavior

- Users never enter internal user IDs manually.
- Identity comes from Clerk (`clerkUserId`).
- Each user’s job data, history, runs, rooms, and chatbot sessions are scoped to their DB row.
- Telegram Sniper is per-user:
  - Server uses one shared `TELEGRAM_BOT_TOKEN`.
  - Each user stores their own `telegramChatId`.
  - Alerts are sent to that specific chat ID only.

## HTTP API Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/gmail/auth` | OAuth callback, exchanges code and stores Gmail tokens |
| `GET` | `/api/inngest` | Inngest dev/cloud handler |
| `POST` | `/api/inngest` | Inngest events webhooks |
| `PUT` | `/api/inngest` | Inngest handler support |
| `GET` | `/api/test/hunt` | End-to-end test pipeline for dynamic hunt + scrape |
| `POST` | `/api/upload` | Upload resume attachment (PDF/DOC/DOCX) |
| `DELETE` | `/api/upload?id=<attachmentId>` | Delete uploaded attachment |

## Server Action Modules

The `actions/` directory is the main application backend surface:

- `jobs.js`
- `dashboard.js`
- `resume.js`, `resume-maker.js`
- `cover-letter.js`
- `interview.js`, `interview-meet.js`, `interview-simulator.js`
- `reverse-recruiter.js`
- `github-analyzer.js`
- `company-intel.js`
- `drip-campaigns.js`
- `offer-copilot.js`
- `telegram-sniper.js`
- `rag-copilot.js`
- `multi-agent-studio.js`
- `prompt-eval-lab.js`
- `event-timeline.js`
- `personal-chatbot.js`
- `user.js`

## Database Models (Prisma)

Primary entities in `prisma/schema.prisma` include:

- `User`, `Assessment`, `Resume`, `CoverLetter`, `IndustryInsight`
- `JobListing`, `JobApplication`, `ResumeAttachment`, `ResumeChat`
- `InterviewHistory`, `InterviewQA`
- Advanced histories:
  - `GithubAnalysisHistory`
  - `ReverseRecruiterHistory`
  - `CompanyIntelHistory`
  - `DripCampaignHistory`
  - `OfferCopilotHistory`
- Interview Meet:
  - `InterviewMeetRoom`
  - `InterviewMeetTurn`
- Platform Labs:
  - `RagKnowledgeChunk`
  - `RagQueryHistory`
  - `MultiAgentRun`
  - `PromptEvalRun`
  - `PersonalChatSession`
  - `PersonalChatMessage`

## Project Structure

```text
.
├─ actions/                    # Server Actions (core backend logic)
├─ app/
│  ├─ (auth)/                  # Auth pages
│  ├─ (main)/                  # Main product app routes
│  │  ├─ advanced/             # Advanced AI + Platform Labs pages
│  │  ├─ jobs/                 # Hunt + Kanban
│  │  ├─ resume/               # Resume builder flows
│  │  ├─ interview/            # Interview prep flows
│  │  └─ dashboard/            # Industry insights
│  ├─ api/                     # Route Handlers
│  ├─ meet/                    # Interview Meet pages
│  ├─ privacy-policy/          # Public compliance page
│  ├─ terms-of-service/        # Public compliance page
│  ├─ support/                 # Public support page
│  └─ data-deletion/           # Public data deletion page
├─ components/                 # Shared UI + layout components
├─ data/                       # Static content/constants
├─ hooks/                      # Client hooks
├─ lib/                        # Infra helpers, AI fallback, integrations
│  ├─ inngest/
│  └─ ...
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ scripts/
│  ├─ crawler/                 # Python Playwright crawler
│  └─ ...
├─ proxy.js                    # Next.js 16 route protection convention
├─ next.config.mjs
├─ Dockerfile
└─ docker-compose.yml
```

## Local Setup

### Prerequisites

- Node.js `20.9+` (Next.js 16 requirement)
- npm `9+`
- PostgreSQL
- Python `3.10+` (for crawler scripts)

### Install

```bash
npm install
```

### Prisma

```bash
npx prisma migrate deploy
npx prisma generate
```

For local schema iteration:

```bash
npx prisma migrate dev
```

### Run Dev Server

```bash
npm run dev
```

### Lint and Build

```bash
npm run lint
npm run build
```

## Python Crawler Setup

The hunt pipeline executes Python scripts under `scripts/crawler/*`.

Install dependencies in your Python environment:

```bash
pip install playwright playwright-stealth
python -m playwright install chromium
```

If crawler discovery yields no URLs, the app falls back to external job APIs when configured.

## Environment Variables

Create `.env` in project root.

### 1) Core App + Auth

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DIRECT_URL` | Optional | Useful for direct DB access in some Prisma setups |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend key |
| `CLERK_SECRET_KEY` | Yes | Clerk backend key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Optional | Usually `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Optional | Usually `/sign-up` |

### 2) AI Providers (Text Generation)

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Used by multiple direct modules and fallback |
| `GOOGLE_GEMINI_API_KEY` | Optional | Alias/override for fallback provider |
| `GOOGLE_GEMINI_BASE_URL` | Optional | Custom endpoint |
| `GOOGLE_GEMINI_MODELS` | Optional | Comma-separated |
| `OPENROUTER_API_KEY` | Optional | Fallback provider |
| `OPENROUTER_BASE_URL` | Optional | Custom endpoint |
| `OPENROUTER_MODELS` | Optional | Comma-separated |
| `OPENROUTER_SITE_URL` | Optional | Referer/title header context |
| `GROQ_API_KEY` | Optional | Fallback provider |
| `GROQ_BASE_URL` | Optional | Custom endpoint |
| `GROQ_MODELS` | Optional | Comma-separated |
| `EURON_API_KEY` | Optional | Fallback provider |
| `EURON_BASE_URL` | Optional | Custom endpoint |
| `EURON_MODELS` | Optional | Comma-separated |
| `MODEL_PROVIDER_ORDER` | Optional | e.g. `google,openrouter,groq,euron` |
| `AI_TEXT_TIMEOUT_MS` | Optional | Per-attempt timeout |
| `AI_TEXT_MAX_ATTEMPTS` | Optional | Max text attempts across providers |

### 3) Embeddings (RAG)

| Variable | Required | Notes |
|---|---|---|
| `EMBEDDING_PROVIDER_ORDER` | Optional | e.g. `euron,groq,google` |
| `EURON_EMBEDDING_BASE_URL` | Optional | Euron embedding endpoint |
| `EURON_EMBEDDING_MODELS` | Optional | e.g. `text-embedding-3-small` |
| `GROQ_EMBEDDING_BASE_URL` | Optional | Groq embedding endpoint |
| `GROQ_EMBEDDING_MODELS` | Optional | Comma-separated |
| `GOOGLE_GEMINI_EMBEDDING_MODELS` | Optional | Comma-separated |
| `AI_EMBED_TIMEOUT_MS` | Optional | Per-attempt timeout |
| `AI_EMBED_MAX_ATTEMPTS` | Optional | Max embedding attempts |

### 4) Gmail Integration

| Variable | Required | Notes |
|---|---|---|
| `GMAIL_CLIENT_ID` | If using Gmail features | OAuth client ID |
| `GMAIL_CLIENT_SECRET` | If using Gmail features | OAuth client secret |
| `GMAIL_REDIRECT_URI` | If using Gmail features | Must match Google Console callback URL |

### 5) Telegram Sniper

| Variable | Required | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | If using Telegram alerts | Server-side only, users never enter this |

### 6) Realtime (Pusher)

| Variable | Required | Notes |
|---|---|---|
| `PUSHER_APP_ID` | Optional but recommended | Server broadcast |
| `PUSHER_SECRET` | Optional but recommended | Server secret |
| `NEXT_PUBLIC_PUSHER_KEY` | Optional but recommended | Client subscribe key |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Optional but recommended | Cluster name |

### 7) Job Source Fallback APIs

| Variable | Required | Notes |
|---|---|---|
| `ADZUNA_APP_ID` | Optional | Fallback source 1 |
| `ADZUNA_APP_KEY` | Optional | Fallback source 1 |
| `RAPIDAPI_KEY` | Optional | JSearch fallback |
| `RAPIDAPI_JSEARCH_HOST` | Optional | Defaults to `jsearch.p.rapidapi.com` |
| `INDIANAPI_API_KEY` | Optional | Fallback source 3 |
| `JOB_SOURCE_TIMEOUT_MS` | Optional | External API timeout |

### 8) Hunt + Timeline Runtime Tuning

| Variable | Required | Notes |
|---|---|---|
| `HUNT_DISCOVERY_TIMEOUT_MS` | Optional | Discovery subprocess timeout |
| `HUNT_SCRAPE_TIMEOUT_MS` | Optional | Scrape subprocess timeout |
| `HUNT_MAX_QUERIES_PER_USER` | Optional | Hunt breadth |
| `HUNT_MAX_URLS_PER_USER` | Optional | Max scraped URLs |
| `HUNT_MIN_CREATED_BEFORE_FALLBACK` | Optional | Fallback trigger threshold |
| `HUNT_MAX_FALLBACK_PER_QUERY` | Optional | Fallback ingestion cap |
| `EVENT_TIMELINE_RETENTION_DAYS` | Optional | Timeline retention controls |

### 9) Inngest

| Variable | Required | Notes |
|---|---|---|
| `INNGEST_API_KEY` | Optional/local-dev or cloud use | For Inngest Cloud usage |
| `INNGEST_SIGNING_KEY` | Optional/local-dev or cloud use | Webhook verification |

### 10) Currently Reserved / Not Wired to Main Runtime Paths

- `ARCJET_KEY`
- `RESEND_API_KEY`

## Example `.env` Skeleton

```bash
# Core
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# AI text providers
GEMINI_API_KEY=
GOOGLE_GEMINI_API_KEY=
GOOGLE_GEMINI_BASE_URL=
GOOGLE_GEMINI_MODELS=
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=
OPENROUTER_MODELS=
OPENROUTER_SITE_URL=
GROQ_API_KEY=
GROQ_BASE_URL=
GROQ_MODELS=
EURON_API_KEY=
EURON_BASE_URL=
EURON_MODELS=
MODEL_PROVIDER_ORDER=google,openrouter,groq,euron
AI_TEXT_TIMEOUT_MS=25000
AI_TEXT_MAX_ATTEMPTS=8

# Embeddings
EMBEDDING_PROVIDER_ORDER=euron,groq,google
EURON_EMBEDDING_BASE_URL=
EURON_EMBEDDING_MODELS=text-embedding-3-small
GROQ_EMBEDDING_BASE_URL=
GROQ_EMBEDDING_MODELS=text-embedding-3-small
GOOGLE_GEMINI_EMBEDDING_MODELS=text-embedding-004
AI_EMBED_TIMEOUT_MS=15000
AI_EMBED_MAX_ATTEMPTS=6

# Gmail
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=

# Telegram
TELEGRAM_BOT_TOKEN=

# Pusher
PUSHER_APP_ID=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

# Job source APIs
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
RAPIDAPI_KEY=
RAPIDAPI_JSEARCH_HOST=jsearch.p.rapidapi.com
INDIANAPI_API_KEY=
JOB_SOURCE_TIMEOUT_MS=12000

# Hunt + timeline tuning
HUNT_DISCOVERY_TIMEOUT_MS=20000
HUNT_SCRAPE_TIMEOUT_MS=30000
HUNT_MAX_QUERIES_PER_USER=4
HUNT_MAX_URLS_PER_USER=6
HUNT_MIN_CREATED_BEFORE_FALLBACK=1
HUNT_MAX_FALLBACK_PER_QUERY=8
EVENT_TIMELINE_RETENTION_DAYS=2

# Inngest
INNGEST_API_KEY=
INNGEST_SIGNING_KEY=
```

## OAuth + Compliance Pages

Public pages added for production/OAuth readiness:

- `/privacy-policy`
- `/terms-of-service`
- `/data-deletion`
- `/support`

Use these in your Google OAuth consent screen during production verification.

## Deployment

### Vercel (CLI)

```bash
npm install -g vercel
vercel login
vercel link
vercel --prod
```

If your team scope is required:

```bash
vercel link --scope <your-team-scope>
vercel --prod --scope <your-team-scope>
```

### Vercel (Recommended)

- Configure all secrets in Vercel Project Settings -> Environment Variables.
- Do not rely on uploading local `.env` to production.

### Docker

```bash
docker compose up --build
```

Container uses standalone Next output and runs Prisma migrations at startup.

## Authentication / Route Protection

Protected routes are enforced in `proxy.js` for:

- `/dashboard/*`
- `/jobs/*`
- `/advanced/*`
- `/resume/*`
- `/interview/*`
- `/ai-cover-letter/*`
- `/onboarding/*`

## Troubleshooting

### Personal chatbot models not ready

```bash
npx prisma migrate deploy
npx prisma generate
# then restart dev server
```

### Telegram connected but no alerts

- Ensure `TELEGRAM_BOT_TOKEN` is set on server.
- Ensure user has saved numeric `telegramChatId`.
- Ensure hunt actually created new applications.

### Gmail draft/send errors

- Reconnect Gmail and reapprove scopes.
- Verify OAuth callback URL exactly matches `GMAIL_REDIRECT_URI`.

### Crawler issues

- Confirm Python + Playwright setup.
- If crawler sources fail, configure fallback job source API keys.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - serve production build
- `npm run lint` - ESLint flat-config run

## Notes

- `README.md` intentionally documents production-grade setup and all major module surfaces.
- Keep secrets out of git; `.env*` is ignored.
