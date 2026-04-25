"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";

/**
 * Generates an offer negotiation script based on the job and compensation details.
 * 
 * @param {string} applicationId - The ID of the saved job application.
 * @param {Object} offerDetails - The current offer and target numbers.
 * @returns {Promise<{ negotiationScriptMarkdown: string }>}
 */
export async function generateNegotiationScript(applicationId, offerDetails) {
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
      },
    });

    if (!application) throw new Error("Job application not found.");

    const {
        currentBase,
        currentBonus,
        currentEquity,
        targetBase,
        targetBonus,
        targetEquity,
        leveragePoints
    } = offerDetails;

    // 3. Prompt Gemini AI
    const model = getModel();
    const prompt = `
You are a top-tier executive compensation negotiator. 
Your client has received a job offer and wants to negotiate for more. You must draft a professional, polite, but firm email or phone script for them to use with the recruiter/hiring manager.

### Job Context
Role: ${application.job.title}
Company: ${application.job.company}

### Current Offer on the Table
Base Salary: $${currentBase || "N/A"}
Sign-on Bonus: $${currentBonus || "N/A"}
Equity/Stock: $${currentEquity || "N/A"}

### Client's Target Numbers
Target Base: $${targetBase || "N/A"}
Target Bonus: $${targetBonus || "N/A"}
Target Equity: $${targetEquity || "N/A"}

### Client's Leverage / Talking Points
${leveragePoints || "No specific leverage points provided. Focus on market rate and value addition."}

Generate a "Negotiation Playbook" that includes:
1. **The Psychology:** A 2-sentence breakdown of the negotiation strategy.
2. **Email Script:** A ready-to-send email drafted to the recruiter.
3. **Phone Script:** A short, conversational script if they discuss this over the phone.
4. **Fallback Strategy:** What to ask for (e.g. extra PTO, signing bonus) if the base salary is absolutely rigid.

Return your response ONLY as a strict JSON object with this format:
{
  "negotiationScriptMarkdown": "### Strategy\\n...\\n### Email Draft\\n..."
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
      negotiationScriptMarkdown: parsed.negotiationScriptMarkdown || "No script generated.",
    };

  } catch (error) {
    console.error("[Offer Copilot Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during analysis.",
    };
  }
}
