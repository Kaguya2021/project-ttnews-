export function scoreNews({ title, description, category }) {
  let score = 50; // Базовый уровень

  const text = (title + ' ' + description).toLowerCase();

  // 1. Актуальность (до 25 баллов)
  const hotKeywords = ['ai', 'gpt', 'openai', 'gemini', 'apple', 'iphone', 'ps5', 'nintendo', 'update', 'relese', 'new', 'quantum', 'mars', 'elon musk'];
  const matchedHot = hotKeywords.filter(kw => text.includes(kw)).length;
  score += Math.min(matchedHot * 5, 25);

  // 2. Потенциальный интерес TikTok (до 25 баллов)
  const tiktokKeywords = ['secret', 'hidden', 'amazing', 'crazy', 'future', 'robot', 'game', 'viral', 'trend', 'shocking', 'banned', 'free'];
  const matchedTk = tiktokKeywords.filter(kw => text.includes(kw)).length;
  score += Math.min(matchedTk * 5, 25);

  // 3. Необычность и оригинальность (до 20 баллов)
  if (text.length > 100) score += 10;
  if (category === 'ai' || category === 'space' || category === 'events') score += 10;

  // 4. Ограничение в диапазоне от 40 до 98 баллов
  return Math.max(40, Math.min(98, score));
}
