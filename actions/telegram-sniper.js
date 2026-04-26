"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

/**
 * Saves Telegram Chat ID and verifies bot access via a test message.
 */
export async function connectTelegramSniper(chatId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const normalizedChatId = String(chatId || "").trim();
    if (!normalizedChatId) {
      throw new Error("Chat ID is required.");
    }
    if (!/^-?\d+$/.test(normalizedChatId)) {
      throw new Error("Chat ID must be numeric. Example: 123456789");
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: normalizedChatId,
        text: "Connection successful. Midnight Job Hunt alerts are now enabled for this chat.",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Telegram API Error: ${errorData.description || "Failed to send message."}`
      );
    }

    await db.user.update({
      where: { clerkUserId: userId },
      data: { telegramChatId: normalizedChatId },
    });

    return {
      success: true,
      message: "Telegram Sniper connected successfully!",
    };
  } catch (error) {
    console.error("[Telegram Connection Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred.",
    };
  }
}

export async function getTelegramSniperStatus() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { telegramChatId: true },
    });
    if (!user) throw new Error("User not found");

    return {
      success: true,
      isConnected: Boolean(user.telegramChatId),
      chatId: user.telegramChatId || "",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to load Telegram status.",
      isConnected: false,
      chatId: "",
    };
  }
}

/**
 * Disconnects Telegram sniper.
 */
export async function disconnectTelegramSniper() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    await db.user.update({
      where: { clerkUserId: userId },
      data: { telegramChatId: null },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

