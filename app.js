// =================================================================
// СКРИПТ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ - index.html (app.js) - ИСПРАВЛЕННЫЙ
// =================================================================

const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
const PAGE_SIZE = 9;
let currentPage = 0;
let currentCategoryId = null;

function initializeIndexPage() {
    const pageElement = document.getElementById('events');
    if (!pageElement) return;
    setupIndexPageListeners();
    loadAndDisplayCategories();
    loadEvents(true);
}

function setupIndexPageListeners() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('.search-button');
    if (searchButton) {
        searchButton.onclick = () => loadEvents(true);
    }
    if (searchInput) {
        searchInput.onkeyup = (event) => {
            if (event.keyCode === 13) { loadEvents(true); }
        };
    }
}

async function loadAndDisplayCategories() {
    const categoryPillsContainer = document.getElementById('category-pills-container');
    if (!categoryPillsContainer) return;
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) { console.error("Ошибка загрузки категорий:", error); return; }
    let categoryPillsHtml = '<button class="category-pill active" onclick="resetFilters()">Все</button>';
    (data || []).forEach(category => {
        categoryPillsHtml += `<button class="category-pill" onclick="setCategoryFilter(${category.id}, this)">${sanitizeHTML(category.name)}</button>`;
    });
    categoryPillsContainer.innerHTML = categoryPillsHtml;
}

async function loadEvents(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 0;
        eventsContainer.innerHTML = '<p class="loading-message">Загрузка событий...</p>';
        if (paginationControls) paginationControls.innerHTML = '';
    }
    const searchTerm = document.getElementById('search-input').value.trim();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // << --- ИСПРАВЛЕНИЕ ЗДЕСЬ! --- >>
    // БЫЛО: .from('events_with_details')
    // СТАЛО: .from('events_with_comment_count')
    let query = supabaseClient
        .from('events_with_comment_count')
        .select('*', { count: 'exact' })
        .eq('is_approved', true);

    if (searchTerm) { query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`); }
    if (currentCategoryId) { query = query.eq('category_id', currentCategoryId); } // Предполагаем, что view содержит category_id
    
    // ВАЖНО: нужно перепроверить, что `events_with_comment_count` содержит все нужные поля:
    // title, description, city, created_at, image_url, category_name, author_full_name, author_avatar_url, favorited_by, comment_count
    const { data: events, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) { console.error("Ошибка загрузки событий:", error); if (isNewSearch) eventsContainer.innerHTML = `<p class='error-message'>Ошибка: ${error.message}</p>`; return; }
    if (isNewSearch) eventsContainer.innerHTML = "";
    if (!events || events.length === 0) { if (isNewSearch) eventsContainer.innerHTML = '<p class="info-message">Событий не найдено.</p>'; if (paginationControls) paginationControls.innerHTML = ''; return; }

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
        loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
        if (paginationControls) paginationControls.appendChild(loadMoreBtn);
    }
}

function resetFilters() {
    if (document.getElementById('search-input')) { document.getElementById('search-input').value = ''; }
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    document.querySelector('.category-pill').classList.add('active');
    currentCategoryId = null;
    loadEvents(true);
}

function setCategoryFilter(categoryId, element) {
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    element.classList.add('active');
    currentCategoryId = categoryId;
    loadEvents(true);
}

function createEventCard(event) {
    const div = document.createElement("div");
    div.className = "event-card-v3";
    const isFavorited = currentUser ? (event.favorited_by || []).includes(currentUser.id) : false;
    const authorAvatar = event.author_avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc?text=A';
    div.innerHTML = `...`; // Твой код для innerHTML, он правильный
    return div;
}

async function toggleFavorite(event, eventId, buttonElement) {
    // ... Твой код для toggleFavorite, он правильный
}

document.addEventListener('headerLoaded', initializeIndexPage);
