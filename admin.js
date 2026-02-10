// ===================================================================
// admin.js - ВЕРСИЯ С КАРТОЧКАМИ В СТИЛЕ ГЛАВНОЙ СТРАНИЦЫ
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Инициализируем шапку и ждем, пока определится админ
    await initializeHeader();

    // 2. Проверяем права доступа
    if (!isAdmin) {
        document.body.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов. <a href="/">На главную</a></p>';
        return;
    }

    // 3. Загружаем список событий
    loadUnapprovedEvents();
});


/**
 * Загружает и отображает неодобренные события, используя шаблон с главной страницы.
 */
async function loadUnapprovedEvents() {
    const container = document.getElementById('unapproved-events');
    if (!container) return;

    container.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
    
    // Запрашиваем события вместе с данными автора для карточки
    const { data: events, error } = await supabaseClient
        .from('events_with_comment_count') // Используем то же представление, что и на главной
        .select(`*, profiles(full_name, avatar_url)`)
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

    if (error) {
        container.innerHTML = `<p style="color: red;">Ошибка загрузки: ${error.message}.</p>`;
        return;
    }
    
    if (!events || events.length === 0) {
        container.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
        return;
    }
    
    // Очищаем контейнер и получаем шаблон
    container.innerHTML = '';
    const cardTemplate = document.getElementById('event-card-template');

    if (!cardTemplate) {
        console.error("Шаблон #event-card-template не найден на странице admin.html");
        container.innerHTML = '<p>Ошибка: не найден шаблон для отображения событий.</p>';
        return;
    }

    // Создаем карточки для каждого события
    events.forEach(event => {
        const cardClone = cardTemplate.content.cloneNode(true);
        const cardRoot = cardClone.querySelector('.event-card-v3');
        const eventUrl = `event.html?id=${event.id}`;
        
        // Заполняем данные карточки (логика, похожая на script.js)
        cardRoot.dataset.eventId = event.id;
        cardClone.querySelectorAll('[data-action="go-to-event"]').forEach(el => el.href = eventUrl);
        cardClone.querySelector('.card-date').textContent = `Опубликовано ${new Date(event.created_at).toLocaleDateString()}`;
        cardClone.querySelector('.card-title').textContent = event.title;
        cardClone.querySelector('.card-description').textContent = `${(event.description || '').substring(0, 100)}...`;

        const image = cardClone.querySelector('.card-image');
        if (event.image_url) {
            image.src = event.image_url;
        }
        image.alt = event.title;

        const authorName = (event.profiles && event.profiles.full_name) ? event.profiles.full_name : 'Аноним';
        cardClone.querySelector('.card-author-name').textContent = authorName;

        const authorAvatar = (event.profiles && event.profiles.avatar_url) ? event.profiles.avatar_url : 'https://placehold.co/24x24/f0f2f5/ccc';
        cardClone.querySelector('.card-author-avatar').src = authorAvatar;
        
        cardClone.querySelector('.comment-count').textContent = event.comment_count || 0;

        // Важно: полностью удаляем блок с кнопками действий (Избранное, Редактировать и т.д.)
        const cardActions = cardClone.querySelector('.card-actions');
        if (cardActions) {
            cardActions.remove();
        }
        
        container.appendChild(cardClone);
    });
}
