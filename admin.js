// ===================================================================
// admin.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
    
    const { data: events, error } = await supabaseClient
        .from('events_with_details') 
        .select(`*`)
        .eq('is_approved', false)
        .order('created_at', { ascending: true });
    
    if (error) { /* ... (обработка ошибки) ... */ return; }
    if (!events || events.length === 0) { /* ... (сообщение, что список пуст) ... */ return; }
    
    container.innerHTML = '';
    const cardTemplate = document.getElementById('event-card-template');
    if (!cardTemplate) return;

    events.forEach(event => {
        const cardClone = cardTemplate.content.cloneNode(true);
        const cardRoot = cardClone.querySelector('.event-card-v3');
        const eventUrl = `event.html?id=${event.id}`;
        
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

        const authorName = event.full_name || 'Аноним';
        const authorAvatar = event.avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc';
        cardClone.querySelector('.card-author-name').textContent = authorName;
        cardClone.querySelector('.card-author-avatar').src = authorAvatar;
        
        cardClone.querySelector('.comment-count').textContent = event.comment_count || 0;

        const cardActions = cardClone.querySelector('.card-actions');
        if (cardActions) {
            cardActions.remove();
        }
        
        if (event.new_organization_name || event.new_city_name) {
            const titleEl = cardClone.querySelector('.card-title');
            if (titleEl) {
                titleEl.textContent = '✨ ' + titleEl.textContent;
            }
        }
        
        container.appendChild(cardClone);
    }); // <-- конец forEach
}
