# Crawler Service (Render/Railway)

This service exposes two endpoints used by the Next.js app:

- `POST /discover` with body `{ "query": "..." }`
- `POST /scrape` with body `{ "url": "https://..." }`

If `CRAWLER_API_TOKEN` is set, send `Authorization: Bearer <token>`.

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r crawler_service/requirements.txt
playwright install --with-deps chromium
uvicorn crawler_service.app:app --host 0.0.0.0 --port 10000
```

## Render deploy (Docker)

Use service type `Web Service`, then configure:

- Dockerfile Path: `crawler_service/Dockerfile`
- Docker Context: `.`
- Port: `10000`
- Env (optional but recommended): `CRAWLER_API_TOKEN=<random-secret>`

After deploy, verify:

- `GET https://<your-service>.onrender.com/health`

## App integration

Set these in Vercel (Production):

- `HUNT_CRAWLER_URL=https://<your-service>.onrender.com`
- `HUNT_CRAWLER_TOKEN=<same token as CRAWLER_API_TOKEN>`

Then redeploy Vercel.
