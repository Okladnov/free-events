// =================================================================
// script.js - ФИНАЛЬНАЯ, ОТРЕФАКТОРЕННАЯ ВЕРСИЯ
// =================================================================

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
        // Загружаем события только после того, как узнали, кто пользователь
        loadEvents(true);
    });
    
    // Настраиваем обработчики, специфичные для этой страницы
    setupIndexPageListeners();
    // Загружаем и "оживляем" категории
    loadAndDisplayCategories();
    setupCategoryListeners();
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
            if (event.key === 'Enter') loadEvents(true);
        };
    }

    // ЕДИНЫЙ ОБРАБОТЧИК КЛИКОВ ДЛЯ ВСЕХ КАРТОЧЕК
    if (eventsContainer) {
        eventsContainer.addEventListener('click', async (event) => {
            const target = event.target;
            const actionElement = target.closest('[data-action]');
            
            if (!actionElement) return;

            const action = actionElement.dataset.action;
            const card = target.closest('.event-card-v3');
            const eventId = card ? card.dataset.eventId : null;

            if (actionElement.tagName === 'BUTTON') {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!eventId) return;

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
            }
        });
    }
}

// =================================================================
// ЛОКАЛЬНЫЕ ФУНКЦИИ-ОБРАБОТЧИКИ (ДЕЙСТВИЯ С КАРТОЧКАМИ)
// =================================================================

async function deleteEventHandler(eventId, cardElement) {
    if (!confirm('Вы уверены, что хотите удалить это событие?')) return;
    cardElement.style.opacity = '0.5';

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
// ЛОГИКА РАБОТЫ С КАТЕГОРИЯМИ (НОВЫЙ СПОСОБ)
// =================================================================

async function loadAndDisplayCategories() {
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) {
        console.error('Ошибка загрузки категорий:', error);
        return;
    }
    const container = document.getElementById('category-pills-container');
    const template = document.getElementById('category-pill-template');
    if (!container || !template) return;
    container.innerHTML = ''; 

    // 1. Создаем кнопку "Все"
    const allButtonClone = template.content.cloneNode(true);
    const allButton = allButtonClone.querySelector('.category-pill');
    allButton.textContent = 'Все';
    allButton.classList.add('active');
    allButton.dataset.categoryId = 'all';
    container.appendChild(allButtonClone);

    // 2. Создаем кнопки для каждой категории
    (data || []).forEach(category => {
        const categoryClone = template.content.cloneNode(true);
        const categoryButton = categoryClone.querySelector('.category-pill');
        categoryButton.textContent = category.name;
        categoryButton.dataset.categoryId = category.id;
        container.appendChild(categoryClone);
    });
}

function setupCategoryListeners() {
    const container = document.getElementById('category-pills-container');
    if (!container) return;

    container.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-pill')) {
            const clickedButton = event.target;
            container.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
            clickedButton.classList.add('active');
            
            const categoryId = clickedButton.dataset.categoryId;
            currentCategoryId = (categoryId === 'all') ? null : categoryId;
            
            loadEvents(true);
        }
    });
}

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ (С ИСПОЛЬЗОВАНИЕМ <TEMPLATE>)
// =================================================================

async function loadEvents(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 0;
        if(eventsContainer) eventsContainer.innerHTML = '<p>Загрузка событий...</p>';
        if(paginationControls) paginationControls.innerHTML = '';
    }

    const searchTerm = document.getElementById('search-input').value.trim();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    let query = supabaseClient
        .from('events_with_comment_count')
        .select(`*, organizations(name), categories!inner(id, name), profiles(full_name, avatar_url), favorites(user_id)`, { count: 'exact' })
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
        if (isNewSearch && eventsContainer) eventsContainer.innerHTML = "<p>Ошибка загрузки событий.</p>";
        return;
    }

    if (isNewSearch && eventsContainer) {
        eventsContainer.innerHTML = "";
    }

    if ((!events || events.length === 0) && eventsContainer) {
        if (isNewSearch) eventsContainer.innerHTML = '<p>Событий по вашему запросу не найдено.</p>';
        if(paginationControls) paginationControls.innerHTML = '';
        return;
    }
    
    const cardTemplate = document.getElementById('event-card-template');
    if (!cardTemplate || !eventsContainer) return;

    events.forEach(event => {
        const cardClone = cardTemplate.content.cloneNode(true);
        const cardRoot = cardClone.querySelector('.event-card-v3');

        cardRoot.dataset.eventId = event.id;
        const eventUrl = `event.html?id=${event.id}`;
        cardClone.querySelectorAll('[data-action="go-to-event"]').forEach(el => el.href = eventUrl);
        
        cardClone.querySelector('.card-date').textContent = `Опубликовано ${new Date(event.created_at).toLocaleDateString()}`;
        cardClone.querySelector('.card-title').textContent = event.title;
        cardClone.querySelector('.card-description').textContent = `${(event.description || '').substring(0, 100)}...`;

        const image = cardClone.querySelector('.card-image');
        if (event.image_url) image.src = event.image_url;
        image.alt = event.title;

        const orgLink = cardClone.querySelector('.card-organization');
        const orgPlaceholder = cardClone.querySelector('.card-organization-placeholder');
        if (event.organizations) {
            orgLink.textContent = event.organizations.name;
            orgLink.href = `/?org=${event.organization_id}`;
            orgLink.classList.remove('hidden');
            if(orgPlaceholder) orgPlaceholder.classList.add('hidden');
        }

        const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
        const authorAvatar = event.profiles ? event.profiles.avatar_url : 'https://placehold.co/24x24/f0f2f5/ccc';
        cardClone.querySelector('.card-author-name').textContent = authorName;
        cardClone.querySelector('.card-author-avatar').src = authorAvatar;

        cardClone.querySelector('.comment-count').textContent = event.comment_count;
        const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
        if (isFavorited) {
            cardClone.querySelector('[data-action="toggle-favorite"]').classList.add('active');
        }

        if (isAdmin) {
            cardClone.querySelector('[data-action="edit"]').classList.remove('hidden');
            cardClone.querySelector('[data-action="delete"]').classList.remove('hidden');
        }
        
        eventsContainer.appendChild(cardClone);
    });

    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    if ((events.length + from < count) && paginationControls) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.classList.add('btn', 'btn--primary'); // Используем наши новые классы для кнопок
        loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
        paginationControls.appendChild(loadMoreBtn);
    }
}

