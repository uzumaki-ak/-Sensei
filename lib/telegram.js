const TELEGRAM_API_BASE = "https://api.telegram.org";

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");
  }
  return token;
}

export function escapeTelegramHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage({
  chatId,
  text,
  parseMode = "HTML",
  replyMarkup = null,
  disableWebPagePreview = true,
}) {
  if (!chatId) throw new Error("chatId is required");

  const botToken = getBotToken();
  const apiUrl = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: disableWebPagePreview,
  };

  if (parseMode) {
    body.parse_mode = parseMode;
  }
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.description || "Failed to send Telegram message.");
  }

  return payload;
}

export async function answerTelegramCallbackQuery({
  callbackQueryId,
  text,
  showAlert = false,
}) {
  if (!callbackQueryId) return;

  const botToken = getBotToken();
  const apiUrl = `${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.description || "Failed to answer callback query.");
  }

  return payload;
}
