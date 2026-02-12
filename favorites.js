// =================================================================
// favorites.js - ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
// =================================================================

// --- ДОБАВЛЕНЫ НЕДОСТАЮЩИЕ ФУНКЦИИ ---
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

function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return "Опубликовано только что";
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
// --- КОНЕЦ БЛОКА С НОВЫМИ ФУНКЦИЯМИ ---


const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
const PAGE_SIZE = 9;
let currentPage = 0;
let totalFavoritesCount = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader();
    if (!currentUser) {
        eventsContainer.innerHTML = '<p>Пожалуйста, <a href="/">войдите в свой аккаунт</a>, чтобы увидеть избранные события.</p>';
        return;
    }
    await loadFavoritesPage(true);
    setupFavoritesEventListeners();
});

async function loadFavoritesPage(isInitialLoad = false) {
    if (isInitialLoad) {
        currentPage = 0;
        eventsContainer.innerHTML = '<p>Загрузка ваших избранных событий...</p>';
        paginationControls.innerHTML = '';
    }
    const from = currentPage * PAGE_SIZE;

    const { data: favoriteIds, error: favError, count } = await supabaseClient
        .from('favorites')
        .select('event_id', { count: 'exact' })
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
    
    if (favError) {
        eventsContainer.innerHTML = `<p class="error-message">Ошибка загрузки: ${favError.message}</p>`;
        return;
    }
    if (isInitialLoad) {
        totalFavoritesCount = count;
    }
    
    if (!favoriteIds || favoriteIds.length === 0) {
        if (isInitialLoad) {
            eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
        }
        return;
    }

    const eventIds = favoriteIds.map(fav => fav.event_id);
    
    const { data: events, error } = await supabaseClient
        .from('events_with_details')
        .select(`*, favorites(user_id)`)
        .in('id', eventIds);

    if (error) {
        eventsContainer.innerHTML = `<p class="error-message">Ошибка загрузки событий: ${error.message}</p>`;
        return;
    }
    if (isInitialLoad) {
        eventsContainer.innerHTML = '';
    }
    
    const cardTemplate = document.getElementById('event-card-template');
    if (!cardTemplate) {
        console.error("Шаблон #event-card-template не найден!");
        return;
    }

    events.forEach(event => {
        const cardClone = cardTemplate.content.cloneNode(true);
        const cardRoot = cardClone.querySelector('.event-card-v3');
        cardRoot.dataset.eventId = event.id;
        const eventUrl = `event.html?id=${event.id}`;
        cardClone.querySelectorAll('[data-action="go-to-event"]').forEach(el => el.href = eventUrl);
        
        const timeAgoText = timeAgo(event.created_at);
        cardClone.querySelector('.card-date').textContent = timeAgoText;
        
        cardClone.querySelector('.card-title').textContent = event.title;
        
        const descriptionEl = cardClone.querySelector('.card-description');
        if (event.event_date) {
            const startDate = new Date(event.event_date).toLocaleString('ru-RU', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
            descriptionEl.innerHTML = `<strong>Начало:</strong> ${startDate}`;
        } else {
            descriptionEl.remove();
        }

        const image = cardClone.querySelector('.card-image');
        if (event.image_url) image.src = event.image_url;
        image.alt = event.title;
        
        const orgLink = cardClone.querySelector('.card-organization');
        if (event.organization_name) {
            orgLink.textContent = event.organization_name;
            orgLink.href = `/?org=${event.organization_id}`;
            orgLink.classList.remove('hidden');
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
        
        cardClone.querySelector('.comment-count').textContent = event.comment_count || 0;
        
        const favoriteButton = cardClone.querySelector('[data-action="toggle-favorite"]');
        if (favoriteButton) {
            favoriteButton.classList.add('active');
        }
        
        if (currentUser.id === event.created_by || isAdmin) {
            cardClone.querySelector('[data-action="edit"]').classList.remove('hidden');
            cardClone.querySelector('[data-action="delete"]').classList.remove('hidden');
        }
        
        eventsContainer.appendChild(cardClone);
    });

    updatePagination();
}

function updatePagination() {
    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    const currentlyLoaded = (currentPage + 1) * PAGE_SIZE;
    if (currentlyLoaded < totalFavoritesCount) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.classList.add('btn', 'btn--primary');
        loadMoreBtn.onclick = () => {
            currentPage++;
            loadFavoritesPage(false);
        };
        paginationControls.appendChild(loadMoreBtn);
    }
}

function setupFavoritesEventListeners() {
    eventsContainer.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action="toggle-favorite"]');
        if (!button) return;

        const card = button.closest('.event-card-v3');
        const eventId = card.dataset.eventId;
        
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        
        setTimeout(() => card.remove(), 500);

        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });

        if (error) {
            alert('Не удалось удалить событие из избранного.');
        } else {
            totalFavoritesCount--;
            if (totalFavoritesCount === 0) {
                 eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
                 paginationControls.innerHTML = '';
            }
        }
    });
}
