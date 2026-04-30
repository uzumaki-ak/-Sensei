import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { sendOutreachEmailForUser } from "@/lib/outreach-email";
import { generateEmailWithResume } from "@/lib/resume-selector";
import {
  answerTelegramCallbackQuery,
  escapeTelegramHtml,
  sendTelegramMessage,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

const PENDING_STATUSES = new Set(["PENDING", "AWAITING_FEEDBACK"]);

function parseCallbackData(data) {
  const [action = "", sessionId = ""] = String(data || "").split(":");
  return { action, sessionId };
}

function isSessionExpired(session) {
  if (!session?.expiresAt) return false;
  return Date.now() > new Date(session.expiresAt).getTime();
}

function extractEmailSubjectAndBody(draftEmail, fallbackTitle) {
  const subjectMatch = String(draftEmail || "").match(/\[?Subject:\s*(.+?)\]?(?:\r?\n|$)/i);
  const subject = subjectMatch?.[1]?.trim() || `Application for ${fallbackTitle || "the role"}`;
  const body = String(draftEmail || "").replace(/\[?Subject:.*?(?:\r?\n|$)/i, "").trim();
  return { subject, body };
}

function truncateText(value, max = 700) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function buildApprovalKeyboard(sessionId) {
  return {
    inline_keyboard: [
      [
        { text: "Approve & Send", callback_data: `approve:${sessionId}` },
        { text: "Ask Redraft", callback_data: `redraft:${sessionId}` },
      ],
      [{ text: "Cancel", callback_data: `cancel:${sessionId}` }],
    ],
  };
}

function isWebhookSecretValid(request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  return provided === expected;
}

async function loadSessionForChat(sessionId, chatId) {
  return db.telegramApprovalSession.findFirst({
    where: {
      id: sessionId,
      chatId: String(chatId),
    },
    include: {
      application: {
        include: {
          job: true,
          resume: true,
        },
      },
    },
  });
}

async function notifyDraftPreview(session, draftEmail, attachmentName = "Attached resume") {
  const { subject, body } = extractEmailSubjectAndBody(
    draftEmail,
    session?.application?.job?.title
  );

  const message = [
    "<b>Updated Draft Ready</b>",
    "",
    `<b>Role:</b> ${escapeTelegramHtml(session.application.job.title)}`,
    `<b>Company:</b> ${escapeTelegramHtml(session.application.job.company)}`,
    `<b>To:</b> ${escapeTelegramHtml(session.recipientEmail || "Not set")}`,
    `<b>Resume:</b> ${escapeTelegramHtml(attachmentName)}`,
    "",
    `<b>Subject</b>\n${escapeTelegramHtml(subject)}`,
    "",
    "<b>Draft Preview</b>",
    escapeTelegramHtml(truncateText(body, 700)),
    "",
    "Approve to send, or tap Ask Redraft and reply with changes.",
  ].join("\n");

  await sendTelegramMessage({
    chatId: session.chatId,
    text: message,
    parseMode: "HTML",
    replyMarkup: buildApprovalKeyboard(session.id),
  });
}

async function handleApproveAction({ callbackQueryId, chatId, session }) {
  if (!session) {
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Session not found.",
      showAlert: true,
    });
    return;
  }

  if (isSessionExpired(session)) {
    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED" },
    });
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Approval session expired. Create a new one from dashboard.",
      showAlert: true,
    });
    return;
  }

  if (!PENDING_STATUSES.has(session.status)) {
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "This session is already closed.",
      showAlert: true,
    });
    return;
  }

  try {
    const sent = await sendOutreachEmailForUser({
      userId: session.userId,
      applicationId: session.applicationId,
      customEmail: session.recipientEmail || null,
      attachmentId: session.attachmentId || null,
      requireAttachment: true,
    });

    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: {
        status: "APPROVED_SENT",
        sentAt: new Date(),
      },
    });

    try {
      await pusherServer.trigger(`user-${session.userId}`, "email-sent", {
        applicationId: sent.applicationId,
        jobId: sent.jobId,
      });
    } catch (error) {
      console.error("[TelegramWebhook] Pusher email-sent failed:", error?.message || error);
    }

    await sendTelegramMessage({
      chatId,
      text: [
        "<b>Email sent successfully</b>",
        "",
        `<b>Role:</b> ${escapeTelegramHtml(session.application.job.title)}`,
        `<b>Company:</b> ${escapeTelegramHtml(session.application.job.company)}`,
        `<b>To:</b> ${escapeTelegramHtml(sent.recipientEmail)}`,
      ].join("\n"),
      parseMode: "HTML",
    });

    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Sent.",
    });
  } catch (error) {
    console.error("[TelegramWebhook] Approve send failed:", error);

    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: { status: "FAILED" },
    });

    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Send failed.",
      showAlert: true,
    });

    await sendTelegramMessage({
      chatId,
      text: [
        "<b>Send failed</b>",
        "",
        escapeTelegramHtml(error?.message || "Unknown error"),
        "",
        "Open dashboard and re-request approval after fixing it.",
      ].join("\n"),
      parseMode: "HTML",
    });
  }
}

async function handleRedraftAction({ callbackQueryId, chatId, session }) {
  if (!session) {
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Session not found.",
      showAlert: true,
    });
    return;
  }

  if (isSessionExpired(session)) {
    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED" },
    });
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Session expired. Create a new approval request.",
      showAlert: true,
    });
    return;
  }

  await db.telegramApprovalSession.update({
    where: { id: session.id },
    data: { status: "AWAITING_FEEDBACK" },
  });

  await answerTelegramCallbackQuery({
    callbackQueryId,
    text: "Send your draft changes now.",
  });

  await sendTelegramMessage({
    chatId,
    text: [
      "<b>Redraft mode enabled</b>",
      "",
      "Reply with your exact edits.",
      "Example: Make it shorter, include GitHub and portfolio in closing, and sound more direct.",
    ].join("\n"),
    parseMode: "HTML",
  });
}

async function handleCancelAction({ callbackQueryId, chatId, session }) {
  if (!session) {
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Session not found.",
      showAlert: true,
    });
    return;
  }

  await db.telegramApprovalSession.update({
    where: { id: session.id },
    data: { status: "CANCELLED" },
  });

  await answerTelegramCallbackQuery({
    callbackQueryId,
    text: "Cancelled.",
  });

  await sendTelegramMessage({
    chatId,
    text: "Approval request cancelled. You can create a new one from dashboard.",
    parseMode: null,
  });
}

async function handleCallbackQuery(update) {
  const callbackQuery = update?.callback_query;
  const callbackQueryId = callbackQuery?.id;
  const chatId = callbackQuery?.message?.chat?.id;
  const data = callbackQuery?.data;
  const { action, sessionId } = parseCallbackData(data);

  if (!chatId || !sessionId) {
    if (callbackQueryId) {
      await answerTelegramCallbackQuery({
        callbackQueryId,
        text: "Invalid action payload.",
        showAlert: true,
      });
    }
    return;
  }

  const session = await loadSessionForChat(sessionId, chatId);

  if (action === "approve") {
    await handleApproveAction({ callbackQueryId, chatId, session });
    return;
  }
  if (action === "redraft") {
    await handleRedraftAction({ callbackQueryId, chatId, session });
    return;
  }
  if (action === "cancel") {
    await handleCancelAction({ callbackQueryId, chatId, session });
    return;
  }

  if (callbackQueryId) {
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Unknown action.",
      showAlert: true,
    });
  }
}

async function handleFeedbackMessage(update) {
  const message = update?.message;
  const chatId = String(message?.chat?.id || "");
  const text = String(message?.text || "").trim();

  if (!chatId || !text || text.startsWith("/")) {
    return;
  }

  const session = await db.telegramApprovalSession.findFirst({
    where: {
      chatId,
      status: "AWAITING_FEEDBACK",
    },
    include: {
      application: {
        include: {
          job: true,
          resume: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return;
  }

  if (isSessionExpired(session)) {
    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED" },
    });
    await sendTelegramMessage({
      chatId,
      text: "This approval session expired. Create a new one from dashboard.",
      parseMode: null,
    });
    return;
  }

  if (text.length < 8) {
    await sendTelegramMessage({
      chatId,
      text: "Please send more specific feedback so I can redraft properly.",
      parseMode: null,
    });
    return;
  }

  const resumeId = session.resumeId || session.application.resumeId;
  if (!resumeId) {
    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: { status: "FAILED" },
    });
    await sendTelegramMessage({
      chatId,
      text: "No resume profile found for this draft. Regenerate draft from dashboard first.",
      parseMode: null,
    });
    return;
  }

  try {
    const redraft = await generateEmailWithResume(session.applicationId, resumeId, {
      userFeedback: text,
    });

    const attachment = session.attachmentId
      ? await db.resumeAttachment.findFirst({
          where: {
            id: session.attachmentId,
            userId: session.userId,
          },
        })
      : null;

    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: {
        status: "PENDING",
        feedback: text,
        resumeId,
      },
    });

    try {
      await pusherServer.trigger(`user-${session.userId}`, "email-drafted", {
        applicationId: session.applicationId,
        resumeId,
        jobId: session.application.jobId,
      });
    } catch (error) {
      console.error("[TelegramWebhook] Pusher email-drafted failed:", error?.message || error);
    }

    await notifyDraftPreview(
      session,
      redraft.draftEmail,
      attachment?.fileName || "Attached resume"
    );
  } catch (error) {
    console.error("[TelegramWebhook] Redraft failed:", error);
    await db.telegramApprovalSession.update({
      where: { id: session.id },
      data: { status: "FAILED" },
    });
    await sendTelegramMessage({
      chatId,
      text: [
        "<b>Redraft failed</b>",
        "",
        escapeTelegramHtml(error?.message || "Unknown error"),
      ].join("\n"),
      parseMode: "HTML",
    });
  }
}

export async function POST(request) {
  if (!isWebhookSecretValid(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await request.json();

    if (update?.callback_query) {
      await handleCallbackQuery(update);
    } else if (update?.message?.text) {
      await handleFeedbackMessage(update);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[TelegramWebhook] Unexpected error:", error);
    return NextResponse.json({ ok: true });
  }
}
