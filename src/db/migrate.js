import { pool } from './pool.js';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        username VARCHAR(255),
        first_name VARCHAR(255),
        subscribed BOOLEAN DEFAULT TRUE,
        send_time VARCHAR(5) DEFAULT '09:00',
        timezone VARCHAR(50) DEFAULT 'Asia/Bishkek',
        categories TEXT[] DEFAULT ARRAY['ai', 'tech', 'games', 'trends', 'creators', 'space', 'events', 'business'],
        news_count INT DEFAULT 5,
        language VARCHAR(10) DEFAULT 'ru',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Таблица источников RSS
    await client.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT UNIQUE NOT NULL,
        category VARCHAR(50) NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `);

    // Таблица новостей
    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        guid VARCHAR(512) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        pub_date TIMESTAMP NOT NULL,
        source_name VARCHAR(255),
        link TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        score INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Таблица избранного
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(telegram_id, news_id)
      );
    `);

    // Таблица истории отправок для защиты от дубликатов
    await client.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(telegram_id, news_id)
      );
    `);

    // Индексы для быстрого поиска
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_news_pub_date ON news(pub_date DESC);
      CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
      CREATE INDEX IF NOT EXISTS idx_deliveries_user_news ON deliveries(telegram_id, news_id);
    `);

    // Заполнение базовых RSS-источников при первом запуске
    const defaultSources = [
      { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
      { name: 'IGN Games', url: 'https://feeds.feedburner.com/ign/all', category: 'games' },
      { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'tech' },
      { name: 'NASA Breaking News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'space' }
    ];

    for (const src of defaultSources) {
      await client.query(
        `INSERT INTO sources (name, url, category, active) 
         VALUES ($1, $2, $3, TRUE) 
         ON CONFLICT (url) DO NOTHING;`,
        [src.name, src.url, src.category]
      );
    }

    await client.query('COMMIT');
    console.log('Миграции базы данных успешно выполнены :)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка при выполнении миграций:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Автозапуск при вызове напрямую
if (process.argv[1] === import.meta.url) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}
