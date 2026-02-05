// =================================================================
// event.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННАЯ "ЖИВАЯ" ВЕРСИЯ
// =================================================================

// =================================================================
// ТОЧКА ВХОДА: ЗАПУСК ПОСЛЕ ЗАГРУЗКИ СТРАНИЦЫ
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
        // Запускаем запросы на получение события и комментариев ОДНОВРЕМЕННО
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

        // Если все успешно, "рисуем" страницу
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

/**
 * Главная функция, которая собирает всю страницу из данных
 */
function renderPage(event, comments) {
    const eventDetailContainer = document.getElementById('event-detail-container');
    document.title = sanitizeForAttribute(event.title);

    const categoriesHtml = (event.categories || [])
        .map(cat => `<a href="/?category=${cat.id}" class="tag">${sanitizeHTML(cat.name)}</a>`)
        .join('');

    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
    const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;

    // Собираем HTML страницы, используя data-атрибуты для действий
    const eventHtml = `
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
                    ` : '<p><a href="/login.html">Войдите</a>, чтобы оставить комментарий</p>'}
                </div>
            </div>
        </div>`;

    eventDetailContainer.innerHTML = eventHtml;
}

/**
 * "Рисует" один комментарий. Нужна для динамического добавления.
 */
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

/**
 * "Рисует" блок с рейтингом. Нужна для динамического обновления.
 */
function renderRating(event) {
    const rating = event.votes.reduce((acc, vote) => acc + vote.value, 0);
    const hasVoted = currentUser ? event.votes.some(v => v.user_id === currentUser.id) : false;
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
// НАСТРОЙКА ОБРАБОТЧИКОВ СОБЫТИЙ
// =================================================================
function setupEventListeners() {
    const eventDetailContainer = document.getElementById('event-detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    // Единый обработчик для кликов по кнопкам "голосовать" и "в избранное"
    eventDetailContainer.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        if (!currentUser) {
            alert('Пожалуйста, войдите, чтобы выполнить это действие.');
            return;
        }

        const action = actionElement.dataset.action;

        if (action === 'toggle-favorite') {
            handleToggleFavorite(eventId, actionElement);
        }
        if (action === 'vote') {
            const value = parseInt(actionElement.dataset.value, 10);
            handleVote(eventId, value);
        }
    });

    // Отдельный обработчик для формы комментариев
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
    const input = formElement.querySelector('input');
    const button = formElement.querySelector('button');
    const content = input.value.trim();

    if (!content) return;
    
    input.disabled = true;
    button.disabled = true;

    try {
        // При вставке сразу запрашиваем вставленную строку с данными профиля
        const { data: newComment, error } = await supabaseClient
            .from('comments')
            .insert({ content, event_id: eventId, user_id: currentUser.id })
            .select(`*, profiles(full_name, avatar_url)`)
            .single();

        if (error) throw error;
        
        // "Рисуем" новый комментарий и добавляем в список без перезагрузки
        const commentsList = document.getElementById('comments-list');
        commentsList.insertAdjacentHTML('beforeend', renderComment(newComment));
        input.value = ''; // Очищаем поле ввода

    } catch (error) {
        console.error("Ошибка добавления комментария:", error);
        alert("Не удалось добавить комментарий.");
    } finally {
        input.disabled = false;
        button.disabled = false;
    }
}

async function handleToggleFavorite(eventId, buttonElement) {
    const isFavorited = buttonElement.classList.contains('active');
    buttonElement.disabled = true;

    try {
        if (isFavorited) {
            await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
            buttonElement.classList.remove('active');
            buttonElement.innerHTML = '🤍';
        } else {
            await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
            buttonElement.classList.add('active');
            buttonElement.innerHTML = '❤️';
        }
    } catch (error) {
        console.error("Ошибка избранного:", error);
    } finally {
        buttonElement.disabled = false;
    }
}

async function handleVote(eventId, value) {
    const ratingSection = document.getElementById('rating-section');
    ratingSection.style.opacity = '0.5';

    try {
        // upsert - обновит голос, если он есть, или вставит новый.
        // Для этого в таблице 'votes' должен быть PRIMARY KEY на (event_id, user_id)
        await supabaseClient.from('votes').upsert({ event_id: eventId, user_id: currentUser.id, value: value });
        
        // После успешного голоса, просто перезагружаем данные о событии, чтобы получить новый рейтинг
        const { data: updatedEvent, error } = await supabaseClient
            .from('events')
            .select(`*, votes(user_id, value)`)
            .eq('id', eventId)
            .single();
        
        if (error) throw error;
        
        // И обновляем только блок с рейтингом
        ratingSection.innerHTML = renderRating(updatedEvent);

    } catch(error) {
        console.error("Ошибка голосования:", error);
        alert("Ошибка голосования. Возможно, вы уже голосовали.");
    } finally {
        ratingSection.style.opacity = '1';
    }
}
