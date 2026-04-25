"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel, handleGeminiError } from "@/lib/gemini";
import { SchemaType } from "@google/generative-ai";

/**
 * Analyzes a user's GitHub profile against a specific job's requirements.
 * Identifies missing skills and generates a weekend project plan.
 * 
 * @param {string} repoUrl - The public GitHub repository URL.
 * @param {string} applicationId - The ID of the saved job application.
 * @returns {Promise<{ missingSkills: string[], projectPlanMarkdown: string }>}
 */
export async function analyzeGithubGap(repoUrl, applicationId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!repoUrl || !applicationId) {
      throw new Error("GitHub repository URL and a selected job are required.");
    }

    // Parse the owner and repo from the URL
    // e.g., https://github.com/facebook/react -> facebook/react
    let repoPath = repoUrl;
    try {
        const urlObj = new URL(repoUrl);
        repoPath = urlObj.pathname.replace(/^\/+|\/+$/g, ""); // remove leading/trailing slashes
    } catch (e) {
        // If it's not a full URL, maybe they just typed "owner/repo"
        repoPath = repoUrl.trim();
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
        user: true,
      },
    });

    if (!application) throw new Error("Job application not found.");

    const jobStack = application.job.techStack?.join(", ") || "No specific stack extracted";
    const jobDescription = application.job.description || "No description available";

    // 2. Fetch User's specific GitHub Repo
    const githubRes = await fetch(
      `https://api.github.com/repos/${repoPath}`
    );

    if (!githubRes.ok) {
      if (githubRes.status === 404) {
        throw new Error("GitHub repository not found. Ensure it is public and the URL is correct.");
      }
      throw new Error("Failed to fetch data from GitHub API.");
    }

    const repo = await githubRes.json();
    
    // Fetch the README
    let readmeText = "No README found.";
    try {
        const readmeRes = await fetch(`https://api.github.com/repos/${repoPath}/readme`);
        if (readmeRes.ok) {
            const readmeData = await readmeRes.json();
            readmeText = Buffer.from(readmeData.content, "base64").toString("utf-8");
        }
    } catch (e) {
        console.warn("Could not fetch README");
    }
    
    // Fetch Languages
    let languages = "Unknown";
    try {
        const langRes = await fetch(repo.languages_url);
        if (langRes.ok) {
            const langData = await langRes.json();
            languages = Object.keys(langData).join(", ");
        }
    } catch (e) {
        console.warn("Could not fetch languages");
    }

    // Summarize the repo for the LLM
    const repoSummary = {
      name: repo.name,
      description: repo.description || "No description",
      languages: languages,
      topics: repo.topics || [],
      readmeSnippet: readmeText.substring(0, 2000) // First 2000 chars of README
    };

    // 3. Prompt Gemini AI
    const model = getModel();
    const prompt = `
You are an expert technical interviewer and career coach.
Your task is to analyze a candidate's specific GitHub project and compare it against a specific job's requirements.
Identify what core skills or architectural patterns the candidate's project is missing, and generate a step-by-step "Weekend Refactor Plan" they can implement immediately on this specific repository to bridge that gap and impress the hiring manager.
Also, evaluate if this project is impressive enough or relevant enough to be included on their resume for THIS specific job.

IMPORTANT FORMATTING INSTRUCTIONS for projectPlanMarkdown:
- Use rich GitHub-Flavored Markdown.
- Use Task Lists (e.g. \`- [ ] Refactor X\`) for the step-by-step plan.
- Use a markdown \`\`\`mermaid diagram block to illustrate the BEFORE vs AFTER architecture or a feature flow.
- Use headers, bold text, and tables where it makes sense to make the output look beautiful and highly readable.

### Job Requirements
Job Title: ${application.job.title}
Company: ${application.job.company}
Tech Stack: ${jobStack}
Description Snippet: ${jobDescription.substring(0, 1500)}

### Candidate's Specific GitHub Repository
${JSON.stringify(repoSummary, null, 2)}

Return your response ONLY as a strict JSON object with this format:
{
  "missingSkills": ["React", "Docker", "AWS"],
  "projectPlanMarkdown": "# Weekend Refactor: [Name]\\n\\n## Overview\\n...\\n## Step 1...\\n",
  "resumeRecommendation": "Yes, include this because it demonstrates X which is required for the job."
}
Do not include markdown code block formatting (like \`\`\`json) in the response text itself, just the raw JSON string.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            missingSkills: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            projectPlanMarkdown: {
              type: SchemaType.STRING,
            },
            resumeRecommendation: {
              type: SchemaType.STRING,
            },
          },
          required: ["missingSkills", "projectPlanMarkdown", "resumeRecommendation"],
        },
      },
    });
    
    const rawResponse = result.response.text();
    const parsed = JSON.parse(rawResponse);

    // 4. Save to Database
    const savedAnalysis = await db.githubAnalysisHistory.create({
      data: {
        userId: application.user.id,
        applicationId: applicationId,
        repoUrl: repoUrl,
        missingSkills: parsed.missingSkills || [],
        projectPlanMarkdown: parsed.projectPlanMarkdown || "No plan generated.",
        resumeRecommendation: parsed.resumeRecommendation || "No recommendation provided.",
      }
    });

    return {
      success: true,
      analysis: savedAnalysis,
    };

  } catch (error) {
    const friendlyError = handleGeminiError(error);
    return {
      success: false,
      error: friendlyError,
    };
  }
}

export async function getGithubAnalysisHistory(applicationId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    const history = await db.githubAnalysisHistory.findMany({
      where: {
        userId: user.id,
        applicationId: applicationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { success: true, history };
  } catch (error) {
    console.error("[GitHub Analyzer Error]:", error);
    return { success: false, error: error.message };
  }
}
