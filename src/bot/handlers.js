import { pool } from '../db/pool.js';
import { getMainMenuKeyboard, getNewsActionKeyboard, getSettingsKeyboard } from './keyboards.js';
import { generateTikTokScript } from '../services/scriptGen.js';

export async function registerHandlers(bot) {
  // Регистрация пользователя при /start
  bot.command('start', async (ctx) => {
    try {
      const user = ctx.from;
      if (!user) return;

      await pool.query(
        `INSERT INTO users (telegram_id, username, first_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (telegram_id) DO UPDATE 
         SET username = EXCLUDED.username, first_name = EXCLUDED.first_name;`,
        [user.id, user.username || '', user.first_name || '']
      );

      const welcomeText = `👋 Привет! Я TikTokPulse — твой ежедневный радар интересных новостей.

Каждый день я подбираю свежие темы, из которых можно сделать интересные TikTok-видео. Никакого информационного мусора — только отобранные события и идеи для контента :)`;

      await ctx.reply(welcomeText, { reply_markup: getMainMenuKeyboard() });
    } catch (err) {
      console.error('Ошибка в команда /start:', err);
      await ctx.reply('⚠️ Произошла ошибка при запуске. Попробуйте ещё раз.');
    }
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
    try {
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
    } catch (err) {
      console.error('Ошибка в favorites:', err);
      await ctx.reply('⚠️ Не удалось загрузить избранное.');
    }
  });

  bot.command('settings', async (ctx) => {
    try {
      const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [ctx.from.id]);
      const user = userRes.rows[0];
      if (!user) {
        await ctx.reply('Пожалуйста, введите /start для инициализации профиля.');
        return;
      }
      await ctx.reply('⚙️ **Настройки пользователя:**', { reply_markup: getSettingsKeyboard(user), parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Ошибка в settings:', err);
    }
  });

  bot.command('subscribe', async (ctx) => {
    await pool.query('UPDATE users SET subscribed = TRUE WHERE telegram_id = $1', [ctx.from.id]);
    await ctx.reply('✅ Ежедневная рассылка успешно включена :)');
  });

  bot.command('unsubscribe', async (ctx) => {
    await pool.query('UPDATE users SET subscribed = FALSE WHERE telegram_id = $1', [ctx.from.id]);
    await ctx.reply('❌ Ежедневная рассылка отключена.');
  });

  // Инлайн-кнопки
  bot.callbackQuery('menu_news', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await sendNewsList(ctx, null, 5);
  });

  bot.callbackQuery('menu_today', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await sendNewsList(ctx, null, 5, true);
  });

  bot.callbackQuery(/^cat_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const category = ctx.match[1];
    await sendNewsList(ctx, category, 5);
  });

  bot.callbackQuery('menu_ideas', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.reply('💡 Выберите новость в ленте и нажмите кнопку «🎬 Сценарий».');
  });

  bot.callbackQuery('menu_favorites', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
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
    } catch (err) {
      console.error('Ошибка в menu_favorites:', err);
    }
  });

  bot.callbackQuery('menu_settings', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [ctx.from.id]);
      const user = userRes.rows[0];
      if (user) {
        await ctx.editMessageText('⚙️ **Настройки пользователя:**', { reply_markup: getSettingsKeyboard(user), parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('Ошибка в menu_settings:', err);
    }
  });

  bot.callbackQuery('toggle_sub', async (ctx) => {
    try {
      const userRes = await pool.query('SELECT subscribed FROM users WHERE telegram_id = $1', [ctx.from.id]);
      if (userRes.rows.length > 0) {
        const newState = !userRes.rows[0].subscribed;
        await pool.query('UPDATE users SET subscribed = $1 WHERE telegram_id = $2', [newState, ctx.from.id]);
        const updatedUser = (await pool.query('SELECT * FROM users WHERE telegram_id = $1', [ctx.from.id])).rows[0];
        await ctx.editMessageText('⚙️ **Настройки пользователя:**', { reply_markup: getSettingsKeyboard(updatedUser), parse_mode: 'Markdown' });
        await ctx.answerCallbackQuery(`Рассылка ${newState ? 'включена' : 'выключена'}`).catch(() => {});
      }
    } catch (err) {
      console.error('Ошибка в toggle_sub:', err);
    }
  });

  bot.callbackQuery('main_menu', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText('👋 Главное меню TikTokPulse:', { reply_markup: getMainMenuKeyboard() });
  });

  bot.callbackQuery(/^script_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Генерация сценария...').catch(() => {});
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
      await ctx.answerCallbackQuery('⭐ Добавлено в избранное!').catch(() => {});
    } catch {
      await ctx.answerCallbackQuery('Уже в избранном :)').catch(() => {});
    }
  });

  bot.callbackQuery(/^news_skip_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Скрыто').catch(() => {});
    await ctx.deleteMessage().catch(() => {});
  });
}

async function sendNewsList(ctx, category = null, limit = 5, onlyToday = false) {
  try {
    let query = 'SELECT * FROM news';
    let params = [];
    let conditions = [];

    if (category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(category);
    }

    if (onlyToday) {
      conditions.push(`pub_date >= NOW() - INTERVAL '24 hours'`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY pub_date DESC, score DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await pool.query(query, params);
    const newsList = res.rows;

    if (newsList.length === 0) {
      await ctx.reply('📭 По вашему запросу свежих новостей пока нет. Нажмите «🔥 Новости сейчас» или попробуйте позже :)');
      return;
    }

    for (const item of newsList) {
      await formatAndSendNews(ctx, item);
    }
  } catch (err) {
    console.error('Ошибка при получении списка новостей:', err);
    await ctx.reply('⚠️ Произошла ошибка при загрузке новостей.');
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

  const keyboard = getNewsActionKeyboard(item.id);

  // Динамически подставляем оригинальную ссылку
  keyboard.inline_keyboard[0][0].url = item.link || 'https://google.com';

  await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}
