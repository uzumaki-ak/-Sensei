import { Inngest } from "inngest";

const inngestEnv =
  process.env.INNGEST_ENV ||
  (process.env.VERCEL_ENV === "production" ? "production" : undefined);
const inngestEventKey =
  process.env.INNGEST_EVENT_KEY || process.env.INNGEST_API_KEY;

export const inngest = new Inngest({
  id: "career-coach", // Unique app ID
  name: "Career Coach",
  ...(inngestEnv ? { env: inngestEnv } : {}),
  ...(inngestEventKey ? { eventKey: inngestEventKey } : {}),
  credentials: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
  },
});
