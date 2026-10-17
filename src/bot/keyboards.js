import { InlineKeyboard } from 'grammy';

export function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text('🔥 Новости сейчас', 'menu_news').text('📅 За сегодня', 'menu_today').row()
    .text('🤖 ИИ', 'cat_ai').text('📱 Технологии', 'cat_tech').text('🎮 Игры', 'cat_games').row()
    .text('🌐 Тренды', 'cat_trends').text('🎬 Идеи TikTok', 'menu_ideas').row()
    .text('⭐ Избранное', 'menu_favorites').text('⚙️ Настройки', 'menu_settings');
}

export function getNewsActionKeyboard(newsId) {
  return new InlineKeyboard()
    .url('🔗 Читать источник', `https://example.com`) // Заменяется динамически в обработчике
    .text('🎬 Сценарий', `script_${newsId}`).row()
    .text('⭐ В избранное', `fav_add_${newsId}`)
    .text('👎 Не интересно', `news_skip_${newsId}`);
}

export function getSettingsKeyboard(user) {
  const subStatus = user.subscribed ? '✅ Рассылка ВКЛ' : '❌ Рассылка ВЫКЛ';
  return new InlineKeyboard()
    .text(subStatus, 'toggle_sub').row()
    .text(`⏰ Время: ${user.send_time}`, 'set_time')
    .text(`🌍 Часовой пояс: ${user.timezone}`, 'set_tz').row()
    .text(`📊 Новостей за раз: ${user.news_count}`, 'set_count')
    .text('🔄 Сбросить настройки', 'reset_settings').row()
    .text('« Назад в меню', 'main_menu');
}
