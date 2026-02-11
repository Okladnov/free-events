// =================================================================
// event.js - ФИНАЛЬНАЯ ВЕРСИЯ С НОВЫМ ДИЗАЙНОМ СТРАНИЦЫ
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
        const { data: event, error: eventError } = await supabaseClient
            .from('events_with_details')
            .select(`*, votes(user_id, value), favorites(user_id)`)
            .eq('id', eventId)
            .single();

        const { data: comments, error: commentsError } = await supabaseClient
            .from('comments')
            .select(`*, profiles(full_name, avatar_url)`)
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });

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
        <div class="event-layout">
            <div class="event-image-column">
                 <img src="${event.image_url || 'https://placehold.co/300x300/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}" class="event-detail-image">
            </div>
            <div class="event-content-column">
                <div class="event-main-content">
                    <h1>${sanitizeHTML(event.title)}</h1>
                    <div class="event-meta">
                        <div class="meta-item"><strong>Автор:</strong> <span>${sanitizeHTML(authorName)}</span></div>
                        <div class="meta-item"><strong>Город:</strong> <span>${sanitizeHTML(event.city) || 'Онлайн'}</span></div>
                        <div class="meta-item"><strong>Дата:</strong> <span>${event.event_date ? new Date(event.event_date).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'}) : 'Не указана'}</span></div>
                    </div>
                    <div class="event-description">${DOMPurify.sanitize(event.description || 'Описание отсутствует.')}</div>
                </div>
                <div class="comments-section">
                    <h3>Комментарии (${comments.length})</h3>
                    <div id="comments-list">
                        ${comments.length > 0 ? comments.map(renderComment).join('') : '<p>Комментариев пока нет.</p>'}
                    </div>
                    ${currentUser ? `
                    <form id="comment-form">
                        <input id="comment-input" placeholder="Написать комментарий..." required class="input-group-input">
                        <button type="submit" class="btn btn--primary">Отправить</button>
                    </form>
                    ` : '<p><a href="/">Войдите</a>, чтобы оставить комментарий.</p>'}
                </div>
            </div>
        </div>
    `;

    eventDetailContainer.innerHTML = eventHtml;
}

function renderComment(comment) {
    const authorName = comment.profiles ? sanitizeHTML(comment.profiles.full_name) : 'Аноним';
    const authorAvatar = comment.profiles ? comment.profiles.avatar_url : 'https://placehold.co/36x36/f0f2f5/ccc';
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

// =================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ И ПРОЧИЕ ФУНКЦИИ
// (Остальная часть файла без изменений)
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
    });

    eventDetailContainer.addEventListener('submit', (event) => {
        if (event.target.id === 'comment-form') {
            event.preventDefault();
            handleAddComment(eventId, event.target);
        }
    });
}

async function handleAddComment(eventId, formElement) {
    const input = formElement.querySelector('input');
    const button = formElement.querySelector('button');
    const content = input.value.trim();
    if (!content) return;
    
    input.disabled = true;
    button.disabled = true;
    try {
        const { data: newComment, error } = await supabaseClient
            .from('comments')
            .insert({ content, event_id: eventId, user_id: currentUser.id })
            .select(`*, profiles(full_name, avatar_url)`)
            .single();
        if (error) throw error;
        
        const commentsList = document.getElementById('comments-list');
        if (commentsList.querySelector('p')) {
            commentsList.innerHTML = '';
        }
        commentsList.insertAdjacentHTML('beforeend', renderComment(newComment));
        input.value = '';
    } catch (error) {
        console.error("Ошибка добавления комментария:", error);
        alert("Не удалось добавить комментарий.");
    } finally {
        input.disabled = false;
        button.disabled = false;
    }
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
            document.querySelector('.event-layout').remove();
            panel.innerHTML = '<p style="color: var(--danger-color);">❌ Событие удалено. <a href="/admin.html">Вернуться в админку</a></p>';
        }
    }
}

function sanitizeForAttribute(text) {
    if (!text) return '';
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
