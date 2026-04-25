"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel, handleGeminiError } from "@/lib/gemini";
import { google } from "googleapis";
import { SchemaType } from "@google/generative-ai";

/**
 * Generates an aggressive outbound pitch and drafts it via the Gmail API.
 * 
 * @param {string} applicationId - The ID of the saved job application.
 * @param {string} targetName - The name of the founder or hiring manager.
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function generateReverseRecruiterPitch(applicationId, targetName) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!applicationId || !targetName) {
      throw new Error("Job application and target person's name are required.");
    }

    // 1. Fetch User and Job Details
    const application = await db.jobApplication.findFirst({
      where: {
        id: applicationId,
        user: {
          clerkUserId: userId,
        },
      },
      include: {
        job: true,
        user: true,
      },
    });

    if (!application) throw new Error("Job application not found.");
    if (!application.user.gmailToken) throw new Error("Please connect Gmail in the dashboard first.");

    const { job, user } = application;
    const userBio = user.bio || "A passionate tech professional.";
    const userSkills = user.skills || [];

    // 2. Prompt Gemini AI
    const model = getModel();
    const prompt = `
You are the ultimate "Reverse Recruiter."
Your client is bypassing the traditional ATS portal and emailing the founder/decision-maker directly.

### Target Individual
Name: ${targetName}
Company: ${job.company}

### Job Role
Title: ${job.title}
Requirements/Stack: ${job.techStack?.join(", ") || "General tech skills"}

### Client Details
Bio: ${userBio}
Skills: ${userSkills.join(", ")}

Generate a highly aggressive, high-value cold email. 
It must be under 150 words. Do not ask for a job. Tell them exactly how the client's specific skills can solve a massive pain point for ${job.company} right now based on the role requirements. Ask for a 10-minute chat.

At the bottom of the email, you MUST include a "My Links" section that explicitly links to the client's portfolio, LinkedIn, and GitHub.

Return your response ONLY as a strict JSON object.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            subject: { type: SchemaType.STRING },
            body: { type: SchemaType.STRING },
          },
          required: ["subject", "body"],
        },
      },
    });

    const rawResponse = result.response.text();
    const parsed = JSON.parse(rawResponse);

    // 3. Draft via Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials(user.gmailToken);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Format email RFC 2822
    const targetEmail = `${targetName.toLowerCase().replace(/\s+/g, ".")}@${job.company.toLowerCase().replace(/\s+/g, "")}.com`;
    const emailLines = [
      `To: ${targetEmail}`,
      `Subject: ${parsed.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      parsed.body,
    ];
    const emailContent = emailLines.join("\r\n");

    const encodedMessage = Buffer.from(emailContent)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedMessage,
        },
      },
    });

    return {
      success: true,
      message: "Pitch drafted successfully! Check your Gmail Drafts folder.",
    };

  } catch (error) {
    const friendlyError = handleGeminiError(error);
    return {
      success: false,
      error: friendlyError,
    };
  }
}
