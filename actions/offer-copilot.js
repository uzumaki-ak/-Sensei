"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";

function toMoneyNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function normalizeArray(raw, max = 8) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || "").trim()).filter(Boolean).slice(0, max);
}

export async function generateNegotiationScript(applicationId, offerDetails) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!applicationId) {
      throw new Error("A selected job is required.");
    }

    const application = await db.jobApplication.findFirst({
      where: {
        id: applicationId,
        user: {
          clerkUserId: userId,
        },
      },
      include: {
        job: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!application) throw new Error("Job application not found.");

    const currentBase = toMoneyNumber(offerDetails?.currentBase);
    const currentBonus = toMoneyNumber(offerDetails?.currentBonus);
    const currentEquity = toMoneyNumber(offerDetails?.currentEquity);
    const targetBase = toMoneyNumber(offerDetails?.targetBase);
    const targetBonus = toMoneyNumber(offerDetails?.targetBonus);
    const targetEquity = toMoneyNumber(offerDetails?.targetEquity);
    const leveragePoints = String(offerDetails?.leveragePoints || "").trim();

    const model = getModel();
    const prompt = `
You are a senior compensation negotiator and communication coach.
Create a tactical, structured playbook for offer negotiation.

Job context:
- Role: ${application.job.title}
- Company: ${application.job.company}

Compensation details:
- Current base: ${currentBase}
- Current bonus: ${currentBonus}
- Current equity: ${currentEquity}
- Target base: ${targetBase}
- Target bonus: ${targetBonus}
- Target equity: ${targetEquity}
- Leverage points: ${leveragePoints || "Not provided"}

Return strict JSON only with this shape:
{
  "summary": "one-paragraph negotiation thesis",
  "toneGuidance": ["bullet"],
  "priorityAsks": ["bullet"],
  "fallbackAsks": ["bullet"],
  "emailDraft": {
    "subject": "subject line",
    "body": "plain text email body"
  },
  "phoneScriptSteps": ["step"],
  "riskMatrix": [
    {
      "risk": "string",
      "probability": "low | medium | high",
      "mitigation": "string"
    }
  ],
  "doNotSay": ["bullet"],
  "closePlan": ["bullet"]
}

Rules:
- Be specific to role/company context.
- Keep tone professional and calm.
- No hype language.
- Avoid markdown in JSON values.
`;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);

    const structured = {
      summary: String(parsed.summary || "").trim(),
      toneGuidance: normalizeArray(parsed.toneGuidance, 6),
      priorityAsks: normalizeArray(parsed.priorityAsks, 6),
      fallbackAsks: normalizeArray(parsed.fallbackAsks, 6),
      emailDraft: {
        subject: String(parsed?.emailDraft?.subject || `Follow-up on ${application.job.title} offer`).trim(),
        body: String(parsed?.emailDraft?.body || "").trim(),
      },
      phoneScriptSteps: normalizeArray(parsed.phoneScriptSteps, 10),
      riskMatrix: Array.isArray(parsed.riskMatrix)
        ? parsed.riskMatrix
            .map((item) => ({
              risk: String(item?.risk || "").trim(),
              probability: ["low", "medium", "high"].includes(
                String(item?.probability || "").toLowerCase()
              )
                ? String(item.probability).toLowerCase()
                : "medium",
              mitigation: String(item?.mitigation || "").trim(),
            }))
            .filter((item) => item.risk && item.mitigation)
            .slice(0, 6)
        : [],
      doNotSay: normalizeArray(parsed.doNotSay, 6),
      closePlan: normalizeArray(parsed.closePlan, 6),
    };

    const compensation = {
      current: {
        base: currentBase,
        bonus: currentBonus,
        equity: currentEquity,
        total: currentBase + currentBonus + currentEquity,
      },
      target: {
        base: targetBase,
        bonus: targetBonus,
        equity: targetEquity,
        total: targetBase + targetBonus + targetEquity,
      },
    };

    compensation.delta = {
      base: compensation.target.base - compensation.current.base,
      bonus: compensation.target.bonus - compensation.current.bonus,
      equity: compensation.target.equity - compensation.current.equity,
      total: compensation.target.total - compensation.current.total,
    };

    const negotiationScriptMarkdown =
      parsed.negotiationScriptMarkdown ||
      `### Negotiation Thesis\n${structured.summary}\n\n### Priority Asks\n${structured.priorityAsks
        .map((item) => `- ${item}`)
        .join("\n")}`;

    const savedHistory = await db.offerCopilotHistory.create({
      data: {
        userId: application.user.id,
        applicationId: application.id,
        offerInput: {
          currentBase,
          currentBonus,
          currentEquity,
          targetBase,
          targetBonus,
          targetEquity,
          leveragePoints,
        },
        playbook: structured,
        compensation,
        negotiationScriptMarkdown,
      },
    });

    return {
      success: true,
      playbook: structured,
      compensation,
      negotiationScriptMarkdown,
      historyItem: {
        id: savedHistory.id,
        createdAt: savedHistory.createdAt,
        applicationId: application.id,
        jobLabel: `${application.job.company} - ${application.job.title}`,
        playbook: structured,
        compensation,
        negotiationScriptMarkdown,
      },
    };
  } catch (error) {
    console.error("[Offer Copilot Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during analysis.",
    };
  }
}

export async function getOfferCopilotHistory(applicationId = null) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!user) throw new Error("User not found");

    const history = await db.offerCopilotHistory.findMany({
      where: {
        userId: user.id,
        ...(applicationId ? { applicationId } : {}),
      },
      include: {
        application: {
          select: {
            job: {
              select: {
                company: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return {
      success: true,
      history: history.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        applicationId: item.applicationId,
        playbook: item.playbook,
        compensation: item.compensation,
        negotiationScriptMarkdown: item.negotiationScriptMarkdown,
        jobLabel: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
      })),
    };
  } catch (error) {
    console.error("[Offer Copilot History Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch offer copilot history.",
    };
  }
}
