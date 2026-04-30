import { Inngest } from "inngest";

const inngestEnv =
  process.env.INNGEST_ENV ||
  (process.env.VERCEL_ENV === "production" ? "production" : undefined);

export const inngest = new Inngest({
  id: "career-coach", // Unique app ID
  name: "Career Coach",
  ...(inngestEnv ? { env: inngestEnv } : {}),
  credentials: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
  },
});
