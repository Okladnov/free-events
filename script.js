// =================================================================
// НАСТРОЙКИ СТРАНИЦЫ
// =================================================================
const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
const PAGE_SIZE = 9;
let currentPage = 0;
let currentCategoryId = null;

// =================================================================
// ТОЧКА ВХОДА: КОД ЗАПУСКАЕТСЯ ПОСЛЕ ЗАГРУЗКИ СТРАНИЦЫ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Эта функция из app.js настроит шапку, проверит пользователя и т.д.
    initializeHeader().then(() => {
        // Загружаем события только после того, как узнали, админ ли пользователь
        loadEvents(true);
    });
    
    // Настраиваем обработчики, специфичные для этой страницы
    setupIndexPageListeners();
    // Загружаем контент, специфичный для этой страницы
    loadAndDisplayCategories();
});

// =================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ (С ДЕЛЕГИРОВАНИЕМ)
// =================================================================
function setupIndexPageListeners() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('.search-button');

    if (searchButton) {
        searchButton.onclick = () => loadEvents(true);
    }
    if (searchInput) {
        searchInput.onkeyup = (event) => {
            if (event.keyCode === 13) loadEvents(true);
        };
    }

    // ЕДИНЫЙ ОБРАБОТЧИК КЛИКОВ ДЛЯ ВСЕХ КАРТОЧЕК
    eventsContainer.addEventListener('click', async (event) => {
        const target = event.target;
        // Находим ближайший элемент с атрибутом data-action
        const actionElement = target.closest('[data-action]');
        
        if (!actionElement) return;

        // Получаем действие и ID события из data-атрибутов
        const action = actionElement.dataset.action;
        const card = target.closest('.event-card-v3');
        const eventId = card ? card.dataset.eventId : null;

        // Если кликнули по кнопке, отменяем стандартное поведение (например, переход по ссылке)
        if (actionElement.tagName === 'BUTTON') {
            event.preventDefault();
            event.stopPropagation(); // Важно, чтобы клик не "всплыл" до ссылки-обертки
        }

        if (!eventId) return;

        // Выполняем действие в зависимости от data-action
        switch (action) {
            case 'toggle-favorite':
                toggleFavoriteHandler(eventId, actionElement);
                break;
            case 'edit':
                window.location.href = `edit-event.html?id=${eventId}`;
                break;
            case 'delete':
                deleteEventHandler(eventId, card);
                break;
            case 'go-to-event':
                // Если кликнули по ссылке, а не по кнопке, переходим
                if (actionElement.tagName === 'A') {
                    window.location.href = actionElement.href;
                }
                break;
        }
    });
}

// =================================================================
// ЛОКАЛЬНЫЕ ФУНКЦИИ-ОБРАБОТЧИКИ (БОЛЬШЕ НЕ В WINDOW)
// =================================================================
async function deleteEventHandler(eventId, cardElement) {
    if (!confirm('Вы уверены, что хотите удалить это событие?')) return;

    cardElement.style.opacity = '0.5';
    // Используем .eq() вместо .match(), это более стандартный синтаксис
    const { error } = await supabaseClient.from('events').delete().eq('id', eventId);

    if (error) {
        alert('Ошибка удаления. Убедитесь, что у вас есть права, и проверьте консоль.');
        console.error('Ошибка удаления:', error.message);
        cardElement.style.opacity = '1';
    } else {
        cardElement.remove();
    }
}

async function toggleFavoriteHandler(eventId, buttonElement) {
    if (!currentUser) {
        alert('Пожалуйста, войдите, чтобы добавлять в избранное.');
        return;
    }
    
    buttonElement.disabled = true;
    const isFavorited = buttonElement.classList.contains('active');
    
    let error;
    if (isFavorited) {
        const { error: deleteError } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
        error = deleteError;
    } else {
        const { error: insertError } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
        error = insertError;
    }
    
    if (!error) {
        buttonElement.classList.toggle('active');
    } else {
        console.error('Ошибка избранного:', error.message);
    }
    
    buttonElement.disabled = false;
}

// =================================================================
// ФУНКЦИИ ФИЛЬТРОВ (ВСЕ ЕЩЕ ГЛОБАЛЬНЫЕ, Т.К. ВЫЗЫВАЮТСЯ ИЗ ONCLICK В HTML)
// =================================================================
window.resetFilters = () => {
    document.getElementById('search-input').value = '';
    const activePill = document.querySelector('.category-pill.active');
    if(activePill) activePill.classList.remove('active');
    currentCategoryId = null;
    loadEvents(true);
};

window.setCategoryFilter = (categoryId) => {
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    document.querySelector(`.category-pill[onclick*="setCategoryFilter(${categoryId})"]`).classList.add('active');
    currentCategoryId = categoryId;
    loadEvents(true);
};

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ - ИСПРАВЛЕННАЯ ВЕРСИЯ
// =================================================================
async function loadEvents(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 0;
        eventsContainer.innerHTML = '<p>Загрузка событий...</p>';
        paginationControls.innerHTML = '';
    }

    const searchTerm = document.getElementById('search-input').value.trim();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    let query = supabaseClient
        .from('events_with_comment_count')
        // Добавляем { count: 'exact' } к основному запросу!
        .select(`*, organizations(name), categories!inner(id, name), profiles(full_name, avatar_url), favorites(user_id)`, { count: 'exact' })
        .eq('is_approved', true);

    if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    }

    if (currentCategoryId) {
        query = query.eq('categories.id', currentCategoryId);
    }

    // Получаем count из этого же запроса
    const { data: events, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to - 1);

    if (error) {
        console.error("Ошибка загрузки событий:", error);
        if (isNewSearch) eventsContainer.innerHTML = "<p>Ошибка загрузки событий.</p>";
        return;
    }

    if (isNewSearch) {
        eventsContainer.innerHTML = "";
    }

    if (!events || events.length === 0) {
        if (isNewSearch) eventsContainer.innerHTML = '<p>Событий по вашему запросу не найдено.</p>';
        paginationControls.innerHTML = '';
        return;
    }

    events.forEach(event => {
        const div = document.createElement("div");
        div.className = "event-card-v3";
        // Добавляем ID события в data-атрибут для легкого доступа
        div.dataset.eventId = event.id;

        const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
        const authorAvatar = event.profiles ? event.profiles.avatar_url : 'https://placehold.co/24x24/f0f2f5/ccc';
        const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
        
        // ШАБЛОН С DATA-ACTION АТРИБУТАМИ
        div.innerHTML = `
            <div class="card-header">
                <span>Опубликовано ${new Date(event.created_at).toLocaleDateString()}</span>
            </div>
            <div class="card-body">
                <a href="event.html?id=${event.id}" class="card-image-link" data-action="go-to-event">
                    <img src="${event.image_url || 'https://placehold.co/250x250/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
                </a>
                <div class="card-content">
                    ${event.organizations ? `<a href="/?org=${event.organization_id}" class="card-organization">${sanitizeHTML(event.organizations.name)}</a>` : '<div class="card-organization-placeholder"></div>'}
                    <a href="event.html?id=${event.id}" class="card-title-link" data-action="go-to-event">
                        <h3>${sanitizeHTML(event.title)}</h3>
                    </a>
                    <p class="card-description">${sanitizeHTML(event.description || '').substring(0, 100)}...</p>
                    <div class="card-author">
                        <img src="${authorAvatar || 'https://placehold.co/24x24/f0f2f5/ccc'}" alt="avatar">
                        <span>${sanitizeHTML(authorName)}</span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-actions">
                    <button class="action-btn ${isFavorited ? 'active' : ''}" data-action="toggle-favorite">
                        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                        <span>Избранное</span>
                    </button>
                    <div class="action-btn">
                        <svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"></path></svg>
                        <span>${event.comment_count}</span>
                    </div>
                    ${isAdmin ? `
                    <button class="action-btn" data-action="edit" title="Редактировать"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg></button>
                    <button class="action-btn" data-action="delete" title="Удалить"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg></button>
                    ` : ''}
                </div>
                <a href="event.html?id=${event.id}" class="card-main-link" data-action="go-to-event">К событию</a>
            </div>
        `;
        eventsContainer.appendChild(div);
    });

    // УДАЛЯЕМ ЛИШНИЙ ЗАПРОС, ИСПОЛЬЗУЕМ COUNT ИЗ ОСНОВНОГО ЗАПРОСА
    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    // ПРОВЕРКА ПАГИНАЦИИ С ИСПОЛЬЗОВАНИЕМ ПРАВИЛЬНОГО 'count'
    if (events.length + from < count) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
        paginationControls.appendChild(loadMoreBtn);
    }
}

// =================================================================
// ЗАГРУЗКА КАТЕГОРИЙ (без изменений)
// =================================================================
async function loadAndDisplayCategories() {
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) {
        console.error('Ошибка загрузки категорий:', error);
        return;
    }
    
    const categoryPillsContainer = document.getElementById('category-pills-container');
    if (!categoryPillsContainer) return;
    
    let categoryPillsHtml = '<button class="category-pill active" onclick="resetFilters()">Все</button>';
    (data || []).forEach(category => {
        categoryPillsHtml += `<button class="category-pill" onclick="setCategoryFilter(${category.id})">${sanitizeHTML(category.name)}</button>`;
    });
    
    categoryPillsContainer.innerHTML = categoryPillsHtml;
}
