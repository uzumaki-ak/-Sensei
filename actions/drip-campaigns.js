"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";

/**
 * Generates a 3-part cold email sequence for a job application.
 * 
 * @param {string} applicationId - The ID of the saved job application.
 * @returns {Promise<{ sequenceMarkdown: string }>}
 */
export async function generateDripSequence(applicationId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!applicationId) {
      throw new Error("A selected job is required.");
    }

    // 1. Fetch Job Application Details
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

    const companyName = application.job.company;
    const role = application.job.title;
    const userIndustry = application.user.industry || "Tech";
    const userBio = application.user.bio || "A passionate professional looking for new opportunities.";

    // 2. Prompt Gemini AI
    const model = getModel();
    const prompt = `
You are a master of B2B cold emailing and recruitment networking.
Your client is applying for the **${role}** position at **${companyName}**.
Client's Industry: ${userIndustry}
Client's Bio: ${userBio}

Generate a high-converting, 3-part cold email drip campaign aimed at the Hiring Manager or Internal Recruiter at ${companyName}. 
The emails should be short, punchy, and highly personalized.
Each email body must be 90-140 words max.
Keep language concrete and role-specific.

**Email 1: The Hook (Day 1)**
Focus on a specific pain point the company might have that the client can solve. Do NOT attach a resume immediately, ask for a quick chat.

**Email 2: The Value Add (Day 4)**
A short follow-up providing a piece of value (e.g. an idea, a mini-portfolio link, or a thought on their recent product).

**Email 3: The Break-up (Day 10)**
The final email. Polite, leaving the door open, but assuming they are too busy right now.

Return your response ONLY as a strict JSON object with this format:
{
  "sequenceMarkdown": "### Email 1: The Hook\\n**Subject:** ...\\n\\n**Body:**\\n...\\n\\n### Email 2: The Value Add\\n**Subject:** ...\\n\\n**Body:**\\n...\\n\\n### Email 3: The Break-up\\n**Subject:** ...\\n\\n**Body:**\\n..."
}
Do not include markdown code block formatting (like \`\`\`json) in the response text itself, just the raw JSON string.
    `;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    
    // Strip markdown formatting if Gemini includes it
    const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsed = JSON.parse(cleanedJson);
    const sequenceMarkdown = parsed.sequenceMarkdown || "No sequence generated.";

    const savedHistory = await db.dripCampaignHistory.create({
      data: {
        userId: application.user.id,
        applicationId: application.id,
        sequenceMarkdown,
      },
    });

    return {
      success: true,
      sequenceMarkdown,
      historyItem: {
        id: savedHistory.id,
        createdAt: savedHistory.createdAt,
        applicationId: application.id,
        jobLabel: `${application.job.company} - ${application.job.title}`,
        sequenceMarkdown,
      },
    };

  } catch (error) {
    console.error("[Drip Campaign Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during generation.",
    };
  }
}

export async function getDripCampaignHistory(applicationId = null) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!user) throw new Error("User not found");

    const history = await db.dripCampaignHistory.findMany({
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
        sequenceMarkdown: item.sequenceMarkdown,
        jobLabel: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
      })),
    };
  } catch (error) {
    console.error("[Drip Campaign History Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch drip campaign history.",
    };
  }
}
