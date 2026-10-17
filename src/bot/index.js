import { Bot } from 'grammy';
import { config } from '../config.js';
import { registerHandlers } from './handlers.js';

export const bot = new Bot(config.botToken);

// Глобальный обработчик ошибок, чтобы бот не крашился при сбоях
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`);
  const e = err.error;
  console.error('Детали ошибки:', e);
});

registerHandlers(bot);

export async function startBot() {
  await bot.init();
  console.log(`Бот @${bot.botInfo.username} запущен успешно :)`);
  bot.start();
}
