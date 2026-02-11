// =================================================================
// event.js - ФИНАЛЬНАЯ ВЕРСИЯ С ИСПОЛЬЗОВАНИЕМ "СУПЕР-ПРЕДСТАВЛЕНИЯ"
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader();
    await loadPageContent();
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
        // ИСПРАВЛЕНО: Запрашиваем всё из одного "умного" представления
        const eventResponse = await supabaseClient
            .from('events_with_details')
            .select(`*, votes(user_id, value), favorites(user_id)`)
            .eq('id', eventId)
            .single();

        const commentsResponse = await supabaseClient
            .from('comments')
            .select(`*, profiles(full_name, avatar_url)`)
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });

        const { data: event, error: eventError } = eventResponse;
        const { data: comments, error: commentsError } = commentsResponse;

        if (eventError || !event) throw new Error("Событие не найдено или к нему нет доступа.");
        if (commentsError) throw new Error("Ошибка загрузки комментариев.");

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

    // ИСПРАВЛЕНО: Берём название категории прямо из event
    const categoriesHtml = event.category_name ? `<a href="/?category=${event.category_id}" class="tag">${sanitizeHTML(event.category_name)}</a>` : '';
    
    // ИСПРАВЛЕНО: Берём имя автора прямо из event
    const authorName = event.full_name || 'Аноним';
    const isFavorited = currentUser && event.favorites ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;

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
            <img src="${event.image_url || 'https://placehold.co/1200x400/1e1e1e/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}" class="event-detail-image">
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

function renderComment(comment) {
    const authorName = comment.profiles ? sanitizeHTML(comment.profiles.full_name) : 'Аноним';
    const authorAvatar = comment.profiles ? comment.profiles.avatar_url : 'https://placehold.co/32x32/f0f2f5/ccc';
    return `
        <div class="comment">
            <img src="${authorAvatar}" alt="avatar" class="comment-avatar">
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${authorName}</span>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <p>${sanitizeHTML(comment.content)}</p>
            </div>
        </div>
    `;
}

function renderRating(event) {
    const rating = event.votes ? event.votes.reduce((acc, vote) => acc + vote.value, 0) : 0;
    const hasVoted = currentUser && event.votes ? event.votes.some(v => v.user_id === currentUser.id) : false;
    let scoreClass = '', scoreIcon = '';
    if (rating < 0) { scoreClass = 'score-cold'; scoreIcon = '❄️'; }
    else if (rating > 20) { scoreClass = 'score-fire'; scoreIcon = '🔥🔥'; }
    else if (rating > 5) { scoreClass = 'score-hot'; scoreIcon = '🔥'; }
    return `
        <strong>⭐ Рейтинг</strong>
        <div class="vote">
            <button data-action="vote" data-value="1" ${hasVoted ? 'disabled' : ''} title="Нравится">▲</button>
            <span class="score ${scoreClass}">${rating} ${scoreIcon}</span>
            <button data-action="vote" data-value="-1" ${hasVoted ? 'disabled' : ''} title="Не нравится">▼</button>
        </div>
    `;
}

// =================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// =================================================================

function setupEventListeners() {
    const eventDetailContainer = document.getElementById('event-detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    eventDetailContainer.addEventListener('click', async (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.action;

        if (action === 'approve-event') {
            await handleEventAction('approve', eventId, actionElement);
        } else if (action === 'delete-event') {
            if (confirm('Вы уверены, что хотите НАВСЕГДА удалить это событие?')) {
                await handleEventAction('delete', eventId, actionElement);
            }
        }

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

async function handleAddComment(eventId, formElement) {
    // ... (без изменений)
}

async function handleToggleFavorite(eventId, buttonElement) {
    // ... (без изменений)
}

async function handleVote(eventId, value) {
    // ... (без изменений)
}

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

// ИСПРАВЛЕНО: Добавляем недостающую функцию
function sanitizeForAttribute(text) {
    if (!text) return '';
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
