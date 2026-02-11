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
    const authorAvatar = event.avatar_url || 'https://placehold.co/40x40/f0f2f5/ccc?text=AV';
    
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
                    
                    <div class="event-author-info">
                        <a href="/profile.html?id=${event.created_by}">
                            <img src="${authorAvatar}" alt="${authorName}" class="author-avatar-large">
                        </a>
                        <div class="author-details">
                            <a href="/profile.html?id=${event.created_by}" class="author-name-link">${sanitizeHTML(authorName)}</a>
                            <div class="published-date">Опубликовано ${new Date(event.created_at).toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric'})}</div>
                        </div>
                    </div>

                    <h1>${sanitizeHTML(event.title)}</h1>
                    
                    <div class="event-meta">
                        <div class="meta-item">
                            <span>📍</span>
                            <strong>Город:</strong>
                            <span>${sanitizeHTML(event.city) || 'Онлайн'}</span>
                        </div>
                        <div class="meta-item">
                            <span>🗓️</span>
                            <strong>Дата:</strong>
                            <span>${event.event_date ? new Date(event.event_date).toLocaleString('ru-RU', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'}) : 'Не указана'}</span>
                        </div>
                        ${event.organization_name ? `
                        <div class="meta-item">
                            <span>🏢</span>
                            <strong>Организатор:</strong>
                            <a href="/?org=${event.organization_id}">${sanitizeHTML(event.organization_name)}</a>
                        </div>` : ''}
                    </div>

                    <div class="event-description">${DOMPurify.sanitize(event.description || 'Описание отсутствует.')}</div>
                </div>
                ${event.link ? `
    <div class="event-source-link-wrapper">
        <a href="${event.link}" target="_blank" class="btn btn--primary">
            Перейти к источнику <span>→</span>
        </a>
    </div>
` : ''}
                <div class="comments-section">
    <!-- ИЗМЕНЕНО: Заголовок стал кнопкой-спойлером -->
    <h3 id="comments-toggle" class="comments-toggle">
        Комментарии (${comments.length}) <span>▼</span>
    </h3>
    <!-- ИЗМЕНЕНО: Блоки обернуты в контейнеры и скрыты по умолчанию -->
    <div id="comments-list" class="hidden">
        ${comments.length > 0 ? comments.map(renderComment).join('') : '<p>Комментариев пока нет.</p>'}
    </div>
    <div id="comment-form-wrapper" class="hidden">
        ${currentUser ? `
        <form id="comment-form">
            <input id="comment-input" placeholder="Написать комментарий..." required class="input-group-input">
            <button type="submit" class="btn btn--primary">Отправить</button>
        </form>
        ` : '<p><a href="/">Войдите</a>, чтобы оставить комментарий.</p>'}
    </div>
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
        
        // ИЗМЕНЕНО: Добавляем обработку клика по заголовку комментариев
        if (event.target.id === 'comments-toggle') {
            const commentsList = document.getElementById('comments-list');
            const commentForm = document.getElementById('comment-form-wrapper');
            commentsList.classList.toggle('hidden');
            if(commentForm) commentForm.classList.toggle('hidden');
            return;
        }

        if (!actionElement) return;

        const action = actionElement.dataset.action;

        // ... (остальная логика кликов без изменений)
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
