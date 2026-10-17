import Parser from 'rss-parser';
import { pool } from '../db/pool.js';
import { scoreNews } from './newsScorer.js';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'TikTokPulseBot/1.0' }
});

export async function fetchAndStoreNews() {
  console.log('Запуск сбора новостей из RSS источников...');
  
  try {
    const sourcesRes = await pool.query('SELECT * FROM sources WHERE active = TRUE');
    const sources = sourcesRes.rows;

    let totalFetched = 0;

    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url);
        const items = feed.items || [];

        for (const item of items) {
          const guid = item.guid || item.link;
          if (!guid || !item.title) continue;

          // Проверка свежести (не старше 3 дней)
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          if (pubDate < threeDaysAgo) continue;

          const title = item.title.trim();
          const description = (item.contentSnippet || item.summary || item.content || '').trim().slice(0, 500);
          const link = item.link;

          // Эвристическая оценка
          const score = scoreNews({ title, description, category: source.category });

          await pool.query(
            `INSERT INTO news (guid, title, description, pub_date, source_name, link, category, score)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (guid) DO NOTHING;`,
            [guid, title, description, pubDate, source.name, link, source.category, score]
          );

          totalFetched++;
        }
      } catch (err) {
        console.error(`Ошибка парсинга источника ${source.name} (${source.url}):`, err.message);
      }
    }

    console.log(`Сбор завершен. Обработано записей: ${totalFetched} :)`);
  } catch (err) {
    console.error('Ошибка в процессе сбора новостей:', err);
  }
}
