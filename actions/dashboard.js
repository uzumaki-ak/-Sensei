"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";
import { revalidatePath } from "next/cache";

const model = getModel();

export const generateAIInsights = async (industry) => {
  const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "High" | "Medium" | "Low",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "Positive" | "Neutral" | "Negative",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }
          
          IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });
  const response = result.response;
  const text = response.text();
  const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

  const insights = JSON.parse(cleanedText);
  const validRanges = Array.isArray(insights.salaryRanges) && insights.salaryRanges.every((range) =>
    typeof range?.role === "string" && [range.min, range.max, range.median].every(Number.isFinite)
  );
  const validLists = ["topSkills", "keyTrends", "recommendedSkills"].every((key) =>
    Array.isArray(insights[key]) && insights[key].every((item) => typeof item === "string")
  );
  if (!validRanges || !validLists || !Number.isFinite(insights.growthRate) ||
      typeof insights.demandLevel !== "string" || typeof insights.marketOutlook !== "string") {
    throw new Error("AI returned incomplete industry insights. Please try again.");
  }
  return insights;
};

export async function refreshIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to refresh insights.");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true },
  });
  if (!user?.industry) throw new Error("Set your industry in your profile first.");

  const existing = await db.industryInsight.findUnique({ where: { industry: user.industry } });
  if (existing && Date.now() - existing.lastUpdated.getTime() < 60 * 60 * 1000) {
    return { refreshed: false };
  }

  const insights = await generateAIInsights(user.industry);
  const now = new Date();
  await db.industryInsight.upsert({
    where: { industry: user.industry },
    update: { ...insights, lastUpdated: now, nextUpdate: new Date(now.getTime() + 7 * 86400000) },
    create: { industry: user.industry, ...insights, lastUpdated: now, nextUpdate: new Date(now.getTime() + 7 * 86400000) },
  });
  revalidatePath("/dashboard");
  return { refreshed: true };
}

export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  // If no insights exist, generate them
  if (!user.industryInsight) {
    const insights = await generateAIInsights(user.industry);

    const industryInsight = await db.industryInsight.create({
      data: {
        industry: user.industry,
        ...insights,
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return industryInsight;
  }

  return user.industryInsight;
}

export async function getToolActivitySummary() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  const personalChatSessionCountPromise =
    db.personalChatSession && typeof db.personalChatSession.count === "function"
      ? db.personalChatSession.count({ where: { userId: user.id } })
      : Promise.resolve(0);

  const [
    pipelineCount,
    reverseRecruiterCount,
    githubAnalysisCount,
    companyIntelCount,
    dripCampaignCount,
    offerCopilotCount,
    ragQueryCount,
    multiAgentRunCount,
    promptEvalRunCount,
    personalChatSessionCount,
    interviewPracticeCount,
    meetRoomCount,
    meetCompletedCount,
    meetEvaluatedCount,
    coverLetterCount,
    resumeCount,
    resumeChatCount,
    recentMeetRooms,
  ] = await Promise.all([
    db.jobApplication.count({ where: { userId: user.id } }),
    db.reverseRecruiterHistory.count({ where: { userId: user.id } }),
    db.githubAnalysisHistory.count({ where: { userId: user.id } }),
    db.companyIntelHistory.count({ where: { userId: user.id } }),
    db.dripCampaignHistory.count({ where: { userId: user.id } }),
    db.offerCopilotHistory.count({ where: { userId: user.id } }),
    db.ragQueryHistory.count({ where: { userId: user.id } }),
    db.multiAgentRun.count({ where: { userId: user.id } }),
    db.promptEvalRun.count({ where: { userId: user.id } }),
    personalChatSessionCountPromise,
    db.interviewHistory.count({ where: { userId: user.id } }),
    db.interviewMeetRoom.count({ where: { ownerUserId: user.id } }),
    db.interviewMeetRoom.count({
      where: { ownerUserId: user.id, status: "COMPLETED" },
    }),
    db.interviewMeetRoom.count({
      where: { ownerUserId: user.id, evaluatedAt: { not: null } },
    }),
    db.coverLetter.count({ where: { userId: user.id } }),
    db.resume.count({ where: { userId: user.id } }),
    db.resumeChat.count({ where: { userId: user.id } }),
    db.interviewMeetRoom.findMany({
      where: { ownerUserId: user.id, evaluatedAt: { not: null } },
      select: {
        id: true,
        code: true,
        status: true,
        evaluation: true,
        createdAt: true,
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
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const recentScorecards = recentMeetRooms.map((room) => {
    return {
      id: room.id,
      code: room.code,
      status: room.status,
      createdAt: room.createdAt,
      company: room.application?.job?.company || "Unknown",
      role: room.application?.job?.title || "Unknown role",
      overallScore: typeof room.evaluation?.overallScore === "number"
        ? room.evaluation.overallScore
        : null,
    };
  });

  return {
    totals: {
      pipelineCount,
      reverseRecruiterCount,
      githubAnalysisCount,
      companyIntelCount,
      dripCampaignCount,
      offerCopilotCount,
      ragQueryCount,
      multiAgentRunCount,
      promptEvalRunCount,
      personalChatSessionCount,
      interviewPracticeCount,
      meetRoomCount,
      meetCompletedCount,
      meetEvaluatedCount,
      coverLetterCount,
      resumeCount,
      resumeChatCount,
    },
    recentScorecards,
  };
}
