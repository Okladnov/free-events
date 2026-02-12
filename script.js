// =================================================================
// script.js - ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
// =================================================================
function getNoun(number, one, two, five) {
    let n = Math.abs(number);
    n %= 100;
    if (n >= 5 && n <= 20) {
        return five;
    }
    n %= 10;
    if (n === 1) {
        return one;
    }
    if (n >= 2 && n <= 4) {
        return two;
    }
    return five;
}

// Главная функция для форматирования "Опубликовано ... назад"
function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    
    if (seconds < 60) {
        return "Опубликовано только что";
    }
    let interval = seconds / 31536000;
    if (interval > 1) {
        const years = Math.floor(interval);
        return `Опубликовано ${years} ${getNoun(years, 'год', 'года', 'лет')} назад`;
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        const months = Math.floor(interval);
        return `Опубликовано ${months} ${getNoun(months, 'месяц', 'месяца', 'месяцев')} назад`;
    }
    interval = seconds / 86400;
    if (interval > 1) {
        const days = Math.floor(interval);
        return `Опубликовано ${days} ${getNoun(days, 'день', 'дня', 'дней')} назад`;
    }
    interval = seconds / 3600;
    if (interval > 1) {
        const hours = Math.floor(interval);
        return `Опубликовано ${hours} ${getNoun(hours, 'час', 'часа', 'часов')} назад`;
    }
    interval = seconds / 60;
    if (interval > 1) {
        const minutes = Math.floor(interval);
        return `Опубликовано ${minutes} ${getNoun(minutes, 'минуту', 'минуты', 'минут')} назад`;
    }
    return `Опубликовано ${Math.floor(seconds)} ${getNoun(seconds, 'секунду', 'секунды', 'секунд')} назад`;
}
const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
const PAGE_SIZE = 9;
let currentPage = 0;
let currentCategoryId = null;
let currentOrganizationId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadEvents(true);
    setupIndexPageListeners();
    loadAndDisplayCategories();
    setupCategoryListeners();
});
const urlParams = new URLSearchParams(window.location.search);
    const orgIdFromUrl = urlParams.get('org');
    if (orgIdFromUrl) {
        currentOrganizationId = orgIdFromUrl;
    }
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

    if (eventsContainer) {
        eventsContainer.addEventListener('click', async (event) => {
            const target = event.target;
            const actionElement = target.closest('[data-action]');
            if (!actionElement) return;

            const action = actionElement.dataset.action;
            const card = target.closest('.event-card-v3');
            const eventId = card ? card.dataset.eventId : null;

            if (actionElement.tagName === 'BUTTON' || (actionElement.tagName === 'A' && actionElement.href.endsWith('#'))) {
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

async function deleteEventHandler(eventId, cardElement) {
    if (!confirm('Вы уверены, что хотите удалить это событие?')) return;
    cardElement.style.opacity = '0.5';
    const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
    if (error) {
        alert('Ошибка удаления.');
        console.error('Ошибка удаления:', error.message);
        cardElement.style.opacity = '1';
    } else {
        cardElement.remove();
    }
}

async function toggleFavoriteHandler(eventId, buttonElement) {
    if (!currentUser) {
        document.getElementById('loginBtn').click();
        return;
    }
    buttonElement.disabled = true;
    const isFavorited = buttonElement.classList.contains('active');
    
    const { error } = isFavorited
        ? await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id })
        : await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
    
    if (!error) {
        buttonElement.classList.toggle('active');
    } else {
        console.error('Ошибка избранного:', error.message);
    }
    buttonElement.disabled = false;
}

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

    const allButtonClone = template.content.cloneNode(true);
    const allButton = allButtonClone.querySelector('.category-pill');
    allButton.textContent = 'Все';
    allButton.classList.add('active');
    allButton.dataset.categoryId = 'all';
    container.appendChild(allButtonClone);

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

async function loadEvents(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 0;
        if(eventsContainer) eventsContainer.innerHTML = '<p>Загрузка событий...</p>';
        if(paginationControls) paginationControls.innerHTML = '';
    }
    const searchTerm = document.getElementById('search-input').value.trim();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    // ИСПРАВЛЕНО: Обращаемся к новому представлению 'events_with_details'
    let query = supabaseClient
        .from('events_with_details')
        .select(`*, favorites(user_id)`, { count: 'exact' })
        .eq('is_approved', true);

    if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    }

    if (currentCategoryId) {
        query = query.eq('category_id', currentCategoryId);
    }
if (currentOrganizationId) {
        query = query.eq('organization_id', currentOrganizationId);
    }
    const { data: events, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to - 1);

    if (error) {
        console.error("Ошибка загрузки событий:", error);
        if (isNewSearch && eventsContainer) eventsContainer.innerHTML = `<p>Ошибка загрузки событий: ${error.message}</p>`;
        return;
    }

    if (isNewSearch && (!events || events.length === 0)) {
        eventsContainer.innerHTML = '<p>Событий по вашему запросу не найдено.</p>';
        if(paginationControls) paginationControls.innerHTML = '';
        return;
    }
    
    if (isNewSearch) {
        eventsContainer.innerHTML = "";
    }
    
    const cardTemplate = document.getElementById('event-card-template');
    if (!cardTemplate || !eventsContainer) return;

    events.forEach(event => {
        const cardClone = cardTemplate.content.cloneNode(true);
        const cardRoot = cardClone.querySelector('.event-card-v3');
        cardRoot.dataset.eventId = event.id;
        const eventUrl = `event.html?id=${event.id}`;
        cardClone.querySelectorAll('[data-action="go-to-event"]').forEach(el => el.href = eventUrl);
        
        const eventDate = event.event_date 
    ? `Событие: ${new Date(event.event_date).toLocaleString('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}`
    : `Опубликовано: ${new Date(event.created_at).toLocaleDateString()}`;
const timeAgoText = timeAgo(event.created_at);
cardClone.querySelector('.card-date').textContent = timeAgoText;
        cardClone.querySelector('.card-title').textContent = event.title;
        const descriptionEl = cardClone.querySelector('.card-description');
if (event.event_date) {
    const startDate = new Date(event.event_date).toLocaleString('ru-RU', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
    descriptionEl.innerHTML = `<strong>Начало события:</strong> ${startDate}`; // innerHTML чтобы <strong> сработал
} else {
    descriptionEl.remove(); // Если даты нет, просто убираем блок
}
        
        const image = cardClone.querySelector('.card-image');
        if (event.image_url) image.src = event.image_url;
        image.alt = event.title;
        
        const orgLink = cardClone.querySelector('.card-organization');
        const orgPlaceholder = cardClone.querySelector('.card-organization-placeholder');
        if (event.organization_name) {
            orgLink.textContent = event.organization_name;
            orgLink.href = `/?org=${event.organization_id}`;
            orgLink.classList.remove('hidden');
            if(orgPlaceholder) orgPlaceholder.classList.add('hidden');
        }

        const authorWrapper = cardClone.querySelector('.card-author');
const authorLink = document.createElement('a');
authorLink.href = `/profile.html?id=${event.created_by}`;
authorLink.classList.add('card-author-link');
authorLink.innerHTML = `
    <img src="${event.avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc'}" alt="${event.full_name || 'Аноним'}" class="card-author-avatar">
    <span class="card-author-name">${event.full_name || 'Аноним'}</span>
`;

authorWrapper.innerHTML = '';
authorWrapper.appendChild(authorLink);
        
        cardClone.querySelector('.comment-count').textContent = event.comment_count;
        
        const isFavorited = currentUser && event.favorites ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
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
        loadMoreBtn.classList.add('btn', 'btn--primary');
        loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
        paginationControls.appendChild(loadMoreBtn);
    }
}
