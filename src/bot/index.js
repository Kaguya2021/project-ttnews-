import { Bot } from 'grammy';
import { config } from '../config.js';
import { registerHandlers } from './handlers.js';

export const bot = new Bot(config.botToken);

registerHandlers(bot);

export async function startBot() {
  await bot.init();
  console.log(`Бот @${bot.botInfo.username} запущен успешно :)`);
  bot.start();
}
