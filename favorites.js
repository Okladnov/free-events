// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ ИЗБРАННОГО - favorites.html (favorites.js)
// =================================================================
// Важно: supabaseClient и currentUser уже созданы в script.js.

// --- 1. Функция-инициализатор для этой страницы ---
function initializeFavoritesPage() {
    const eventsContainer = document.getElementById('events');
    // Если мы не на странице "Избранное", ничего не делаем
    if (!eventsContainer || window.location.pathname.indexOf('favorites.html') === -1) {
        return;
    }

    // Проверяем, авторизован ли пользователь
    if (!currentUser) {
        eventsContainer.innerHTML = `
            <div class="card access-denied">
                <h2>🔒 Это приватная страница</h2>
                <p>Пожалуйста, <a href="/login.html">войдите в свой аккаунт</a>, чтобы увидеть избранные события.</p>
            </div>`;
        return;
    }

    // Если все ок, загружаем избранное
    loadFavoriteEvents();
}

// --- 2. Основная функция загрузки избранного ---
async function loadFavoriteEvents() {
    const eventsContainer = document.getElementById('events');
    eventsContainer.innerHTML = '<p class="loading-message">Загрузка ваших избранных событий...</p>';

    // Сначала получаем ID всех избранных событий
    const { data: favoriteIdsData, error: idsError } = await supabaseClient
        .from('favorites')
        .select('event_id')
        .eq('user_id', currentUser.id);

    if (idsError) {
        eventsContainer.innerHTML = '<p class="error-message">Не удалось загрузить избранные события.</p>';
        return;
    }
    if (!favoriteIdsData || favoriteIdsData.length === 0) {
        eventsContainer.innerHTML = '<p class="info-message">Вы пока не добавили ни одного события в избранное. <a href="/">Начните с главной!</a></p>';
        return;
    }
    const allFavoriteEventIds = favoriteIdsData.map(item => item.event_id);

    // Теперь загружаем сами события по этим ID
    const { data: events, error: eventsError } = await supabaseClient
        .from('events_with_details') // Используем наше view
        .select('*')
        .in('id', allFavoriteEventIds)
        .order('created_at', { ascending: false });
    
    if (eventsError) {
        eventsContainer.innerHTML = '<p class="error-message">Ошибка загрузки событий.</p>';
        return;
    }
    
    eventsContainer.innerHTML = ""; // Очищаем контейнер перед добавлением
    events.forEach(event => {
        // Используем функцию создания карточки из app.js/script.js
        // Добавим специальный флаг, чтобы кнопка "избранное" вела себя иначе
        const card = createEventCard(event, true); // true означает "мы в избранном"
        eventsContainer.appendChild(card);
    });
}


// --- 3. Переопределяем функцию создания карточки специально для этой страницы ---
// Она будет похожа на глобальную, но с другой логикой у кнопки "избранное"
function createEventCard(event, isInFavoritesPage = false) {
    const div = document.createElement("div");
    div.className = "event-card-v3";
    
    // В избранном все по умолчанию "активно"
    const isFavorited = true; 
    const authorAvatar = event.author_avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc?text=A';

    div.innerHTML = `
        <div class="card-header">
            <span>${new Date(event.created_at).toLocaleDateString()}</span>
            <span class="card-category">${sanitizeHTML(event.category_name)}</span>
        </div>
        <div class="card-body">
            <a href="event.html?id=${event.id}" class="card-image-link">
                <img src="${sanitizeForAttribute(event.image_url) || 'https://placehold.co/300x200/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
            </a>
            <div class="card-content">
                <a href="event.html?id=${event.id}" class="card-title-link">
                    <h3>${sanitizeHTML(event.title)}</h3>
                </a>
                <div class="card-author">
                    <img src="${sanitizeForAttribute(authorAvatar)}" alt="avatar">
                    <span>${sanitizeHTML(event.author_full_name || 'Аноним')}</span>
                </div>
            </div>
        </div>
        <div class="card-footer">
            <div class="card-actions">
                <button class="action-btn favorite-btn active" onclick="removeFromFavorites(${event.id}, this)">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                    <span>Удалить</span>
                </button>
            </div>
            <a href="event.html?id=${event.id}" class="card-main-link">Подробнее</a>
        </div>
    `;
    return div;
}


// --- 4. Глобальная функция для удаления из избранного (для onclick) ---
window.removeFromFavorites = async function(eventId, buttonElement) {
    if (!currentUser) return;

    buttonElement.disabled = true;
    const card = buttonElement.closest('.event-card-v3');

    const { error } = await supabaseClient
        .from('favorites')
        .delete()
        .match({ event_id: eventId, user_id: currentUser.id });

    if (error) {
        alert('Не удалось удалить событие из избранного.');
        buttonElement.disabled = false;
    } else {
        // Плавное удаление карточки
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            card.remove();
            // Проверяем, не пуст ли контейнер
            if (document.getElementById('events').children.length === 0) {
                document.getElementById('events').innerHTML = '<p class="info-message">Вы удалили все события из избранного.</p>';
            }
        }, 500);
    }
}


// --- 5. Точка входа ---
document.addEventListener('appReady', initializeFavoritesPage);

