// GoHobby — вебхук Telegram-бота для входа в приложение.
// Запускается на любом Node-хостинге (VPS reg.ru/Timeweb, Render, Railway,
// Yandex Cloud и т.п.). Использует публичный конфиг Firebase (как и приложение)
// и пишет подтверждённую личность в Firestore (loginTokens/<token>),
// откуда её в реальном времени читает приложение.
//
// Переменные окружения:
//   TELEGRAM_BOT_TOKEN       — токен бота из @BotFather (СЕКРЕТ)
//   TELEGRAM_WEBHOOK_SECRET  — любая случайная строка (тот же секрет в setWebhook)
//   PORT                     — порт (по умолчанию 8080)

import express from 'express';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!BOT_TOKEN) {
  console.error('❌ Не задан TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

// Публичный конфиг Firebase — тот же, что в приложении (не секрет).
const firebaseConfig = {
  apiKey: 'AIzaSyCevBKAfx977QA0mwmCVd-9MCu3CVWLjIU',
  authDomain: 'go-hobby.firebaseapp.com',
  projectId: 'go-hobby',
  storageBucket: 'go-hobby.firebasestorage.app',
  messagingSenderId: '678848968863',
  appId: '1:678848968863:web:b53df52b9af310271c0aaa',
};
const db = getFirestore(initializeApp(firebaseConfig));

async function sendTelegramMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.warn('sendMessage failed:', e);
  }
}

const app = express();
app.use(express.json());

// Health-check (можно открыть в браузере, чтобы проверить, что сервер жив).
app.get('/', (_req, res) => res.send('GoHobby Telegram webhook: OK'));

app.post('/telegram/webhook', async (req, res) => {
  // Проверяем, что запрос реально от Telegram (секретный заголовок из setWebhook).
  if (WEBHOOK_SECRET && req.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const update = req.body || {};
    const msg = update.message;
    const text = (msg && msg.text) || '';
    const from = (msg && msg.from) || null;

    if (from && text.startsWith('/start')) {
      const loginToken = text.split(/\s+/)[1];
      if (loginToken) {
        await setDoc(
          doc(db, 'loginTokens', loginToken),
          {
            status: 'confirmed',
            telegram: {
              id: String(from.id),
              firstName: from.first_name || '',
              lastName: from.last_name || '',
              username: from.username || '',
            },
            confirmedAt: Date.now(),
          },
          { merge: true },
        );
        await sendTelegramMessage(
          from.id,
          '✅ Готово! Возвращайтесь в приложение GoHobby — вход выполнен.',
        );
      } else {
        await sendTelegramMessage(
          from.id,
          'Привет! Чтобы войти, откройте «Войти через Telegram» в приложении GoHobby.',
        );
      }
    }
  } catch (e) {
    console.error('webhook error:', e);
  }

  // Telegram всегда ждёт 200, иначе будет повторять запрос.
  res.status(200).send('ok');
});

app.listen(PORT, () => console.log(`✅ GoHobby webhook слушает порт ${PORT}`));
