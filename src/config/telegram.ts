// Имя Telegram-бота (без @), через которого выполняется вход.
// Токен бота здесь НЕ хранится — он только в секрете Cloud Functions.
export const TELEGRAM_BOT_USERNAME = 'go_hobby_bot';

// Ссылка для запуска бота с одноразовым токеном входа.
export function telegramLoginLink(loginToken: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${loginToken}`;
}
