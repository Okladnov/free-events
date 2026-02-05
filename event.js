// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ ДЕТАЛЬНОГО ПРОСМОТРА - event.html (event.js)
// =================================================================
// Важно: supabaseClient и currentUser уже созданы в script.js.

// --- 1. Функция-инициализатор для этой страницы ---
function initializeEventDetailPage() {
    const eventDetailContainer = document.getElementById('event-detail-container');
    // Если мы не на странице детального просмотра, ничего не делаем
    if (!eventDetailContainer) return;

    loadEventDetails();
}


// --- 2. Основная функция загрузки данных ---
async function loadEventDetails() {
    const eventDetailContainer = document.getElementById('event-detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        eventDetailContainer.innerHTML = `<p class="error-message">Ошибка: ID события не найден.</p>`;
        return;
    }

    // Загружаем всю нужную информацию одним запросом
    const { data: event, error } = await supabaseClient
        .from('events_with_details') // Используем наше view
        .select('*')
        .eq('id', eventId)
        .single();
    
    if (error || !event) {
        document.title = "Событие не найдено";
        eventDetailContainer.innerHTML = `<p class="error-message">Событие не найдено.</p>`;
        return;
    }

    // Загружаем комментарии отдельно
    const { data: comments } = await supabaseClient
        .from('comments')
        .select('*, profiles(full_name, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

    // --- Отображение всей информации ---
    document.title = sanitizeForAttribute(event.title);

    const isFavorited = currentUser ? (event.favorited_by || []).includes(currentUser.id) : false;
    const hasVoted = currentUser ? (event.voted_by || []).includes(currentUser.id) : false;

    // Используем глобальную функцию sanitizeHTML из script.js.
    // Для описания можно сделать более "мягкую" версию, если нужно.
    const descriptionHTML = DOMPurify.sanitize(event.description, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'a'] });
    
    const eventHtml = `
        <div class="event-detail-header">
            <img src="${sanitizeForAttribute(event.image_url) || 'https://placehold.co/1200x400/1e1e1e/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}" class="event-detail-image">
            <div class="event-detail-title-card">
                <div class="event-detail-tags">
                    <a href="/?category=${event.category_id}" class="tag">${sanitizeHTML(event.category_name)}</a>
                </div>
                <h1>${sanitizeHTML(event.title)}</h1>
                <p>Добавил: ${sanitizeHTML(event.author_full_name || 'Аноним')}</p>
            </div>
        </div>
        <div class="event-detail-body">
            <div class="event-detail-main">
                <h2>Детали события</h2>
                <div class="info-grid">
                    <div class="info-item"><strong>📍 Город</strong><span>${sanitizeHTML(event.city) || 'Онлайн'}</span></div>
                    <div class="info-item"><strong>🗓️ Дата</strong><span>${event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Не указана'}</span></div>
                    <div class="info-item"><strong>⭐ Избранное</strong><span>${event.favorites_count || 0}</span></div>
                </div>
                <h2>Описание</h2>
                <div class="description-content">${descriptionHTML || 'Описание отсутствует.'}</div>
            </div>
            <div class="event-detail-sidebar">
                <h3>Комментарии (${comments ? comments.length : 0})</h3>
                <div class="comments-section" id="comments">
                    ${renderComments(comments)}
                    ${currentUser ? renderCommentForm(event.id) : '<p><a href="/login.html">Войдите</a>, чтобы оставить комментарий.</p>'}
                </div>
            </div>
        </div>
    `;
    eventDetailContainer.innerHTML = eventHtml;
}

// --- 3. Функции для рендера частей страницы ---

function renderComments(comments) {
    if (!comments || comments.length === 0) {
        return '<p>Комментариев пока нет.</p>';
    }
    return '<ul class="comments-list">' + comments.map(comment => {
        const authorAvatar = comment.profiles ? comment.profiles.avatar_url : 'https://placehold.co/32x32/f0f2f5/ccc';
        return `
            <li class="comment">
                <img src="${sanitizeForAttribute(authorAvatar)}" class="comment-avatar" alt="avatar">
                <div class="comment-body">
                    <span class="comment-author">${sanitizeHTML(comment.profiles.full_name || 'Аноним')}</span>
                    <p>${sanitizeHTML(comment.content)}</p>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                </div>
            </li>`;
    }).join('') + '</ul>';
}

function renderCommentForm(eventId) {
    return `
        <form class="comment-form" onsubmit="addComment(event, ${eventId})">
            <textarea id="comment-input" placeholder="Написать комментарий..." required></textarea>
            <button type="submit" class="submit-btn primary">Отправить</button>
        </form>`;
}


// --- 4. Глобальные функции-обработчики (для onclick) ---

window.addComment = async function(e, eventId) {
    e.preventDefault();
    if (!currentUser) return;

    const contentInput = document.getElementById('comment-input');
    const content = contentInput.value.trim();
    if (!content) return;
    
    const submitButton = e.target.querySelector('button');
    submitButton.disabled = true;

    const { data, error } = await supabaseClient
        .from('comments')
        .insert({ content, event_id: eventId, user_id: currentUser.id })
        .select('*, profiles(full_name, avatar_url)')
        .single();
    
    if (error) {
        alert('Не удалось добавить комментарий.');
        submitButton.disabled = false;
    } else {
        // Динамическое добавление без перезагрузки
        const newCommentHTML = `
            <li class="comment">
                <img src="${sanitizeForAttribute(data.profiles.avatar_url)}" class="comment-avatar" alt="avatar">
                <div class="comment-body">
                    <span class="comment-author">${sanitizeHTML(data.profiles.full_name || 'Аноним')}</span>
                    <p>${sanitizeHTML(data.content)}</p>
                    <span class="comment-date">${new Date(data.created_at).toLocaleString()}</span>
                </div>
            </li>`;
        document.querySelector('.comments-list').insertAdjacentHTML('beforeend', newCommentHTML);
        contentInput.value = '';
        submitButton.disabled = false;
    }
};


// --- 5. Точка входа ---
document.addEventListener('appReady', initializeEventDetailPage);

