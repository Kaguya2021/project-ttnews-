import express from 'express';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { startBot } from './bot/index.js';
import { fetchAndStoreNews } from './services/rssFetcher.js';
import { initScheduler } from './services/scheduler.js';

const app = express();

app.get('/', (req, res) => {
  res.send('TikTokPulse Bot is running active and healthy :)');
});

async function main() {
  try {
    console.log('Инициализация приложения TikTokPulse...');
    await runMigrations();
    
    // Первичный сбор новостей при старте
    await fetchAndStoreNews().catch(err => console.error('Первичный сбор пропущен:', err.message));

    // Запуск планировщика
    initScheduler();

    // Запуск бота
    await startBot();

    // Запуск HTTP сервера для Render Health Check
    app.listen(config.port, () => {
      console.log(`HTTP сервер запущен на порту ${config.port}`);
    });
  } catch (err) {
    console.error('Критическая ошибка запуска:', err);
    process.exit(1);
  }
}

main();
