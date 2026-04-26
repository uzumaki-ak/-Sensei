"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";
import { revalidatePath } from "next/cache";
import { fetchPageContent } from "@/lib/scraper";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_MAX_QUESTIONS = 8;
const MIN_MAX_QUESTIONS = 3;
const MAX_MAX_QUESTIONS = 15;
const MAX_CONTEXT_TURNS = 14;
const MAX_EVAL_CONTEXT_TURNS = 80;
const MAX_CANDIDATE_CONTEXT_LENGTH = 4000;
const MAX_COMPANY_CONTEXT_LENGTH = 2500;
const MAX_COMPANY_INTEL_URLS = 6;
const SCORE_DIMENSIONS = [
  "technicalDepth",
  "ownership",
  "communication",
];
const PROJECT_BIAS_REGEX =
  /(project|experience|built|worked on|background|portfolio|resume)/i;
const FRONTEND_FOCUS_REGEX =
  /(frontend|front-end|ui|react|next\.?js|javascript|typescript|css|html|browser|web app|client-side|tailwind|redux|state management|accessibility|rendering)/i;
const BACKEND_FOCUS_REGEX =
  /(backend|api|database|postgres|mysql|redis|node|express|microservice|queue|kafka|worker|server|scalability|latency)/i;
const MOBILE_FOCUS_REGEX = /(android|ios|react native|flutter|kotlin|swift|mobile)/i;
const DEVOPS_FOCUS_REGEX = /(devops|kubernetes|docker|infra|terraform|aws|gcp|azure|ci\/cd)/i;
const INFRA_HEAVY_REGEX =
  /(kafka|event[- ]driven|event sourcing|message broker|pub\/sub|queue|consumer|producer|microservice|distributed system|dead[- ]letter|idempotent)/i;
const JOB_BOARD_DOMAIN_REGEX =
  /linkedin|indeed|glassdoor|wellfound|internshala|naukri|workatastartup|ycombinator|angel\.co|monster/i;

function sanitizeRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function randomRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueRoomCode() {
  for (let i = 0; i < 20; i++) {
    const code = randomRoomCode();
    const exists = await db.interviewMeetRoom.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Failed to generate unique room code. Try again.");
}

function clampMaxQuestions(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_QUESTIONS;
  return Math.max(MIN_MAX_QUESTIONS, Math.min(MAX_MAX_QUESTIONS, Math.floor(parsed)));
}

function normalizeText(text, maxLength = 2000) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function toUrlKey(url) {
  return String(url || "").trim().replace(/\/$/, "").toLowerCase();
}

function normalizeCandidateUrl(url) {
  let value = String(url || "").trim();
  if (!value) return null;
  value = value.replace(/[),.;]+$/g, "");
  if (/^www\./i.test(value)) {
    value = `https://${value}`;
  }
  if (!isHttpUrl(value)) return null;
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractUrlsFromText(text, limit = MAX_COMPANY_INTEL_URLS) {
  const source = String(text || "");
  if (!source.trim()) return [];

  const matches =
    source.match(/https?:\/\/[^\s<>"'`)\]]+|www\.[^\s<>"'`)\]]+/gi) || [];
  const urls = [];
  for (const match of matches) {
    const normalized = normalizeCandidateUrl(match);
    if (!normalized) continue;
    urls.push(normalized);
    if (urls.length >= limit) break;
  }
  return urls;
}

function buildCandidateIntelText(options = {}) {
  const chunks = [];
  const candidateContext = normalizeText(
    options?.candidateContext || "",
    MAX_CANDIDATE_CONTEXT_LENGTH
  );

  if (candidateContext) {
    chunks.push(candidateContext);
  }

  if (Array.isArray(options?.turns)) {
    const candidateTranscript = options.turns
      .filter((turn) => turn.role === "candidate")
      .slice(-6)
      .map((turn) => normalizeText(turn.content, 500))
      .filter(Boolean)
      .join(" ");
    if (candidateTranscript) {
      chunks.push(candidateTranscript);
    }
  }

  return normalizeText(chunks.join(" "), MAX_CANDIDATE_CONTEXT_LENGTH);
}

function buildCompanySiteCandidateUrls(job, extraTexts = []) {
  const urls = [];
  const sourceLink = normalizeCandidateUrl(job?.sourceLink);
  if (sourceLink) {
    urls.push(sourceLink);
    try {
      const parsed = new URL(sourceLink);
      if (!JOB_BOARD_DOMAIN_REGEX.test(parsed.hostname)) {
        urls.push(`${parsed.protocol}//${parsed.hostname}`);
      }
    } catch {
      // ignore parse errors
    }
  }

  urls.push(
    ...extractUrlsFromText(
      normalizeText(job?.description || "", MAX_CANDIDATE_CONTEXT_LENGTH),
      MAX_COMPANY_INTEL_URLS * 2
    )
  );

  for (const block of extraTexts) {
    urls.push(
      ...extractUrlsFromText(
        normalizeText(block, MAX_CANDIDATE_CONTEXT_LENGTH),
        MAX_COMPANY_INTEL_URLS * 2
      )
    );
  }

  const deduped = [];
  const seen = new Set();
  for (const rawUrl of urls) {
    const normalized = normalizeCandidateUrl(rawUrl);
    if (!normalized) continue;
    const key = toUrlKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  deduped.sort((a, b) => {
    let isAJobBoard = false;
    let isBJobBoard = false;
    try {
      isAJobBoard = JOB_BOARD_DOMAIN_REGEX.test(new URL(a).hostname);
    } catch {
      isAJobBoard = false;
    }
    try {
      isBJobBoard = JOB_BOARD_DOMAIN_REGEX.test(new URL(b).hostname);
    } catch {
      isBJobBoard = false;
    }
    return Number(isAJobBoard) - Number(isBJobBoard);
  });

  return deduped.slice(0, MAX_COMPANY_INTEL_URLS);
}

function hasNewCompanyIntelUrls(job, candidateContext, jobContext) {
  const nextUrls = buildCompanySiteCandidateUrls(job, [candidateContext]);
  const previousUrls = Array.isArray(jobContext?.sourceMeta?.attemptedUrls)
    ? jobContext.sourceMeta.attemptedUrls
    : [];
  if (!nextUrls.length) return false;

  const known = new Set(previousUrls.map((url) => toUrlKey(url)));
  return nextUrls.some((url) => !known.has(toUrlKey(url)));
}

function tryParseJson(text) {
  try {
    return JSON.parse(String(text || "").replace(/```json|```/gi, "").trim());
  } catch {
    return null;
  }
}

function buildFallbackJobContext(application) {
  const skills = (application.job.techStack || []).filter(Boolean);
  const description = normalizeText(application.job.description, 1000);
  return {
    companySnapshot: normalizeText(
      `${application.job.company} hiring for ${application.job.title}.`,
      240
    ),
    roleObjective: normalizeText(
      `Deliver outcomes expected from ${application.job.title} based on posted responsibilities and stack requirements.`,
      260
    ),
    mustHaveSkills: skills.slice(0, 10),
    responsibilities: description
      .split(".")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6),
    domainSignals: [],
    interviewFocus: [
      "Hands-on implementation depth",
      "System and architecture reasoning",
      "Tradeoff communication",
      "Project ownership and impact",
    ],
    intelConfidence: "low",
    needsCompanyDetails: true,
    clarificationQuestion:
      "I do not have enough verified company context yet. Please share the company website or LinkedIn page and what the company builds in 1-2 lines before we continue.",
  };
}

async function buildStructuredJobContext(application, options = {}) {
  const model = getModel();
  const candidateIntelText = buildCandidateIntelText(options);
  const candidateUrls = buildCompanySiteCandidateUrls(application.job, [
    candidateIntelText,
  ]);
  const snippets = [];
  const failedUrls = [];

  for (const url of candidateUrls) {
    try {
      const html = await fetchPageContent(url);
      const cleaned = normalizeText(html, 5000);
      if (cleaned) {
        snippets.push({ url, content: cleaned });
      } else {
        failedUrls.push(url);
      }
    } catch {
      failedUrls.push(url);
    }
  }

  const sourceMeta = {
    attemptedUrls: candidateUrls,
    scrapedUrls: snippets.map((item) => item.url),
    failedUrls,
  };

  const prompt = `
You are "Job Intel Agent".
Extract structured interview-relevant context only.

Job Context:
- Company: ${application.job.company}
- Role: ${application.job.title}
- Tech stack: ${(application.job.techStack || []).join(", ") || "Not specified"}
- Job description: ${normalizeText(application.job.description, 1800)}

Candidate Added Context:
${candidateIntelText || "Not provided."}

URLs considered for scraping:
${candidateUrls.length ? candidateUrls.join("\n") : "No candidate URLs provided."}

Web Snippets:
${
  snippets.length
    ? snippets.map((item) => `Source: ${item.url}\n${item.content}`).join("\n\n")
    : "No web snippets available."
}

Return strict JSON only with this shape:
{
  "companySnapshot": "short paragraph",
  "roleObjective": "single sentence",
  "mustHaveSkills": ["skill"],
  "responsibilities": ["item"],
  "domainSignals": ["item"],
  "interviewFocus": ["theme"],
  "intelConfidence": "high | medium | low",
  "needsCompanyDetails": true,
  "clarificationQuestion": "question to ask candidate if details are missing"
}

Rules:
- Keep only job-relevant data.
- No fluff, no generic hiring advice.
- Keep arrays concise and concrete.
- If web/company details are insufficient, set needsCompanyDetails to true.
- Never invent company facts.
  `;

  try {
    const result = await model.generateContent(prompt);
    const parsed = tryParseJson(result.response.text());
    if (!parsed || typeof parsed !== "object") {
      const fallback = buildFallbackJobContext(application);
      const structuredFallback = { ...fallback, sourceMeta };
      return {
        summary: normalizeText(
          `${structuredFallback.companySnapshot} ${structuredFallback.roleObjective}`,
          MAX_COMPANY_CONTEXT_LENGTH
        ),
        structured: structuredFallback,
      };
    }

    const candidateWordCount = candidateIntelText
      .split(/\s+/)
      .filter(Boolean).length;
    const hasCandidateDetails = candidateWordCount >= 18;
    const inferredNeedsCompanyDetails =
      Boolean(parsed.needsCompanyDetails) ||
      (!snippets.length && !hasCandidateDetails);

    const normalizedConfidence = ["high", "medium", "low"].includes(
      String(parsed.intelConfidence || "").toLowerCase()
    )
      ? String(parsed.intelConfidence).toLowerCase()
      : "medium";

    const structured = {
      companySnapshot: normalizeText(parsed.companySnapshot, 350),
      roleObjective: normalizeText(parsed.roleObjective, 280),
      mustHaveSkills: Array.isArray(parsed.mustHaveSkills)
        ? parsed.mustHaveSkills
            .map((s) => normalizeText(s, 80))
            .filter(Boolean)
            .slice(0, 15)
        : [],
      responsibilities: Array.isArray(parsed.responsibilities)
        ? parsed.responsibilities
            .map((s) => normalizeText(s, 150))
            .filter(Boolean)
            .slice(0, 10)
        : [],
      domainSignals: Array.isArray(parsed.domainSignals)
        ? parsed.domainSignals
            .map((s) => normalizeText(s, 120))
            .filter(Boolean)
            .slice(0, 8)
        : [],
      interviewFocus: Array.isArray(parsed.interviewFocus)
        ? parsed.interviewFocus
            .map((s) => normalizeText(s, 120))
            .filter(Boolean)
            .slice(0, 8)
        : [],
      intelConfidence:
        inferredNeedsCompanyDetails && normalizedConfidence === "high"
          ? "medium"
          : normalizedConfidence,
      needsCompanyDetails: inferredNeedsCompanyDetails,
      clarificationQuestion: normalizeText(
        parsed.clarificationQuestion ||
          "I need more company context before continuing. Please share website or LinkedIn details and what the company does.",
        220
      ),
      sourceMeta,
    };

    if (!structured.mustHaveSkills.length) {
      structured.mustHaveSkills = (application.job.techStack || [])
        .map((skill) => normalizeText(skill, 80))
        .filter(Boolean)
        .slice(0, 10);
    }

    const summary = normalizeText(
      `${structured.companySnapshot} ${structured.roleObjective}`,
      MAX_COMPANY_CONTEXT_LENGTH
    );

    return { summary, structured };
  } catch {
    const fallback = buildFallbackJobContext(application);
    const structuredFallback = { ...fallback, sourceMeta };
    return {
      summary: normalizeText(
        `${structuredFallback.companySnapshot} ${structuredFallback.roleObjective}`,
        MAX_COMPANY_CONTEXT_LENGTH
      ),
      structured: structuredFallback,
    };
  }
}

function candidateProvidedCompanyContext(turns) {
  const candidateText = (turns || [])
    .filter((turn) => turn.role === "candidate")
    .map((turn) => String(turn.content || ""))
    .join(" ")
    .trim();

  if (!candidateText) return false;
  const hasUrl = /https?:\/\/|www\.|linkedin\.com|careers?\./i.test(candidateText);
  const wordCount = candidateText.split(/\s+/).filter(Boolean).length;
  return hasUrl || wordCount >= 30;
}

function getCompanyClarificationQuestion(room) {
  const question = room?.jobContext?.clarificationQuestion;
  if (question) return question;
  return "I need more verified company context before we continue. Please share the company website or LinkedIn page and what the company builds.";
}

function normalizeScore(value, min = 0, max = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed * 10) / 10));
}

function normalizeScorecard(raw = {}) {
  const dimensions = {};
  for (const key of SCORE_DIMENSIONS) {
    const current = raw?.dimensions?.[key] || raw?.[key] || {};
    dimensions[key] = {
      score: normalizeScore(current.score),
      feedback: normalizeText(current.feedback || "No feedback provided.", 360),
      whatWentRight: normalizeText(current.whatWentRight || "", 220),
      whatToImprove: normalizeText(current.whatToImprove || "", 220),
    };
  }

  const overallScore = normalizeScore(
    raw?.overallScore ??
      ((dimensions.technicalDepth.score +
        dimensions.ownership.score +
        dimensions.communication.score) /
        3) *
        10,
    0,
    100
  );

  return {
    overallScore,
    summary: normalizeText(raw?.summary || "Interview completed.", 420),
    dimensions,
    strengths: Array.isArray(raw?.strengths)
      ? raw.strengths.map((item) => normalizeText(item, 180)).filter(Boolean).slice(0, 8)
      : [],
    mistakes: Array.isArray(raw?.mistakes)
      ? raw.mistakes
          .map((item) => ({
            issue: normalizeText(item?.issue, 180),
            why: normalizeText(item?.why, 220),
            betterApproach: normalizeText(item?.betterApproach, 220),
          }))
          .filter((item) => item.issue && item.betterApproach)
          .slice(0, 8)
      : [],
    nextSteps: Array.isArray(raw?.nextSteps)
      ? raw.nextSteps.map((item) => normalizeText(item, 180)).filter(Boolean).slice(0, 8)
      : [],
  };
}

function detectRoleTrack(application, room) {
  const source = [
    application?.job?.title,
    ...(application?.job?.techStack || []),
    application?.job?.description,
    room?.jobContext?.roleObjective,
    ...(room?.jobContext?.mustHaveSkills || []),
    ...(room?.jobContext?.interviewFocus || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (FRONTEND_FOCUS_REGEX.test(source)) return "frontend";
  if (BACKEND_FOCUS_REGEX.test(source)) return "backend";
  if (MOBILE_FOCUS_REGEX.test(source)) return "mobile";
  if (DEVOPS_FOCUS_REGEX.test(source)) return "devops";
  return "general";
}

function getQuestionStats(turns = []) {
  const aiQuestions = turns.filter((turn) => turn.role === "ai");
  const lowered = aiQuestions.map((turn) => String(turn.content || "").toLowerCase());

  const projectCount = lowered.filter((q) => PROJECT_BIAS_REGEX.test(q)).length;
  const frontendCount = lowered.filter((q) => FRONTEND_FOCUS_REGEX.test(q)).length;
  const backendCount = lowered.filter((q) => BACKEND_FOCUS_REGEX.test(q)).length;

  return {
    total: aiQuestions.length,
    projectCount,
    frontendCount,
    backendCount,
    aiQuestions: lowered,
  };
}

function pickUncoveredSkill(mustHaveSkills = [], askedQuestions = []) {
  const normalizedAsked = askedQuestions.join(" ");
  const cleanSkills = mustHaveSkills
    .map((skill) => normalizeText(skill, 80))
    .filter(Boolean)
    .slice(0, 20);

  for (const skill of cleanSkills) {
    if (!normalizedAsked.includes(skill.toLowerCase())) {
      return skill;
    }
  }
  return cleanSkills[0] || null;
}

function getQuestionPolicy({ application, room, turns = [] }) {
  const roleTrack = detectRoleTrack(application, room);
  const stats = getQuestionStats(turns);
  const nextQuestionIndex = Number(room?.questionCount || 0) + 1;
  const maxQuestions = Number(room?.maxQuestions || DEFAULT_MAX_QUESTIONS);
  const mustHaveSkills = [
    ...(room?.jobContext?.mustHaveSkills || []),
    ...(application?.job?.techStack || []),
  ];
  const uncoveredSkill = pickUncoveredSkill(mustHaveSkills, stats.aiQuestions);

  const earlyTechnicalPhaseLimit = Math.min(3, Math.max(2, Math.ceil(maxQuestions * 0.4)));
  const earlyTechnicalPhase = nextQuestionIndex <= earlyTechnicalPhaseLimit;
  const allowProjectFollowup = !earlyTechnicalPhase && nextQuestionIndex % 3 === 0;

  const roleCorpus = [
    application?.job?.title,
    ...(application?.job?.techStack || []),
    application?.job?.description,
    room?.jobContext?.roleObjective,
    ...(room?.jobContext?.mustHaveSkills || []),
    ...(room?.jobContext?.responsibilities || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const frontendInfraCorpus = [
    ...(application?.job?.techStack || []),
    ...(room?.jobContext?.mustHaveSkills || []),
    ...(room?.jobContext?.responsibilities || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const frontendInfraExplicitlyRequired = INFRA_HEAVY_REGEX.test(frontendInfraCorpus);

  const infraAllowed =
    roleTrack === "frontend"
      ? frontendInfraExplicitlyRequired && !earlyTechnicalPhase
      : roleTrack !== "frontend" || INFRA_HEAVY_REGEX.test(roleCorpus);

  const forceRoleSpecific =
    roleTrack === "frontend"
      ? stats.frontendCount < Math.max(1, Math.floor((stats.total + 1) * 0.65))
      : roleTrack === "backend"
      ? stats.backendCount < Math.max(1, Math.floor((stats.total + 1) * 0.6))
      : false;

  const hardRules = [
    `Question #${nextQuestionIndex} in the interview.`,
    roleTrack !== "general"
      ? `Primary track is ${roleTrack.toUpperCase()}; question must be ${roleTrack}-specific.`
      : "Primary track is GENERAL; stay role-specific using job stack.",
    `Project-history style questions asked so far: ${stats.projectCount}.`,
    earlyTechnicalPhase
      ? "This is EARLY TECHNICAL PHASE: ask direct role-stack implementation/debug scenario."
      : "Mid/late phase: you may ask selective project-depth follow-ups tied to role stack.",
    allowProjectFollowup
      ? "A short project follow-up is allowed this turn, but still tie it to job stack."
      : "Do NOT ask generic project/background questions this turn.",
    !infraAllowed
      ? roleTrack === "frontend"
        ? "Do NOT ask backend-infra/distributed-system topics on this turn. Stay on frontend implementation and debugging."
        : "Do NOT ask infra/distributed-system topics unless required by the job."
      : roleTrack === "frontend"
      ? "Infra/distributed-system follow-up is allowed only now because it is explicitly required in the selected job context."
      : "Infra topics are allowed only if directly tied to listed job requirements.",
    uncoveredSkill
      ? `Prefer targeting this uncovered required skill: ${uncoveredSkill}.`
      : "Target a concrete must-have skill from the job stack.",
    "Ask scenario/implementation/debug/tradeoff questions over biography prompts.",
  ];

  return {
    roleTrack,
    nextQuestionIndex,
    earlyTechnicalPhase,
    allowProjectFollowup,
    infraAllowed,
    frontendInfraExplicitlyRequired,
    forceRoleSpecific,
    uncoveredSkill,
    hardRules,
  };
}

function questionViolatesPolicy(question, policy) {
  const text = String(question || "");
  if (!text) return true;

  if (!policy.allowProjectFollowup && PROJECT_BIAS_REGEX.test(text)) {
    return true;
  }

  if (!policy.infraAllowed && INFRA_HEAVY_REGEX.test(text)) {
    return true;
  }

  if (
    policy.roleTrack === "frontend" &&
    policy.earlyTechnicalPhase &&
    INFRA_HEAVY_REGEX.test(text)
  ) {
    return true;
  }

  if (
    policy.roleTrack === "frontend" &&
    (policy.forceRoleSpecific || policy.earlyTechnicalPhase) &&
    !FRONTEND_FOCUS_REGEX.test(text)
  ) {
    return true;
  }

  return false;
}

async function getAuthedInternalUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      clerkUserId: true,
      name: true,
      bio: true,
      skills: true,
      industry: true,
    },
  });

  if (!user) throw new Error("User not found");
  return user;
}

async function buildOpeningQuestion({ application, room }) {
  if (room?.jobContext?.needsCompanyDetails) {
    return getCompanyClarificationQuestion(room);
  }

  const policy = getQuestionPolicy({ application, room, turns: room?.turns || [] });
  const model = getModel();
  const prompt = `
You are an expert technical interviewer.
Generate the opening interview question for a live interview room.

Context:
- Company: ${application.job.company}
- Role: ${application.job.title}
- Job tech stack: ${(application.job.techStack || []).join(", ") || "Not specified"}
- Job description: ${(application.job.description || "N/A").slice(0, 1200)}
- Candidate name: ${room.candidateName || "Candidate"}
- Candidate profile context: ${room.candidateContext || "Not provided yet"}
- Company research context: ${room.companyContext || "No additional company context"}
- Structured job intel:
${JSON.stringify(room.jobContext || {}, null, 2)}
- Question policy:
${policy.hardRules.map((rule) => `- ${rule}`).join("\n")}

Rules:
- Ask exactly one question.
- This must be role-specific, not generic.
- Anchor the question to required stack, responsibilities, or company context above.
- Never assume or invent company details not present in context.
- Do not ask "tell me about yourself" or broad background for opening.
- For frontend track: ask about UI architecture, rendering, state, performance, accessibility, or frontend debugging.
- For frontend track: avoid backend infra/distributed systems unless explicitly required in job stack.
- Keep it natural and conversational.
- Keep it under 45 words.
- Do not add numbering or markdown.
- Output only the question text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const question = String(result.response.text() || "")
      .replace(/```/g, "")
      .trim();
    if (question && !questionViolatesPolicy(question, policy)) return question;
    if (policy.roleTrack === "frontend") {
      return "For this frontend-leaning role, how would you structure a scalable React/Next.js UI architecture, including state management and performance strategy?";
    }
    return `How would you approach delivering strong outcomes in the ${application.job.title} role at ${application.job.company}, given the required stack?`;
  } catch {
    if (policy.roleTrack === "frontend") {
      return "For this frontend-leaning role, how would you structure a scalable React/Next.js UI architecture, including state management and performance strategy?";
    }
    return `How would you approach delivering strong outcomes in the ${application.job.title} role at ${application.job.company}, given the required stack?`;
  }
}

async function buildFollowupQuestion({ application, room, turns }) {
  if (room?.jobContext?.needsCompanyDetails && !candidateProvidedCompanyContext(turns)) {
    return getCompanyClarificationQuestion(room);
  }

  const policy = getQuestionPolicy({ application, room, turns });
  const model = getModel();
  const transcript = turns
    .slice(-MAX_CONTEXT_TURNS)
    .map((turn) => `${turn.role === "ai" ? "Interviewer" : "Candidate"}: ${turn.content}`)
    .join("\n");

  const prompt = `
You are an expert interviewer running a live interview.
Continue the interview with exactly one next question.

Interview context:
- Company: ${application.job.company}
- Role: ${application.job.title}
- Tech stack: ${(application.job.techStack || []).join(", ") || "Not specified"}
- Max questions: ${room.maxQuestions}
- Questions already asked: ${room.questionCount}
- Candidate profile context: ${room.candidateContext || "Not provided"}
- Company research context: ${room.companyContext || "No additional company context"}
- Structured job intel:
${JSON.stringify(room.jobContext || {}, null, 2)}
- Question policy:
${policy.hardRules.map((rule) => `- ${rule}`).join("\n")}

Conversation so far:
${transcript || "No prior transcript."}

Rules:
- Ask exactly one question, not a paragraph.
- This must be role-specific and grounded in the selected job.
- Use follow-up depth if candidate answer suggests specifics.
- Favor technical questions tied to the stack and project experience.
- Never invent company/product facts not present in context or transcript.
- Avoid repeatedly asking about past projects unless policy explicitly allows.
- If track is frontend, force frontend-specific technical depth.
- If frontend track and infra is not explicitly required, avoid Kafka/queue/event-sourcing/distributed-system prompts.
- Keep under 45 words.
- No bullets, no numbering, no markdown.
- Output only the question text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const question = String(result.response.text() || "")
      .replace(/```/g, "")
      .trim();
    if (question && !questionViolatesPolicy(question, policy)) return question;
    if (policy.roleTrack === "frontend") {
      return `Given ${policy.uncoveredSkill || "frontend stack"} requirements, how would you debug and optimize a slow, state-heavy UI without breaking UX and accessibility?`;
    }
    return "How would you solve a role-critical technical problem end-to-end, including tradeoffs and implementation choices?";
  } catch {
    if (policy.roleTrack === "frontend") {
      return `Given ${policy.uncoveredSkill || "frontend stack"} requirements, how would you debug and optimize a slow, state-heavy UI without breaking UX and accessibility?`;
    }
    return "How would you solve a role-critical technical problem end-to-end, including tradeoffs and implementation choices?";
  }
}

async function fetchRoomByCode(code) {
  return db.interviewMeetRoom.findUnique({
    where: { code: sanitizeRoomCode(code) },
    include: {
      application: {
        include: {
          job: true,
          user: {
            select: {
              id: true,
              name: true,
              bio: true,
              skills: true,
              industry: true,
            },
          },
        },
      },
      turns: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createInterviewMeetRoom(applicationId, config = {}) {
  try {
    const user = await getAuthedInternalUser();
    const code = await generateUniqueRoomCode();
    const maxQuestions = clampMaxQuestions(config?.maxQuestions);
    const candidateName = String(config?.candidateName || "").trim() || null;

    const application = await db.jobApplication.findFirst({
      where: {
        id: String(applicationId || ""),
        userId: user.id,
      },
      include: {
        job: true,
      },
    });

    if (!application) throw new Error("Job application not found.");

    const room = await db.interviewMeetRoom.create({
      data: {
        code,
        ownerUserId: user.id,
        applicationId: application.id,
        candidateName,
        maxQuestions,
        status: "WAITING",
      },
      include: {
        application: {
          include: {
            job: true,
          },
        },
      },
    });

    const fullRoom = await fetchRoomByCode(code);
    revalidatePath("/advanced/interview-simulator");

    return { success: true, room: fullRoom };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to create interview room.",
    };
  }
}

export async function listInterviewMeetRooms() {
  try {
    const user = await getAuthedInternalUser();

    const rooms = await db.interviewMeetRoom.findMany({
      where: { ownerUserId: user.id },
      include: {
        application: {
          include: {
            job: true,
          },
        },
        turns: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return { success: true, rooms };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to fetch rooms.",
    };
  }
}

export async function getInterviewMeetRoomByCode(code) {
  try {
    const roomCode = sanitizeRoomCode(code);
    if (!roomCode) throw new Error("Room code is required.");

    const room = await fetchRoomByCode(roomCode);
    if (!room) throw new Error("Room not found.");

    return { success: true, room };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to load room.",
    };
  }
}

export async function joinInterviewMeetRoom(code, candidateName = "") {
  try {
    const roomCode = sanitizeRoomCode(code);
    if (!roomCode) throw new Error("Room code is required.");

    const room = await db.interviewMeetRoom.findUnique({
      where: { code: roomCode },
      select: { id: true, candidateName: true },
    });
    if (!room) throw new Error("Room not found.");

    const nextCandidateName = String(candidateName || "").trim();
    if (nextCandidateName && nextCandidateName !== room.candidateName) {
      await db.interviewMeetRoom.update({
        where: { id: room.id },
        data: { candidateName: nextCandidateName },
      });
    }

    const fullRoom = await fetchRoomByCode(roomCode);
    return { success: true, room: fullRoom };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to join room.",
    };
  }
}

export async function startInterviewMeetRoom(code, payload = {}) {
  try {
    const roomCode = sanitizeRoomCode(code);
    if (!roomCode) throw new Error("Room code is required.");

    let room = await fetchRoomByCode(roomCode);
    if (!room) throw new Error("Room not found.");
    if (room.status === "COMPLETED") throw new Error("Interview is already completed.");

    const nextCandidateName = String(payload?.candidateName || room.candidateName || "").trim();
    const nextCandidateContext = normalizeText(
      payload?.candidateContext || room.candidateContext || "",
      MAX_CANDIDATE_CONTEXT_LENGTH
    );

    let companyContext = room.companyContext;
    let jobContext = room.jobContext;
    const shouldRefreshIntel =
      !companyContext ||
      !jobContext ||
      (Boolean(jobContext?.needsCompanyDetails) &&
        Boolean(nextCandidateContext) &&
        nextCandidateContext !== room.candidateContext) ||
      hasNewCompanyIntelUrls(room.application.job, nextCandidateContext, jobContext);

    if (shouldRefreshIntel) {
      const intel = await buildStructuredJobContext(room.application, {
        candidateContext: nextCandidateContext,
        turns: room.turns || [],
      });
      companyContext = intel.summary || companyContext || null;
      jobContext = intel.structured || jobContext || null;
    }

    const roomData = {
      status: "ACTIVE",
      startedAt: room.startedAt || new Date(),
      companyContext: companyContext || null,
      jobContext: jobContext || null,
      candidateContext: nextCandidateContext || null,
    };

    if (nextCandidateName) {
      roomData.candidateName = nextCandidateName;
    }

    await db.interviewMeetRoom.update({
      where: { id: room.id },
      data: roomData,
    });

    room = await fetchRoomByCode(roomCode);

    if (room.questionCount === 0) {
      const openingQuestion = await buildOpeningQuestion({
        application: room.application,
        room,
      });

      await db.interviewMeetTurn.create({
        data: {
          roomId: room.id,
          role: "ai",
          content: openingQuestion,
        },
      });

      await db.interviewMeetRoom.update({
        where: { id: room.id },
        data: { questionCount: 1 },
      });
    }

    const updatedRoom = await fetchRoomByCode(roomCode);
    revalidatePath("/advanced/interview-simulator");
    return { success: true, room: updatedRoom };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to start interview.",
    };
  }
}

export async function submitInterviewMeetAnswer(code, answer, payload = {}) {
  try {
    const roomCode = sanitizeRoomCode(code);
    const content = String(answer || "").trim();
    if (!roomCode) throw new Error("Room code is required.");
    if (!content) throw new Error("Answer is required.");

    let room = await fetchRoomByCode(roomCode);
    if (!room) throw new Error("Room not found.");
    if (room.status === "COMPLETED") throw new Error("Interview is already completed.");
    if (room.status !== "ACTIVE") throw new Error("Interview has not started yet.");

    const candidatePayload =
      typeof payload === "string" ? { candidateName: payload } : payload || {};
    const nextCandidateName = String(candidatePayload.candidateName || "").trim();
    const nextCandidateContext = normalizeText(
      candidatePayload.candidateContext || "",
      MAX_CANDIDATE_CONTEXT_LENGTH
    );

    const roomData = {};
    if (nextCandidateName && nextCandidateName !== room.candidateName) {
      roomData.candidateName = nextCandidateName;
    }
    if (nextCandidateContext && nextCandidateContext !== room.candidateContext) {
      roomData.candidateContext = nextCandidateContext;
    }

    if (Object.keys(roomData).length) {
      await db.interviewMeetRoom.update({
        where: { id: room.id },
        data: roomData,
      });
    }

    await db.interviewMeetTurn.create({
      data: {
        roomId: room.id,
        role: "candidate",
        content,
      },
    });

    room = await fetchRoomByCode(roomCode);
    const shouldRefreshIntel =
      !room.companyContext ||
      !room.jobContext ||
      (Boolean(room.jobContext?.needsCompanyDetails) &&
        candidateProvidedCompanyContext(room.turns)) ||
      hasNewCompanyIntelUrls(
        room.application.job,
        room.candidateContext || nextCandidateContext,
        room.jobContext
      );

    if (shouldRefreshIntel) {
      const intel = await buildStructuredJobContext(room.application, {
        candidateContext: room.candidateContext || nextCandidateContext,
        turns: room.turns || [],
      });

      await db.interviewMeetRoom.update({
        where: { id: room.id },
        data: {
          companyContext: intel.summary || room.companyContext || null,
          jobContext: intel.structured || room.jobContext || null,
        },
      });

      room = await fetchRoomByCode(roomCode);
    }

    const isFinalQuestionReached = room.questionCount >= room.maxQuestions;

    if (isFinalQuestionReached) {
      await db.interviewMeetTurn.create({
        data: {
          roomId: room.id,
          role: "ai",
          content:
            "Thanks for your time. This wraps up the interview. We will review your responses and share feedback soon.",
        },
      });

      await db.interviewMeetRoom.update({
        where: { id: room.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
        },
      });
    } else {
      const nextQuestion = await buildFollowupQuestion({
        application: room.application,
        room,
        turns: room.turns,
      });

      await db.interviewMeetTurn.create({
        data: {
          roomId: room.id,
          role: "ai",
          content: nextQuestion,
        },
      });

      await db.interviewMeetRoom.update({
        where: { id: room.id },
        data: {
          questionCount: {
            increment: 1,
          },
        },
      });
    }

    const updatedRoom = await fetchRoomByCode(roomCode);
    revalidatePath("/advanced/interview-simulator");

    return { success: true, room: updatedRoom };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to submit answer.",
    };
  }
}

export async function evaluateInterviewMeetRoom(code, options = {}) {
  try {
    const roomCode = sanitizeRoomCode(code);
    if (!roomCode) throw new Error("Room code is required.");

    const force = Boolean(options?.force);
    const room = await fetchRoomByCode(roomCode);
    if (!room) throw new Error("Room not found.");

    if (room.evaluation && !force) {
      return { success: true, room, evaluation: room.evaluation };
    }

    if (room.status !== "COMPLETED") {
      throw new Error("Complete the interview before generating scorecard.");
    }

    const candidateTurns = room.turns.filter((turn) => turn.role === "candidate");
    if (candidateTurns.length === 0) {
      throw new Error("No candidate answers found to evaluate.");
    }

    const transcript = room.turns
      .slice(-MAX_EVAL_CONTEXT_TURNS)
      .map((turn, idx) => `${idx + 1}. ${turn.role.toUpperCase()}: ${turn.content}`)
      .join("\n");

    const model = getModel();
    const prompt = `
You are a strict interview evaluator.
Score this transcript based on the selected role and context.

Role context:
- Company: ${room.application.job.company}
- Role: ${room.application.job.title}
- Tech stack: ${(room.application.job.techStack || []).join(", ") || "Not specified"}
- Job context: ${JSON.stringify(room.jobContext || {}, null, 2)}
- Candidate profile context: ${room.candidateContext || "Not provided"}

Transcript:
${transcript}

Return strict JSON only:
{
  "overallScore": 0-100,
  "summary": "short summary",
  "dimensions": {
    "technicalDepth": {
      "score": 0-10,
      "feedback": "text",
      "whatWentRight": "text",
      "whatToImprove": "text"
    },
    "ownership": {
      "score": 0-10,
      "feedback": "text",
      "whatWentRight": "text",
      "whatToImprove": "text"
    },
    "communication": {
      "score": 0-10,
      "feedback": "text",
      "whatWentRight": "text",
      "whatToImprove": "text"
    }
  },
  "strengths": ["bullet"],
  "mistakes": [
    {
      "issue": "what was weak/wrong",
      "why": "why this hurts interview performance",
      "betterApproach": "better way to answer next time"
    }
  ],
  "nextSteps": ["specific practice action"]
}

Rules:
- Be honest and specific.
- Use transcript evidence.
- Do not hallucinate facts that are not present.
- Keep mistakes constructive.
    `;

    let parsed;
    try {
      const result = await model.generateContent(prompt);
      parsed = tryParseJson(result.response.text());
    } catch {
      parsed = null;
    }

    const fallback = {
      overallScore: 65,
      summary:
        "Interview shows positive intent, but the candidate should improve technical depth and structured storytelling.",
      dimensions: {
        technicalDepth: {
          score: 6,
          feedback: "Some technical details were present but depth was inconsistent.",
          whatWentRight: "Mentioned relevant technologies and implementation attempts.",
          whatToImprove: "Explain architecture decisions, tradeoffs, and measurable outcomes.",
        },
        ownership: {
          score: 6,
          feedback: "Ownership signals exist but impact framing needs improvement.",
          whatWentRight: "Shared examples of contribution.",
          whatToImprove: "Highlight decisions you drove and outcomes you owned end-to-end.",
        },
        communication: {
          score: 7,
          feedback: "Generally understandable responses with room for tighter structure.",
          whatWentRight: "Stayed on-topic and collaborative in tone.",
          whatToImprove: "Use a clearer STAR-style flow and concise conclusions.",
        },
      },
      strengths: [
        "Maintained consistent engagement through the interview",
        "Referenced relevant project experience",
      ],
      mistakes: [
        {
          issue: "Answers sometimes lacked concrete metrics or impact.",
          why: "Interviewers cannot assess business/engineering impact without measurable outcomes.",
          betterApproach:
            "Add quantifiable results (latency, reliability, throughput, user impact) for each major project.",
        },
      ],
      nextSteps: [
        "Practice 5 project answers with architecture + tradeoff + impact format.",
        "Prepare 3 deep technical walkthroughs tied to target job stack.",
      ],
    };

    const evaluation = normalizeScorecard(parsed || fallback);

    await db.interviewMeetRoom.update({
      where: { id: room.id },
      data: {
        evaluation,
        evaluatedAt: new Date(),
      },
    });

    const updatedRoom = await fetchRoomByCode(roomCode);
    revalidatePath("/advanced/interview-simulator");
    revalidatePath("/dashboard");
    return { success: true, room: updatedRoom, evaluation };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to generate interview scorecard.",
    };
  }
}

export async function endInterviewMeetRoom(code) {
  try {
    const roomCode = sanitizeRoomCode(code);
    if (!roomCode) throw new Error("Room code is required.");

    const room = await db.interviewMeetRoom.findUnique({
      where: { code: roomCode },
      select: { id: true, status: true },
    });

    if (!room) throw new Error("Room not found.");
    if (room.status === "COMPLETED") {
      return getInterviewMeetRoomByCode(roomCode);
    }

    await db.interviewMeetTurn.create({
      data: {
        roomId: room.id,
        role: "ai",
        content:
          "The interview has been ended. Thanks for your time and responses.",
      },
    });

    await db.interviewMeetRoom.update({
      where: { id: room.id },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
      },
    });

    const updatedRoom = await fetchRoomByCode(roomCode);
    revalidatePath("/advanced/interview-simulator");
    return { success: true, room: updatedRoom };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to end interview.",
    };
  }
}
