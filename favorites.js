// =================================================================
// favorites.js - ФИНАЛЬНАЯ, ИСПРАВЛЕННАЯ ВЕРСИЯ
// =================================================================

// =================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СТРАНИЦЫ
// =================================================================

const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
const PAGE_SIZE = 9;
let currentPage = 0;
let totalFavoritesCount = 0;

// ИСПРАВЛЕНО: Добавляем недостающую функцию
function sanitizeForAttribute(text) {
    if (!text) return '';
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// =================================================================
// ТОЧКА ВХОДА
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Используем ГОТОВУЮ функцию из app.js. Она сама определит пользователя.
    await initializeHeader();

    // 2. Если пользователя нет, показываем сообщение и выходим.
    if (!currentUser) {
        eventsContainer.innerHTML = '<p>Пожалуйста, <a href="/">войдите в свой аккаунт</a>, чтобы увидеть избранные события.</p>';
        return;
    }

    // 3. Загружаем страницу и настраиваем обработчики.
    await loadFavoritesPage(true);
    setupFavoritesEventListeners();
});

// =================================================================
// ЗАГРУЗКА И ОТОБРАЖЕНИЕ
// =================================================================

async function loadFavoritesPage(isInitialLoad = false) {
    if (isInitialLoad) {
        currentPage = 0;
        eventsContainer.innerHTML = '<p>Загрузка ваших избранных событий...</p>';
        paginationControls.innerHTML = '';
    }

    const from = currentPage * PAGE_SIZE;

    // ИСПРАВЛЕНО: Запрашиваем сначала ID, потом сами события
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
        .from('events_with_details') // Используем наше рабочее "супер-представление"
        .select('*')
        .in('id', eventIds);

    if (error) {
        eventsContainer.innerHTML = `<p class="error-message">Ошибка загрузки событий: ${error.message}</p>`;
        return;
    }

    if (isInitialLoad) {
        eventsContainer.innerHTML = ''; // Очищаем "загрузку"
    }
    
    events.forEach(event => {
        eventsContainer.insertAdjacentHTML('beforeend', renderFavoriteCard(event));
    });
    
    updatePagination();
}

function renderFavoriteCard(event) {
    const dateHtml = event.event_date ? new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Дата не указана';
    const categoriesHtml = event.category_name ? `<span class="tag">${sanitizeHTML(event.category_name)}</span>` : '';

    return `
      <div class="event-card-new" data-event-id="${event.id}">
        <a href="event.html?id=${event.id}" class="event-card-new-image-link">
          <img src="${event.image_url || 'https://placehold.co/400x400/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
        </a>
        <div class="event-card-new-content">
          <div class="card-categories">${categoriesHtml}</div>
          <a href="event.html?id=${event.id}" class="event-card-new-title-link">
            <h3>${sanitizeHTML(event.title)}</h3>
          </a>
          <div class="meta">
              <div class="meta-item"><span>🗓️</span><span>${dateHtml}</span></div>
              <div class="meta-item"><span>📍</span><span>${sanitizeHTML(event.city) || 'Онлайн'}</span></div>
          </div>
        </div>
        <div class="event-card-new-actions">
          <button class="card-save-btn active" data-action="remove-from-favorites" title="Удалить из избранного">❤️</button>
        </div>
      </div>`;
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

// =================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// =================================================================

function setupFavoritesEventListeners() {
    eventsContainer.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action="remove-from-favorites"]');
        if (!button) return;

        const card = button.closest('.event-card-new');
        const eventId = card.dataset.eventId;
        
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        
        setTimeout(() => card.remove(), 500);

        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
        if (error) {
            alert('Не удалось удалить событие из избранного.');
            // Можно добавить логику возвращения карточки, если нужно
        } else {
            totalFavoritesCount--;
            if (totalFavoritesCount === 0) {
                 eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
                 paginationControls.innerHTML = '';
            }
        }
    });
}
