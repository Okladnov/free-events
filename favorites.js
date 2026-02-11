// =================================================================
// favorites.js - ФИНАЛЬНАЯ ВЕРСИЯ С КАРТОЧКАМИ КАК НА ГЛАВНОЙ
// =================================================================

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
        .select(`*, favorites(user_id)`) // Добавляем favorites, чтобы правильно отображать статус
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
        
        cardClone.querySelector('.card-date').textContent = `Опубликовано ${new Date(event.created_at).toLocaleDateString()}`;
        cardClone.querySelector('.card-title').textContent = event.title;
        cardClone.querySelector('.card-description').textContent = `${(event.description || '').substring(0, 100)}...`;
        
        const image = cardClone.querySelector('.card-image');
        if (event.image_url) image.src = event.image_url;
        image.alt = event.title;
        
        const orgLink = cardClone.querySelector('.card-organization');
        if (event.organization_name) {
            orgLink.textContent = event.organization_name;
            orgLink.href = `/?org=${event.organization_id}`;
            orgLink.classList.remove('hidden');
        }

        const authorName = event.full_name || 'Аноним';
        const authorAvatar = event.avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc';
        cardClone.querySelector('.card-author-name').textContent = authorName;
        cardClone.querySelector('.card-author-avatar').src = authorAvatar;
        
        cardClone.querySelector('.comment-count').textContent = event.comment_count;
        
        // Все события на этой странице - избранные, поэтому кнопка всегда активна
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
        
        // На этой странице клик по кнопке "Избранное" всегда означает удаление
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
