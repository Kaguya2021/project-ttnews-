import dotenv from 'dotenv';
dotenv.config();

if (!process.env.BOT_TOKEN) {
  console.error('Ошибка: Не задан BOT_TOKEN в переменных окружения.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Ошибка: Не задан DATABASE_URL в переменных окружения.');
  process.exit(1);
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
};
