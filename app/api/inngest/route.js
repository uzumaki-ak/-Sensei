import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { generateIndustryInsights } from "@/lib/inngest/function";
import { manualJobHunt, nightlyJobHunt } from "@/lib/inngest/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateIndustryInsights,
    nightlyJobHunt,
    manualJobHunt,
  ],
});
