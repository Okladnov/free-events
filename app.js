// =================================================================
// СКРИПТ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ - index.html (ЖЕЛЕЗОБЕТОННАЯ ВЕРСИЯ)
// =================================================================
// Важно: supabaseClient и currentUser - это глобальные переменные, 
// которые создает script.js. Мы здесь их просто используем.

// --- 1. Функция-инициализатор для этой страницы ---
function initializeIndexPage() {
    const eventsContainer = document.getElementById('events');
    // Если мы не на главной странице, ничего не делаем
    if (!eventsContainer) return;

    // Запускаем логику, специфичную для этой страницы
    setupIndexPageListeners();
    loadAndDisplayCategories();
    loadEvents(true);
}


// --- 2. Обработчики событий (поиск) ---
function setupIndexPageListeners() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('.search-button');

    if (searchButton) {
        searchButton.onclick = () => loadEvents(true);
    }
    if (searchInput) {
        searchInput.onkeyup = (event) => {
            if (event.keyCode === 13) {
                loadEvents(true);
            }
        };
    }
}


// --- 3. Загрузка и отображение категорий ---
async function loadAndDisplayCategories() {
    const categoryPillsContainer = document.getElementById('category-pills-container');
    if (!categoryPillsContainer) return;

    // Используем глобальный supabaseClient
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) {
        console.error("Ошибка загрузки категорий:", error);
        return;
    }

    let categoryPillsHtml = '<button class="category-pill active" onclick="resetFilters()">Все</button>';
    (data || []).forEach(category => {
        categoryPillsHtml += `<button class="category-pill" onclick="setCategoryFilter(${category.id}, this)">${sanitizeHTML(category.name)}</button>`;
    });
    categoryPillsContainer.innerHTML = categoryPillsHtml;
}


// --- 4. Загрузка и отображение событий ---
async function loadEvents(isNewSearch = false) {
    const eventsContainer = document.getElementById('events');
    const paginationControls = document.getElementById('pagination-controls');
    let currentPage = 0; // Эти переменные теперь локальные
    let currentCategoryId = null;

    if (isNewSearch) {
        currentPage = 0;
        eventsContainer.innerHTML = '<p class="loading-message">Загрузка событий...</p>';
        if (paginationControls) paginationControls.innerHTML = '';
    }

    const searchTerm = document.getElementById('search-input').value.trim();
    const from = currentPage * 9; // PAGE_SIZE
    const to = from + 9 - 1;

    let query = supabaseClient
        .from('events_with_comment_count') // Используем правильное имя view
        .select('*', { count: 'exact' })
        .eq('is_approved', true);

    if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    }
    if (currentCategoryId) {
        query = query.eq('category_id', currentCategoryId);
    }

    const { data: events, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Ошибка загрузки событий:", error);
        if (isNewSearch) eventsContainer.innerHTML = `<p class='error-message'>Ошибка: ${error.message}</p>`;
        return;
    }

    if (isNewSearch) eventsContainer.innerHTML = "";

    if (!events || events.length === 0) {
        if (isNewSearch) eventsContainer.innerHTML = '<p class="info-message">Событий не найдено.</p>';
        if (paginationControls) paginationControls.innerHTML = '';
        return;
    }

    events.forEach(event => {
        const card = createEventCard(event);
        eventsContainer.appendChild(card);
    });
    
    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    if (eventsContainer.children.length < count) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.className = 'submit-btn secondary';
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.onclick = () => {
            currentPage++;
            loadEvents(false);
        };
        if (paginationControls) paginationControls.appendChild(loadMoreBtn);
    }
}


// --- 5. Вспомогательные функции для страницы ---
function resetFilters() {
    if (document.getElementById('search-input')) { document.getElementById('search-input').value = ''; }
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    document.querySelector('.category-pill').classList.add('active');
    loadEvents(true);
}

function setCategoryFilter(categoryId, element) {
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    element.classList.add('active');
    // Мы не храним currentCategoryId глобально, а просто перезапускаем поиск с нужным ID
    loadEvents(true, categoryId); 
}

function createEventCard(event) {
    const div = document.createElement("div");
    div.className = "event-card-v3";
    const isFavorited = window.currentUser ? (event.favorited_by || []).includes(window.currentUser.id) : false;
    const authorAvatar = event.author_avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc?text=A';

    div.innerHTML = `
        <div class="card-header">
            <span>${new Date(event.created_at).toLocaleDateString()}</span>
            <span class="card-category">${sanitizeHTML(event.category_name || 'Категория')}</span>
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
                <button class="action-btn favorite-btn ${isFavorited ? 'active' : ''}" onclick="toggleFavorite(event, ${event.id}, this)">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                    <span>${event.favorites_count || 0}</span>
                </button>
                <a href="event.html?id=${event.id}#comments" class="action-btn comments-btn">
                    <svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"></path></svg>
                    <span>${event.comment_count || 0}</span>
                </a>
            </div>
            <a href="event.html?id=${event.id}" class="card-main-link">Подробнее</a>
        </div>
    `;
    return div;
}

async function toggleFavorite(event, eventId, buttonElement) {
    event.stopPropagation();
    if (!window.currentUser) { alert('Пожалуйста, войдите, чтобы добавлять в избранное.'); return; }
    buttonElement.disabled = true;
    const isActive = buttonElement.classList.contains('active');
    const countSpan = buttonElement.querySelector('span');
    let currentCount = parseInt(countSpan.textContent, 10);
    if (isActive) {
        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: window.currentUser.id });
        if (error) { console.error("Ошибка:", error); buttonElement.disabled = false; }
        else { buttonElement.classList.remove('active'); countSpan.textContent = currentCount - 1; buttonElement.disabled = false; }
    } else {
        const { error } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: window.currentUser.id });
        if (error) { console.error("Ошибка:", error); buttonElement.disabled = false; }
        else { buttonElement.classList.add('active'); countSpan.textContent = currentCount + 1; buttonElement.disabled = false; }
    }
}

// --- 6. Запускаемся, когда script.js подаст сигнал ---
document.addEventListener('appReady', initializeIndexPage);
