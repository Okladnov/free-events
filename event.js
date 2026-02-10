// =================================================================
// event.js - ВЕРСИЯ С ПАНЕЛЬЮ МОДЕРАЦИИ ДЛЯ АДМИНОВ
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Инициализируем шапку и ждем, пока определится пользователь (из app.js)
    await initializeHeader();
    // 2. Загружаем весь контент страницы
    await loadPageContent();
    // 3. Настраиваем все обработчики событий для страницы
    setupEventListeners();
});

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ ЗАГРУЗКИ КОНТЕНТА
// =================================================================

async function loadPageContent() {
    const eventDetailContainer = document.getElementById('event-detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        eventDetailContainer.innerHTML = `<p class="error-message">Ошибка: ID события не найден.</p>`;
        return;
    }

    eventDetailContainer.innerHTML = `<p>Загрузка события...</p>`;

    try {
        const [eventResponse, commentsResponse] = await Promise.all([
            supabaseClient
                .from('events')
                .select(`*, profiles(full_name), categories(id, name), votes(user_id, value), favorites(user_id)`)
                .eq('id', eventId)
                .single(),
            supabaseClient
                .from('comments')
                .select(`*, profiles(full_name, avatar_url)`)
                .eq('event_id', eventId)
                .order('created_at', { ascending: true })
        ]);

        const { data: event, error: eventError } = eventResponse;
        const { data: comments, error: commentsError } = commentsResponse;

        if (eventError || !event) throw new Error("Событие не найдено.");
        if (commentsError) throw new Error("Ошибка загрузки комментариев.");

        // "Рисуем" страницу
        renderPage(event, comments);

    } catch (error) {
        document.title = "Ошибка";
        eventDetailContainer.innerHTML = `<p class="error-message">${error.message}</p>`;
        console.error(error);
    }
}

// =================================================================
// ФУНКЦИИ "ОТРИСОВКИ" (RENDER)
// =================================================================

function renderPage(event, comments) {
    const eventDetailContainer = document.getElementById('event-detail-container');
    document.title = event.title;

    const categoriesHtml = (event.categories || [])
        .map(cat => `<a href="/?category=${cat.id}" class="tag">${sanitizeHTML(cat.name)}</a>`)
        .join('');
    
    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
    const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;

    // ИЗМЕНЕНО: Добавляем HTML для панели модерации, если нужно
    const moderationPanelHtml = (isAdmin && !event.is_approved) ? `
        <div class="moderation-panel">
            <div class="moderation-panel-title">⭐ Панель модератора</div>
            <p>Это событие ожидает вашего одобрения.</p>
            <div class="moderation-panel-actions">
                <button class="btn btn--primary" data-action="approve-event">Одобрить</button>
                <button class="btn btn--danger" data-action="delete-event">Удалить</button>
            </div>
        </div>
    ` : '';

    const eventHtml = `
        ${moderationPanelHtml} 
        <div class="event-detail-header">
            <img src="${event.image_url || 'https://placehold.co/1200x400/1e1e1e/ff6a00?text=Нет+фото'}" alt="${event.title}" class="event-detail-image">
            <button class="card-save-btn ${isFavorited ? 'active' : ''}" data-action="toggle-favorite">
                ${isFavorited ? '❤️' : '🤍'}
            </button>
            <div class="event-detail-title-card">
                <div class="event-detail-tags">${categoriesHtml}</div>
                <h1>${sanitizeHTML(event.title)}</h1>
                <p>Добавил: ${sanitizeHTML(authorName)}</p>
            </div>
        </div>
        <div class="event-detail-body">
            <div class="event-detail-main">
                <h2>Детали события</h2>
                <div class="info-grid">
                    <div class="info-item"><strong>📍 Город</strong><span>${sanitizeHTML(event.city) || 'Онлайн'}</span></div>
                    <div class="info-item"><strong>🗓️ Дата</strong><span>${event.event_date ? new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Дата не указана'}</span></div>
                    <div class="info-item" id="rating-section">
                        ${renderRating(event)}
                    </div>
                </div>
                <h2>Описание</h2>
                <div class="event-description">${DOMPurify.sanitize(event.description || 'Описание отсутствует.', { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'a', 'blockquote'] })}</div>
            </div>
            <div class="event-detail-sidebar">
                <h3>Комментарии</h3>
                <div class="comments-section">
                    <div id="comments-list">
                        ${comments.map(renderComment).join('')}
                    </div>
                    ${currentUser ? `
                    <form id="comment-form">
                        <input id="comment-input" placeholder="Написать комментарий..." required>
                        <button type="submit">Отправить</button>
                    </form>
                    ` : '<p><a href="/">Войдите</a>, чтобы оставить комментарий</p>'}
                </div>
            </div>
        </div>`;

    eventDetailContainer.innerHTML = eventHtml;
}

// ... (renderComment и renderRating без изменений)

function renderComment(comment) {
    // ...
}

function renderRating(event) {
    // ...
}


// =================================================================
// НАСТРОЙКА ОБРАБОТЧИКОВ СОБЫТИЙ
// =================================================================

function setupEventListeners() {
    const eventDetailContainer = document.getElementById('event-detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    eventDetailContainer.addEventListener('click', async (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.action;

        // ИЗМЕНЕНО: Обработка кнопок модерации
        if (action === 'approve-event') {
            await handleEventAction('approve', eventId, actionElement);
        } else if (action === 'delete-event') {
            if (confirm('Вы уверены, что хотите НАВСЕГДА удалить это событие?')) {
                await handleEventAction('delete', eventId, actionElement);
            }
        }

        // Старая логика для других кнопок
        if (!currentUser && (action === 'toggle-favorite' || action === 'vote')) {
            alert('Пожалуйста, войдите, чтобы выполнить это действие.');
            return;
        }
        
        if (action === 'toggle-favorite') {
            handleToggleFavorite(eventId, actionElement);
        } else if (action === 'vote') {
            const value = parseInt(actionElement.dataset.value, 10);
            handleVote(eventId, value);
        }
    });

    eventDetailContainer.addEventListener('submit', (event) => {
        if (event.target.id === 'comment-form') {
            event.preventDefault();
            handleAddComment(eventId, event.target);
        }
    });
}

// =================================================================
// ФУНКЦИИ-ОБРАБОТЧИКИ ДЕЙСТВИЙ
// =================================================================

// ... (handleAddComment, handleToggleFavorite, handleVote без изменений)

async function handleAddComment(eventId, formElement) {
    // ...
}

async function handleToggleFavorite(eventId, buttonElement) {
    // ...
}

async function handleVote(eventId, value) {
    // ...
}


// ИЗМЕНЕНО: Новая функция для обработки действий модератора
async function handleEventAction(action, eventId, button) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Выполняем...';

    let error;

    if (action === 'approve') {
        const { error: approveError } = await supabaseClient.from('events').update({ is_approved: true }).eq('id', eventId);
        error = approveError;
    } else if (action === 'delete') {
        const { error: deleteError } = await supabaseClient.from('events').delete().eq('id', eventId);
        error = deleteError;
    }

    if (error) {
        alert(`Ошибка: ${error.message}`);
        button.disabled = false;
        button.textContent = originalText;
    } else {
        const panel = document.querySelector('.moderation-panel');
        if (action === 'approve') {
            panel.innerHTML = '<p style="color: var(--success-color);">✅ Событие успешно одобрено!</p>';
        } else if (action === 'delete') {
            document.querySelector('.event-detail-header').remove();
            document.querySelector('.event-detail-body').remove();
            panel.innerHTML = '<p style="color: var(--danger-color);">❌ Событие удалено. <a href="/admin.html">Вернуться в админку</a></p>';
        }
    }
}
