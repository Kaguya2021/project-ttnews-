import cron from 'node-cron';
import { pool } from '../db/pool.js';
import { fetchAndStoreNews } from './rssFetcher.js';
import { bot } from '../bot/index.js';
import { InlineKeyboard } from 'grammy';

export function initScheduler() {
  // Сбор новостей каждые 3 часа
  cron.schedule('0 */3 * * *', async () => {
    console.log('Планировщик: запуск периодического сбора новостей...');
    try {
      await fetchAndStoreNews();
    } catch (err) {
      console.error('Ошибка в планировщике сбора новостей:', err);
    }
  });

  // Рассылка ежедневно в 09:00 по умолчанию
  cron.schedule('0 9 * * *', async () => {
    console.log('Планировщик: запуск ежедневной рассылки...');
    try {
      const usersRes = await pool.query('SELECT * FROM users WHERE subscribed = TRUE');
      const users = usersRes.rows;

      for (const user of users) {
        try {
          const newsRes = await pool.query(
            `SELECT n.* FROM news n 
             WHERE n.pub_date >= CURRENT_DATE - INTERVAL '1 day'
             AND n.id NOT IN (SELECT news_id FROM deliveries WHERE telegram_id = $1)
             ORDER BY n.score DESC LIMIT $2`,
            [user.telegram_id, user.news_count || 5]
          );

          const articles = newsRes.rows;
          if (articles.length === 0) continue;

          for (const item of articles) {
            const text = `🔥 **ЕЖЕДНЕВНЫЙ ДАЙЖЕСТ: ${item.title}**

📰 ${item.description || ''}

📊 **Оценка потенциала:** ${item.score}/100
🌐 **Источник:** ${item.source_name}`;

            const keyboard = new InlineKeyboard()
              .url('🔗 Читать источник', item.link).row()
              .text('🎬 Сценарий', `script_${item.id}`).row()
              .text('⭐ В избранное', `fav_add_${item.id}`)
              .text('👎 Не интересно', `news_skip_${item.id}`);

            await bot.api.sendMessage(user.telegram_id, text, {
              reply_markup: keyboard,
              parse_mode: 'Markdown'
            });

            await pool.query(
              `INSERT INTO deliveries (telegram_id, news_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
              [user.telegram_id, item.id]
            );

            // Пауза для соблюдения лимитов Telegram API
            await new Promise(res => setTimeout(res, 50));
          }
        } catch (userErr) {
          console.error(`Ошибка отправки пользователю ${user.telegram_id}:`, userErr.message);
        }
      }
      console.log('Ежедневная рассылка завершена :)');
    } catch (err) {
      console.error('Ошибка в процессе рассылки:', err);
    }
  });
}
