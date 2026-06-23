# GoHobby — Telegram webhook (вход в приложение)

Маленький Node-сервер, который заменяет Cloud Function. Firestore остаётся на
**бесплатном плане Spark** — Blaze НЕ нужен. Сервер пишет подтверждение входа в
`loginTokens/<token>`, откуда приложение читает его в реальном времени.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота из @BotFather (секрет) |
| `TELEGRAM_WEBHOOK_SECRET` | любая случайная строка (та же в `setWebhook`) |
| `PORT` | порт (PaaS задаёт сам; по умолчанию 8080) |

## Локальный запуск

```bash
cd server
npm install
cp .env.example .env   # впишите токен
node --env-file=.env index.js
```

## ⚠️ Telegram требует HTTPS

URL вебхука обязан быть `https://`. Поэтому удобнее платформа с автоматическим
HTTPS (Render / Timeweb Cloud / Amvera / Yandex), чем «голый» VPS.

## Вариант A — Render (бесплатно, без карты, авто-HTTPS) — рекомендуется

1. Залейте проект на GitHub.
2. render.com → New → **Web Service** → выберите репозиторий.
3. Root Directory: `server`; Build: `npm install`; Start: `node index.js`.
4. Environment → добавьте `TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET`.
5. Deploy → получите адрес вида `https://gohobby-webhook.onrender.com`.
6. Адрес вебхука: `https://<ваш-адрес>/telegram/webhook`.

(На бесплатном тарифе сервис «засыпает» — первый вход после паузы может занять
~30–60 сек, дальше быстро.)

## Вариант B — reg.ru / Timeweb VPS

1. Создайте VPS с Ubuntu, установите Node 18+.
2. Скопируйте папку `server`, `npm install`, задайте env (или `.env`), запустите
   через `pm2 start index.js`.
3. Поднимите домен + Let's Encrypt (nginx reverse-proxy на порт сервера),
   чтобы получить HTTPS. Адрес вебхука: `https://<домен>/telegram/webhook`.

## Привязка вебхука к боту (после деплоя)

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<ВАШ_АДРЕС>/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Ответ `{"ok":true}` — готово. Проверка статуса:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```
