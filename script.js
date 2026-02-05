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
    initializeHeader();

    // Настраиваем обработчики, специфичные для этой страницы
    setupIndexPageListeners();

    // Загружаем контент, специфичный для этой страницы
    loadAndDisplayCategories();
    loadEvents(true);
});


// =================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ
// =================================================================
function setupIndexPageListeners() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('.search-button');

    // Запускаем поиск по клику
    if (searchButton) {
        searchButton.onclick = () => loadEvents(true);
    }
    // Запускаем поиск по Enter
    if (searchInput) {
        searchInput.onkeyup = (event) => {
            if (event.keyCode === 13) {
                loadEvents(true);
            }
        };
    }
}

// =================================================================
// УПРАВЛЕНИЕ СОБЫТИЕМ И ФИЛЬТРЫ
// =================================================================
window.deleteEvent = async (eventId, button) => {
    if (!confirm('Вы уверены, что хотите удалить это событие?')) return;
    const card = button.closest('.event-card-v3');
    card.style.opacity = '0.5';
    const { error } = await supabaseClient.from('events').delete().match({ id: eventId });
    if(error) {
        alert('Не удалось удалить событие.');
        card.style.opacity = '1';
    } else {
        card.remove();
    }
};

window.editEvent = (eventId) => { window.location.href = `edit-event.html?id=${eventId}`; };

window.resetFilters = () => {
    document.getElementById('search-input').value = '';
    const activePill = document.querySelector('.category-pill.active');
    if(activePill) activePill.classList.remove('active');
    currentCategoryId = null;
    loadEvents(true);
};

window.setCategoryFilter = (categoryId) => {
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    document.querySelector(`.category-pill[onclick="setCategoryFilter(${categoryId})"]`).classList.add('active');
    currentCategoryId = categoryId;
    loadEvents(true);
};

window.toggleFavorite = async (eventId, buttonElement) => {
    if (!currentUser) {
        alert('Пожалуйста, войдите, чтобы добавлять в избранное.');
        return;
    }

    // Предотвращаем двойные клики
    buttonElement.disabled = true;

    // Проверяем текущий статус по наличию класса 'active'
    const isFavorited = buttonElement.classList.contains('active');

    let error;

    if (isFavorited) {
        // Если уже в избранном, удаляем
        const { error: deleteError } = await supabaseClient
            .from('favorites')
            .delete()
            .match({ event_id: eventId, user_id: currentUser.id });
        error = deleteError;
    } else {
        // Если не в избранном, добавляем
        const { error: insertError } = await supabaseClient
            .from('favorites')
            .insert({ event_id: eventId, user_id: currentUser.id });
        error = insertError;
    }

    // Если не было ошибки, меняем внешний вид кнопки
    if (!error) {
        buttonElement.classList.toggle('active');
    }

    // Включаем кнопку обратно
    buttonElement.disabled = false;
};

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ - ВЕРСИЯ V3
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
        .select(`*, organizations(name), categories!inner(id, name), profiles(full_name, avatar_url), favorites(user_id)`)
        .eq('is_approved', true);

    if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    }
    if (currentCategoryId) {
        query = query.eq('categories.id', currentCategoryId);
    }

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

        const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
        const authorAvatar = event.profiles ? event.profiles.avatar_url : 'https://placehold.co/24x24/f0f2f5/ccc';
        const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;

        div.innerHTML = `
            <div class="card-header">
                <span>Опубликовано ${new Date(event.created_at).toLocaleDateString()}</span>
                <span class="card-temp">-5°</span>
            </div>
            <div class="card-body">
                <a href="event.html?id=${event.id}" class="card-image-link">
                    <img src="${event.image_url || 'https://placehold.co/250x250/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
                </a>
                <div class="card-content">
                    ${event.organizations ? `<a href="/?org=${event.organization_id}" class="card-organization">${sanitizeHTML(event.organizations.name)}</a>` : '<div class="card-organization-placeholder"></div>'}
                    <a href="event.html?id=${event.id}" class="card-title-link">
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
                    <button class="action-btn ${isFavorited ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${event.id}, this)">
                        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                        <span>В избранное</span>
                    </button>
                    <div class="action-btn">
                        <svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"></path></svg>
                        <span>${event.comment_count}</span>
                    </div>
                </div>
                <a href="event.html?id=${event.id}" class="card-main-link">К событию</a>
            </div>
        `;
        eventsContainer.appendChild(div);
    });

    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    // В Supabase v2 count возвращается в другом формате, проверим его наличие
    const { count: totalCount } = await supabaseClient.from('events').select('*', { count: 'exact', head: true });
    
    if (events.length + from < count) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
        paginationControls.appendChild(loadMoreBtn);
    }
}

// =================================================================
// ЗАГРУЗКА КАТЕГОРИЙ
// =================================================================
async function loadAndDisplayCategories() {
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) return;
    
    const categoryPillsContainer = document.getElementById('category-pills-container');
    
    let categoryPillsHtml = '<button class="category-pill" onclick="resetFilters()">Все</button>';
    (data || []).forEach(category => {
        categoryPillsHtml += `<button class="category-pill" onclick="setCategoryFilter(${category.id})">${category.name}</button>`;
    });
    if (categoryPillsContainer) categoryPillsContainer.innerHTML = categoryPillsHtml;
}

