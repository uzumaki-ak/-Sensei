import { google } from "googleapis";
import { db } from "@/lib/prisma";

function encodeMessage(raw) {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawMimeMessage({ recipientEmail, subject, body, attachment = null }) {
  if (attachment) {
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
      `--${boundary}--`,
    ];

    const raw = [
      `To: ${recipientEmail}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      messageParts.join("\r\n"),
    ].join("\r\n");

    return encodeMessage(raw);
  }

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const raw = [
    `To: ${recipientEmail}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    body,
  ].join("\n");

  return encodeMessage(raw);
}

function extractSubjectAndBody(draftEmail, fallbackTitle) {
  const subjectMatch = draftEmail.match(/\[?Subject:\s*(.+?)\]?(?:\r?\n|$)/i);
  const subject = subjectMatch?.[1]?.trim() || `Application for ${fallbackTitle}`;
  const body = draftEmail.replace(/\[?Subject:.*?(?:\r?\n|$)/i, "").trim();
  return { subject, body };
}

export async function sendOutreachEmailForUser({
  userId,
  applicationId,
  customEmail = null,
  attachmentId = null,
  requireAttachment = true,
}) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, gmailToken: true },
  });

  if (!user) {
    throw new Error("User not found");
  }
  if (!user.gmailToken) {
    throw new Error("Gmail not connected");
  }

  const application = await db.jobApplication.findFirst({
    where: { id: applicationId, userId },
    include: { job: true },
  });

  if (!application || !application.draftEmail) {
    throw new Error("No draft found");
  }

  const recipientEmail = customEmail || application.job.recruiterEmail;
  if (!recipientEmail) {
    throw new Error("Recruiter email is missing for this job. Add a valid email first.");
  }

  const resolvedAttachmentId = attachmentId || application.attachmentId;
  if (requireAttachment && !resolvedAttachmentId) {
    throw new Error("Resume attachment is required before sending.");
  }

  let attachment = null;
  if (resolvedAttachmentId) {
    attachment = await db.resumeAttachment.findFirst({
      where: {
        id: resolvedAttachmentId,
        applicationId: application.id,
      },
    });

    if (!attachment && requireAttachment) {
      throw new Error("Attached resume was not found. Upload it again.");
    }
  }

  const { subject, body } = extractSubjectAndBody(
    application.draftEmail,
    application.job.title
  );

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2Client.setCredentials(user.gmailToken);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const encodedMessage = buildRawMimeMessage({
    recipientEmail,
    subject,
    body,
    attachment,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  await db.jobApplication.update({
    where: { id: application.id },
    data: {
      status: "Applied",
      appliedAt: new Date(),
      emailSent: true,
      emailSentAt: new Date(),
      attachmentId: resolvedAttachmentId || application.attachmentId,
      attachmentName: attachment?.fileName || application.attachmentName,
    },
  });

  if (customEmail && customEmail !== application.job.recruiterEmail) {
    await db.jobListing.update({
      where: { id: application.job.id },
      data: { recruiterEmail: customEmail },
    });
  }

  return {
    applicationId: application.id,
    jobId: application.job.id,
    recipientEmail,
    attachmentId: resolvedAttachmentId || null,
  };
}
