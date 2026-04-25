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
    const application = await db.jobApplication.findUnique({
      where: {
        id: applicationId,
        userId: userId,
      },
      include: {
        job: true,
        user: true,
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

**Email 1: The Hook (Day 1)**
Focus on a specific pain point the company might have that the client can solve. Do NOT attach a resume immediately, ask for a quick chat.

**Email 2: The Value Add (Day 4)**
A short follow-up providing a piece of value (e.g. an idea, a mini-portfolio link, or a thought on their recent product).

**Email 3: The Break-up (Day 10)**
The final email. Polite, leaving the door open, but assuming they are too busy right now.

Return your response ONLY as a strict JSON object with this format:
{
  "sequenceMarkdown": "### Email 1: The Hook\\n**Subject:** ...\\n\\nBody...\\n\\n--- \\n### Email 2: The Value Add..."
}
Do not include markdown code block formatting (like \`\`\`json) in the response text itself, just the raw JSON string.
    `;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    
    // Strip markdown formatting if Gemini includes it
    const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsed = JSON.parse(cleanedJson);

    return {
      success: true,
      sequenceMarkdown: parsed.sequenceMarkdown || "No sequence generated.",
    };

  } catch (error) {
    console.error("[Drip Campaign Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during generation.",
    };
  }
}
