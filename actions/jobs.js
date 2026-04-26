"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getModel } from "@/lib/gemini";
import { fetchPageContent } from "@/lib/scraper";
import { google } from "googleapis";
import { exec } from "child_process";
import { promisify } from "util";
import { runJobHuntForUser } from "@/lib/job-hunt";
import {
  selectBestResume,
  generateEmailWithResume,
} from "@/lib/resume-selector";
import { pusherServer } from "@/lib/pusher";
import {
  createJobPayload,
  isHttpUrl,
  isLikelyJobUrl,
  normalizeSourceLink,
  parseJsonFromProcessOutput,
  upsertJobApplicationForUser,
} from "@/lib/jobs-ingestion";
import { getGmailAuthState } from "@/lib/gmail-scopes";

const execPromise = promisify(exec);
const SCRAPER_TIMEOUT_MS = Number(process.env.HUNT_SCRAPE_TIMEOUT_MS || 30000);

const MAJOR_SITE_REGEX =
  /linkedin|internshala|indeed|glassdoor|wellfound|otta|naukri|workatastartup|ycombinator|x\.com|twitter\.com/i;
const ALLOWED_STATUSES = new Set(["Discovered", "To Apply", "Applied", "Interviewing", "Offer", "Rejected"]);

function revalidateJobsRoutes() {
  revalidatePath("/jobs");
  revalidatePath("/jobs/hunt");
  revalidatePath("/jobs/kanban");
}

function escapeForDoubleQuotes(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseModelJson(text) {
  const cleaned = String(text || "").replace(/```(?:json)?\n?/gi, "").trim();
  return parseJsonFromProcessOutput(cleaned);
}

async function runPythonCrawler(url) {
  const command = `python scripts/crawler/main.py "${escapeForDoubleQuotes(url)}"`;
  const { stdout } = await execPromise(command, {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONPATH: `${process.cwd()}/scripts/crawler` },
    timeout: SCRAPER_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  return parseJsonFromProcessOutput(stdout);
}

async function structureJobWithModel(sourceLink, scrapedData) {
  const model = getModel();
  const prompt = `
You are an expert recruitment parsing agent.
Extract structured job details from the provided scrape payload.
IMPORTANT: Thoroughly analyze the job description to extract ALL programming languages, frameworks, tools, and platforms mentioned. Add them to the "techStack" array. Do not leave "techStack" empty if tools are mentioned anywhere in the text.

Source URL: ${sourceLink}
Payload: ${JSON.stringify(scrapedData)}

Return strict JSON only:
{
  "title": "string or null",
  "company": "string or null",
  "description": "string or null",
  "techStack": ["string"],
  "recruiterEmail": "string or null"
}
  `;

  const aiResult = await model.generateContent(prompt);
  const parsed = parseModelJson(aiResult.response.text());

  return createJobPayload({
    sourceLink,
    title: parsed.title || scrapedData.title,
    company: parsed.company || scrapedData.company,
    description: parsed.description || scrapedData.description,
    techStack: parsed.techStack || scrapedData.techStack,
    recruiterEmail: parsed.recruiterEmail || scrapedData.recruiterEmail,
    rawText: scrapedData.raw_text || scrapedData.rawText,
  });
}

async function getAuthenticatedUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      bio: true,
      industry: true,
      skills: true,
      personas: true,
      gmailToken: true,
      primaryResumeId: true,
      telegramChatId: true,
    },
  });

  if (!user) throw new Error("User not found");
  return user;
}

/**
 * Retrieval Logic
 */
export async function getJobApplications() {
  console.log("[getJobApplications] Starting...");
  try {
    const user = await getAuthenticatedUser();
    console.log("[getJobApplications] User authenticated:", user.id);

    // Add connection retry for Neon cold starts
    let applications = [];
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        applications = await db.jobApplication.findMany({
          where: { userId: user.id },
          include: { job: true },
          orderBy: { createdAt: "desc" },
        });
        break;
      } catch (dbError) {
        retries++;
        if (retries > maxRetries) throw dbError;
        console.log(`[getJobApplications] Retrying DB connection (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }

    console.log("[getJobApplications] Found applications:", applications.length);
    const gmailStatus = getGmailAuthState(user.gmailToken);

    return {
      applications,
      personas: user.personas || [],
      isGmailConnected: gmailStatus.isConnected,
      isGmailFullyAuthorized: gmailStatus.hasRequiredScopes,
      gmailNeedsReconnect: gmailStatus.needsReconnect,
      isTelegramConnected: Boolean(user.telegramChatId),
      telegramChatId: user.telegramChatId || null,
      userId: user.id,
    };
  } catch (error) {
    console.error("[getJobApplications] Error:", error);
    throw new Error(error.message || "Failed to load job applications");
  }
}

/**
 * Gmail Automation
 */
export async function getGmailAuthUrl() {
  await getAuthenticatedUser();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.compose",
    ],
    prompt: "consent",
  });
}

export async function updateRecruiterEmail(jobId, email) {
  const user = await getAuthenticatedUser();

  if (!email || !email.includes("@")) {
    throw new Error("Please enter a valid email address");
  }

  // Update the job listing with the recruiter email
  await db.jobListing.updateMany({
    where: { id: jobId },
    data: { recruiterEmail: email },
  });

  revalidateJobsRoutes();
  return { success: true };
}

export async function sendOutreachEmail(applicationId, customEmail = null, attachmentId = null) {
  const user = await getAuthenticatedUser();

  if (!user.gmailToken) {
    throw new Error("Gmail not connected");
  }

  const application = await db.jobApplication.findFirst({
    where: { id: applicationId, userId: user.id },
    include: { job: true },
  });

  if (!application || !application.draftEmail) {
    throw new Error("No draft found");
  }

  // Use custom email if provided, otherwise fall back to job's recruiter email
  const recipientEmail = customEmail || application.job.recruiterEmail;

  if (!recipientEmail) {
    throw new Error("Recruiter email is missing for this job. Add a valid email first.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2Client.setCredentials(user.gmailToken);

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const subjectMatch = application.draftEmail.match(/\[?Subject:\s*(.+?)\]?(?:\r?\n|$)/i);
  const subject = subjectMatch?.[1]?.trim() || `Application for ${application.job.title}`;
  const body = application.draftEmail.replace(/\[?Subject:.*?(?:\r?\n|$)/i, "").trim();

  let encodedMessage;

  // If attachment exists, send as multipart email
  if (attachmentId || application.attachmentId) {
    const attachment = await db.resumeAttachment.findFirst({
      where: { 
        id: attachmentId || application.attachmentId,
        userId: user.id 
      }
    });

    if (attachment) {
      // Create multipart email with attachment
      const boundary = "----=_NextPart_000_0001_01DBCD56.7B8E4F90";
      
      const messageParts = [
        `--${boundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        body,
        "",
        `--${boundary}`,
        `Content-Type: ${attachment.fileType}; name="${attachment.fileName}"`,
        `Content-Disposition: attachment; filename="${attachment.fileName}"`,
        "Content-Transfer-Encoding: base64",
        "",
        attachment.fileData,
        "",
        `--${boundary}--`
      ];

      const fullMessage = [
        `To: ${recipientEmail}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        messageParts.join("\r\n")
      ].join("\r\n");

      encodedMessage = Buffer.from(fullMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }
  }

  // Fallback to plain text if no attachment
  if (!encodedMessage) {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const message = [
      `To: ${recipientEmail}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${utf8Subject}`,
      "",
      body,
    ].join("\n");

    encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    // Update application status and mark email as sent
    await db.jobApplication.update({
      where: { id: application.id },
      data: {
        status: "Applied",
        appliedAt: new Date(),
        emailSent: true,
        emailSentAt: new Date(),
      },
    });

    // Also update the job listing with the email if it was custom
    if (customEmail && !application.job.recruiterEmail) {
      await db.jobListing.update({
        where: { id: application.job.id },
        data: { recruiterEmail: customEmail },
      });
    }

    // Broadcast email sent via Pusher
    try {
      await pusherServer.trigger(`user-${user.id}`, "email-sent", {
        applicationId: application.id,
        jobId: application.job.id,
      });
    } catch (pusherError) {
      console.error("[Pusher] Failed to broadcast email sent:", pusherError.message);
    }

    revalidateJobsRoutes();
    return { success: true };
  } catch (error) {
    console.error("Gmail Send Error:", error);
    throw new Error("Failed to send email. Reconnect Gmail and try again.");
  }
}

/**
 * URL Scraper
 */
export async function scrapeJobUrl(inputUrl) {
  const user = await getAuthenticatedUser();
  const sourceLink = normalizeSourceLink(inputUrl);

  if (!isHttpUrl(sourceLink)) {
    throw new Error("Please enter a valid URL starting with http:// or https://");
  }

  if (!isLikelyJobUrl(sourceLink)) {
    throw new Error("This does not look like a direct job post URL.");
  }

  try {
    let scrapedData = {};

    if (MAJOR_SITE_REGEX.test(sourceLink)) {
      scrapedData = await runPythonCrawler(sourceLink);
    } else {
      const html = await fetchPageContent(sourceLink);
      scrapedData = { raw_text: html };
    }

    let jobPayload;
    try {
      jobPayload = await structureJobWithModel(sourceLink, scrapedData);
    } catch (parseError) {
      console.error("Model structuring failed, using fallback parser:", parseError.message);
      jobPayload = createJobPayload({
        sourceLink,
        title: scrapedData.title,
        company: scrapedData.company,
        description: scrapedData.description,
        techStack: scrapedData.techStack,
        recruiterEmail: scrapedData.recruiterEmail,
        rawText: scrapedData.raw_text || scrapedData.rawText,
      });
    }

    const { application, created } = await upsertJobApplicationForUser({
      userId: user.id,
      status: "To Apply",
      job: jobPayload,
    });

    revalidateJobsRoutes();
    return { success: true, application, alreadyExists: !created };
  } catch (error) {
    console.error("Job scrape failed:", error.message);
    throw new Error("Failed to scrape this job link. Try another URL or upload a screenshot.");
  }
}

/**
 * Email Draft Generation with Smart Resume Selection
 */
export async function generateApplicationEmail(applicationId, selectedResumeId = null) {
  const user = await getAuthenticatedUser();

  const application = await db.jobApplication.findFirst({
    where: { id: applicationId, userId: user.id },
    include: { job: true },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  try {
    let resumeId = selectedResumeId;

    // If no resume selected, use AI to pick the best one
    if (!resumeId) {
      const selection = await selectBestResume(user.id, application.job.id);
      resumeId = selection.selectedResume?.id;
    }

    // Generate email with selected resume
    const result = await generateEmailWithResume(applicationId, resumeId);

    // Broadcast email drafted event
    try {
      await pusherServer.trigger(`user-${user.id}`, "email-drafted", {
        applicationId,
        resumeId,
        jobId: application.job.id,
      });
    } catch (pusherError) {
      console.error("[Pusher] Failed to broadcast email drafted:", pusherError.message);
    }

    revalidateJobsRoutes();
    return {
      success: true,
      draftEmail: result.draftEmail,
      resumeUsed: result.resumeUsed,
    };
  } catch (error) {
    console.error("Email Agent Failed:", error.message);
    throw new Error("Failed to draft email for this job.");
  }
}

/**
 * Get resume selection recommendations for a job
 */
export async function getResumeRecommendations(applicationId) {
  const user = await getAuthenticatedUser();

  const application = await db.jobApplication.findFirst({
    where: { id: applicationId, userId: user.id },
    include: { job: true },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const selection = await selectBestResume(user.id, application.job.id);

  return {
    recommendedResume: selection.selectedResume,
    matchScore: selection.matchScore,
    jobAnalysis: selection.jobAnalysis,
    allScores: selection.allScores,
    message: selection.message,
  };
}

/**
 * OCR Fallback Scraper
 */
export async function scrapeJobFromImage(base64Image) {
  const user = await getAuthenticatedUser();

  if (!base64Image || !base64Image.includes(",")) {
    throw new Error("Invalid screenshot payload");
  }

  try {
    const model = getModel();
    const imagePart = {
      inlineData: {
        data: base64Image.split(",")[1],
        mimeType: "image/png",
      },
    };

    const prompt = `
You are an OCR + recruitment extraction agent.
Parse the screenshot and return strict JSON.
IMPORTANT: Thoroughly analyze the job description to extract ALL programming languages, frameworks, tools, and platforms mentioned. Add them to the "techStack" array. Do not leave "techStack" empty if tools are mentioned anywhere in the text.
{
  "title": "string or null",
  "company": "string or null",
  "description": "string or null",
  "techStack": ["string"],
  "recruiterEmail": "string or null",
  "sourceLink": "string or null"
}
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const parsed = parseModelJson(result.response.text());

    const sourceLink = isHttpUrl(parsed.sourceLink)
      ? normalizeSourceLink(parsed.sourceLink)
      : `manual://screenshot/${user.id}/${Date.now()}`;

    const payload = createJobPayload({
      sourceLink,
      title: parsed.title,
      company: parsed.company,
      description: parsed.description,
      techStack: parsed.techStack,
      recruiterEmail: parsed.recruiterEmail,
      rawText: parsed.description,
    });

    const { application } = await upsertJobApplicationForUser({
      userId: user.id,
      status: "To Apply",
      job: payload,
    });

    revalidateJobsRoutes();
    return { success: true, application };
  } catch (error) {
    console.error("OCR Scraper Failed:", error.message);
    throw new Error("AI Vision could not parse this screenshot. Try another image.");
  }
}

export async function updateApplicationStatus(applicationId, status) {
  const user = await getAuthenticatedUser();

  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error("Invalid status value");
  }

  const result = await db.jobApplication.updateMany({
    where: { id: applicationId, userId: user.id },
    data: {
      status,
      appliedAt: status === "Applied" ? new Date() : null,
    },
  });

  if (!result.count) {
    throw new Error("Application not found");
  }

  const updated = await db.jobApplication.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });

  // Broadcast status change via Pusher
  try {
    await pusherServer.trigger(`user-${user.id}`, "job-status-changed", {
      applicationId,
      status,
      application: updated,
    });
  } catch (pusherError) {
    console.error("[Pusher] Failed to broadcast status change:", pusherError.message);
  }

  revalidateJobsRoutes();
  return updated;
}

export async function runMyNightlyHunt() {
  const user = await getAuthenticatedUser();

  if (!user.industry) {
    throw new Error("Complete onboarding first to run job hunt.");
  }

  const result = await runJobHuntForUser(
    {
      id: user.id,
      industry: user.industry,
      skills: user.skills || [],
      personas: user.personas || [],
    },
    {
      status: "Discovered",
      log: (message) => console.error(message),
    }
  );

  // Send Telegram Alert if Sniper is connected
  if (user.telegramChatId && result.totals.createdApplications > 0) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
          const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
          const messageText = `🎯 <b>Sniper Alert!</b>\\n\\nI just found <b>${result.totals.createdApplications}</b> new jobs that perfectly match your profile.\\n\\nCheck your Kanban board now!`;
          
          try {
            await fetch(telegramApiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: user.telegramChatId,
                    text: messageText,
                    parse_mode: "HTML",
                })
            });
          } catch (e) {
              console.error("Failed to send Telegram alert", e);
          }
      }
  }

  revalidateJobsRoutes();
  return result.totals;
}
