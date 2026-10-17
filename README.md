# 🚀 TikTokPulse — Telegram-бот популярных новостей

**TikTokPulse** — это автономный Telegram-бот на Node.js, который ежедневно парсит актуальные RSS-ленты новостей, оценивает потенциал их виральности по 100-балльной шкале и помогает создавать сценарии для TikTok / Shorts / Reels.

---

## 🛠 Технологии и стек

* **Runtime:** Node.js LTS (ES Modules)
* **Bot Framework:** grammY
* **Database:** Neon PostgreSQL (pg)
* **RSS Parser:** rss-parser
* **Scheduler:** node-cron
* **Server:** Express (для Health Check на хостингах)

---

## 📁 Структура проекта

```text
TikTokPulse/
├── package.json          # Зависимости и скрипты
├── .env.example          # Шаблон переменных окружения
├── README.md             # Документация проекта
└── src/
    ├── index.js          # Точка входа (запуск сервера, бота и планировщика)
    ├── config.js         # Конфигурация и валидация env
    ├── db/
    │   ├── pool.js       # Пул подключения к PostgreSQL
    │   └── migrate.js    # Автоматические миграции и сиды
    ├── services/
    │   ├── rssFetcher.js # Парсинг и сохранение RSS-новостей
    │   ├── newsScorer.js # Эвристическая оценка новостей (0–100)
    │   ├── scriptGen.js  # Генератор видеосценариев 9:16
    │   └── scheduler.js  # Планировщик автосбора и рассылки
    └── bot/
        ├── index.js      # Инициализация бота
        ├── keyboards.js  # Inline-клавиатуры и меню
        └── handlers.js   # Обработчики команд и инлайн-кнопок
