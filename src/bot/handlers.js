import { pool } from '../db/pool.js';
import { getMainMenuKeyboard, getNewsActionKeyboard, getSettingsKeyboard } from './keyboards.js';
import { generateTikTokScript } from '../services/scriptGen.js';

export async function registerHandlers(bot) {
  // Регистрация пользователя при /start
  bot.command('start', async (ctx) => {
    const user = ctx.from;
    await pool.query(
      `INSERT INTO users (telegram_id, username, first_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id) DO UPDATE 
       SET username = EXCLUDED.username, first_name = EXCLUDED.first_name;`,
      [user.id, user.username, user.first_name]
    );

    const welcomeText = `👋 Привет! Я TikTokPulse — твой ежедневный радар интересных новостей.

Каждый день я подбираю свежие темы, из которых можно сделать интересные TikTok-видео. Никакого информационного мусора — только отобранные события и идеи для контента :)`;

    await ctx.reply(welcomeText, { reply_markup: getMainMenuKeyboard() });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(`📖 **Инструкция по использованию TikTokPulse:**

/start — Главное меню
/news — Последние интересные новости
/today — Подборка за сегодня
/ai — Новости искусственного интеллекта
/tech — Технологии и гаджеты
/games — Игровые новости
/trends — Интернет-тренды
/ideas — Идеи для TikTok-видео
/favorites — Сохранённые новости
/settings — Настройки рассылки
/subscribe / /unsubscribe — Управление подпиской`, { parse_mode: 'Markdown' });
  });

  bot.command('news', async (ctx) => sendNewsList(ctx, null, 5));
  bot.command('today', async (ctx) => sendNewsList(ctx, null, 5, true));
  bot.command('ai', async (ctx) => sendNewsList(ctx, 'ai', 5));
  bot.command('tech', async (ctx) => sendNewsList(ctx, 'tech', 5));
  bot.command('games', async (ctx) => sendNewsList(ctx, 'games', 5));
  bot.command('trends', async (ctx) => sendNewsList(ctx, 'trends', 5));

  bot.command('ideas', async (ctx) => {
    await ctx.reply('🎬 Нажмите кнопку «🎬 Сценарий» под любой понравившейся новостью, чтобы мгновенно сгенерировать готовый план для вертикального видео!');
  });

  bot.command('favorites', async (ctx) => {
    const res = await pool.query(
      `SELECT n.* FROM news n JOIN favorites f ON n.id = f.news_id WHERE f.telegram_id = $1 ORDER BY f.created_at DESC LIMIT 10`,
      [ctx.from.id]
    );
    if (res.rows.length === 0) {
      await ctx.reply('⭐ У вас пока нет сохранённых новостей в избранном.');
      return;
    }
    await ctx.reply('⭐ **Ваше избранное:**');
    for (const item of res.rows) {
      await formatAndSendNews(ctx, item);
    }
  });

  bot.command('settings', async (ctx) => {
    const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [ctx.from.id]);
    const user = userRes.rows[0];
    await ctx.reply('⚙️ **Настройки пользователя:**', { reply_markup: getSettingsKeyboard(user), parse_mode: 'Markdown' });
  });

  bot.command('subscribe', async (ctx) => {
    await pool.query('UPDATE users SET subscribed = TRUE WHERE telegram_id = $1', [ctx.from.id]);
    await ctx.reply('✅ Ежедневная рассылка успешно включена :)');
  });

  bot.command('unsubscribe', async (ctx) => {
    await pool.query('UPDATE users SET subscribed = FALSE WHERE telegram_id = $1', [ctx.from.id]);
    await ctx.reply('❌ Ежедневная рассылка отключена.');
  });

  // Обработка инлайн-кнопок меню
  bot.callbackQuery('menu_news', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendNewsList(ctx, null, 5);
  });

  bot.callbackQuery('menu_today', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendNewsList(ctx, null, 5, true);
  });

  bot.callbackQuery(/^cat_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const category = ctx.match[1];
    await sendNewsList(ctx, category, 5);
  });

  bot.callbackQuery('menu_ideas', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('💡 Выберите новость в ленте и нажмите кнопку «🎬 Сценарий».');
  });

  bot.callbackQuery('menu_favorites', async (ctx) => {
    await ctx.answerCallbackQuery();
    const res = await pool.query(
      `SELECT n.* FROM news n JOIN favorites f ON n.id = f.news_id WHERE f.telegram_id = $1 ORDER BY f.created_at DESC LIMIT 5`,
      [ctx.from.id]
    );
    if (res.rows.length === 0) {
      await ctx.reply('⭐ У вас пока нет избранных новостей.');
      return;
    }
    for (const item of res.rows) {
      await formatAndSendNews(ctx, item);
    }
  });

  bot.callbackQuery('menu_settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [ctx.from.id]);
    const user = userRes.rows[0];
    await ctx.editMessageText('⚙️ **Настройки пользователя:**', { reply_markup: getSettingsKeyboard(user), parse_mode: 'Markdown' });
  });

  bot.callbackQuery('toggle_sub', async (ctx) => {
    const userRes = await pool.query('SELECT subscribed FROM users WHERE telegram_id = $1', [ctx.from.id]);
    const newState = !userRes.rows[0].subscribed;
    await pool.query('UPDATE users SET subscribed = $1 WHERE telegram_id = $2', [newState, ctx.from.id]);
    const updatedUser = (await pool.query('SELECT * FROM users WHERE telegram_id = $1', [ctx.from.id])).rows[0];
    await ctx.editMessageText('⚙️ **Настройки пользователя:**', { reply_markup: getSettingsKeyboard(updatedUser), parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery(`Рассылка ${newState ? 'включена' : 'выключена'}`);
  });

  bot.callbackQuery('main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('👋 Главное меню TikTokPulse:', { reply_markup: getMainMenuKeyboard() });
  });

  // Действия со сценариями и избранным
  bot.callbackQuery(/^script_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Генерация сценария...');
    const newsId = ctx.match[1];
    const res = await pool.query('SELECT * FROM news WHERE id = $1', [newsId]);
    if (res.rows.length === 0) {
      await ctx.reply('Новость не найдена.');
      return;
    }
    const script = generateTikTokScript(res.rows[0]);
    await ctx.reply(script, { parse_mode: 'Markdown' });
  });

  bot.callbackQuery(/^fav_add_(\d+)$/, async (ctx) => {
    const newsId = ctx.match[1];
    try {
      await pool.query(
        `INSERT INTO favorites (telegram_id, news_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [ctx.from.id, newsId]
      );
      await ctx.answerCallbackQuery('⭐ Добавлено в избранное!');
    } catch {
      await ctx.answerCallbackQuery('Уже в избранном :)');
    }
  });

  bot.callbackQuery(/^news_skip_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Скрыто');
    await ctx.deleteMessage().catch(() => {});
  });
}

async function sendNewsList(ctx, category = null, limit = 5, onlyToday = false) {
  let query = 'SELECT * FROM news';
  let params = [];
  let conditions = [];

  if (category) {
    conditions.push(`category = $${params.length + 1}`);
    params.push(category);
  }

  if (onlyToday) {
    conditions.push(`pub_date >= CURRENT_DATE`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` ORDER BY pub_date DESC, score DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const res = await pool.query(query, params);
  const newsList = res.rows;

  if (newsList.length === 0) {
    await ctx.reply('📭 По вашему запросу свежих новостей пока нет. Попробуйте позже :)');
    return;
  }

  for (const item of newsList) {
    await formatAndSendNews(ctx, item);
  }
}

async function formatAndSendNews(ctx, item) {
  const text = `🔥 **${item.title}**

📰 **Что произошло?**
${item.description || 'Описание отсутствует.'}

🤯 **Почему это интересно?**
Тема активно обсуждается в технологических сообществах и идеально подходит для короткого ролика.

📊 **Оценка потенциала:** ${item.score}/100
🌐 **Источник:** ${item.source_name || 'RSS'}`;

  const keyboard = new InlineKeyboard()
    .url('🔗 Читать источник', item.link).row()
    .text('🎬 Сценарий', `script_${item.id}`).row()
    .text('⭐ В избранное', `fav_add_${item.id}`)
    .text('👎 Не интересно', `news_skip_${item.id}`);

  await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}
