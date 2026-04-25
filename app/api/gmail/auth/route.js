import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const { userId: clerkUserId } = await auth();

  if (!code || !clerkUserId) {
    return NextResponse.redirect(new URL("/jobs/kanban?error=auth_failed", request.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Find our local user
    const user = await db.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) throw new Error("User not found");

    // Persist tokens
    await db.user.update({
      where: { id: user.id },
      data: { gmailToken: tokens },
    });

    // Success! Redirect back to the jobs board
    return NextResponse.redirect(new URL("/jobs/kanban?success=gmail_connected", request.url));
  } catch (error) {
    console.error("Gmail Auth Error:", error);
    return NextResponse.redirect(new URL("/jobs/kanban?error=token_exchange_failed", request.url));
  }
}
