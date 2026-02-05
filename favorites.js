// =================================================================
// favorites.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННАЯ ВЕРСИЯ
// =================================================================

// =================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СТРАНИЦЫ
// =================================================================
const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
const PAGE_SIZE = 9;
let currentPage = 0;
let totalFavoritesCount = 0;

// =================================================================
// ТОЧКА ВХОДА
// =================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Используем ГОТОВУЮ функцию из app.js. Она сама определит пользователя.
    await initializeHeader();

    // 2. Если пользователя нет, показываем сообщение и выходим.
    if (!currentUser) {
        eventsContainer.innerHTML = '<p>Пожалуйста, <a href="/login.html">войдите в свой аккаунт</a>, чтобы увидеть избранные события.</p>';
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

    // ЗАПРАШИВАЕМ НАШЕ НОВОЕ "УМНОЕ" ПРЕДСТАВЛЕНИЕ (VIEW)
    const { data: events, error, count } = await supabaseClient
        .from('user_favorite_events') // <--- Вот магия!
        .select(`*, categories (id, name)`, { count: 'exact' }) // Запрашиваем count сразу
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

    if (error) {
        eventsContainer.innerHTML = `<p class="error-message">Ошибка загрузки: ${error.message}</p>`;
        return;
    }

    if (isInitialLoad) {
        totalFavoritesCount = count;
        eventsContainer.innerHTML = ''; // Очищаем "загрузку"
    }

    if (!events || events.length === 0) {
        if (isInitialLoad) {
            eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
        }
        return;
    }

    // "Рисуем" карточки
    events.forEach(event => {
        eventsContainer.insertAdjacentHTML('beforeend', renderFavoriteCard(event));
    });

    // Обновляем пагинацию
    updatePagination();
}

function renderFavoriteCard(event) {
    const dateHtml = event.event_date ? new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Дата не указана';
    const categoriesHtml = (event.categories || [])
        .map(cat => `<span class="tag">${sanitizeHTML(cat.name)}</span>`)
        .join('');

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
        
        // Оптимистичное удаление: сначала убираем с экрана, потом отправляем запрос
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        
        setTimeout(() => card.remove(), 500);

        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });

        if (error) {
            // Если произошла ошибка, можно вернуть карточку или показать уведомление
            alert('Не удалось удалить событие из избранного.');
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        } else {
            totalFavoritesCount--;
            // Проверяем, не пустой ли контейнер после удаления
            if (totalFavoritesCount === 0) {
                 eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
                 paginationControls.innerHTML = '';
            }
        }
    });
}
