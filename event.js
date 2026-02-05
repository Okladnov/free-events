// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const eventDetailContainer = document.getElementById('event-detail-container');

// =================================================================
// ТОЧКА ВХОДА
// =================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Инициализируем общую шапку (из app.js)
    // Эта функция сама проверит пользователя и настроит меню.
    await initializeHeader();

    // 2. Загружаем контент, специфичный для этой страницы
    loadEventDetails();
});

// =================================================================
// СПЕЦИФИЧНАЯ ЛОГИКА СТРАНИЦЫ
// =================================================================

// ВАЖНО: На этой странице нам нужно более "мягкое" очищение HTML,
// чтобы в описании события работали теги <p>, <strong> и т.д.
// Поэтому мы "переопределяем" функцию sanitizeHTML из app.js.
function sanitizeHTML(text) {
    if (!text) return '';
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'] });
}

window.toggleFavorite = async function(eventId, isCurrentlyFavorited, buttonElement) {
    // Используем глобальную переменную `currentUser` из app.js
    if (!currentUser) {
        alert('Пожалуйста, войдите, чтобы добавлять в избранное.');
        return;
    }
    buttonElement.disabled = true;

    if (isCurrentlyFavorited) {
        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
        if (error) {
            buttonElement.disabled = false;
        } else {
            // Обновляем иконку и состояние для следующего клика
            buttonElement.innerHTML = '🤍';
            buttonElement.classList.remove('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, false, this)`);
        }
    } else {
        const { error } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
        if (error) {
            buttonElement.disabled = false;
        } else {
            // Обновляем иконку и состояние для следующего клика
            buttonElement.innerHTML = '❤️';
            buttonElement.classList.add('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, true, this)`);
        }
    }
    buttonElement.disabled = false;
};

window.vote = async function(eventId, value) {
    if (!currentUser) {
        alert("Пожалуйста, войдите, чтобы голосовать.");
        return;
    }
    // TODO: Заменить location.reload() на динамическое обновление
    await supabaseClient.from("votes").insert([{ event_id: eventId, value, user_id: currentUser.id }]);
    location.reload();
};

window.addComment = async function(eventId) {
    if (!currentUser) {
        alert("Пожалуйста, войдите, чтобы комментировать.");
        return;
    }
    const contentInput = document.getElementById('comment-input');
    const content = contentInput.value.trim();
    if (!content) return;
    
    // TODO: Заменить location.reload() на динамическое добавление комментария
    const { error } = await supabaseClient.from('comments').insert([{ content, event_id: eventId, user_id: currentUser.id }]);
    if (!error) {
        location.reload();
    }
};

async function loadEventDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Ошибка: ID события не найден.</p>`;
        return;
    }

    const { data: event, error: eventError } = await supabaseClient
        .from('events')
        .select(`*, profiles ( full_name ), categories ( id, name ), votes(user_id, value), favorites(user_id)`)
        .eq('id', eventId)
        .single();

    if (eventError || !event) {
        document.title = "Событие не найдено";
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Событие не найдено.</p>`;
        return;
    }

    const { data: comments } = await supabaseClient
        .from('comments')
        .select('*, profiles ( full_name )')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

    document.title = sanitizeForAttribute(event.title);

    let dateString = 'Дата не указана';
    if (event.event_date) {
        dateString = new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const categoriesHtml = (event.categories || [])
        .map(cat => `<a href="/?category=${cat.id}" class="tag">${sanitizeHTML(cat.name)}</a>`)
        .join('');

    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';

    const rating = event.votes.reduce((acc, vote) => acc + vote.value, 0);
    let scoreClass = '', scoreIcon = '';
    if (rating < 0) { scoreClass = 'score-cold'; scoreIcon = '❄️'; }
    else if (rating > 20) { scoreClass = 'score-fire'; scoreIcon = '🔥🔥'; }
    else if (rating > 5) { scoreClass = 'score-hot'; scoreIcon = '🔥'; }

    const hasVoted = currentUser ? event.votes.some(v => v.user_id === currentUser.id) : false;

    const commentsHtml = '<ul class="comments-list">' + (comments || []).map(comment => {
        const commentAuthor = comment.profiles ? sanitizeHTML(comment.profiles.full_name) : 'Аноним';
        const commentDate = new Date(comment.created_at).toLocaleString('ru-RU');
        return `<li class="comment"><span class="comment-author">${commentAuthor}</span><span class="comment-date">${commentDate}</span><p>${sanitizeHTML(comment.content)}</p></li>`;
    }).join('') + '</ul>';

    const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
    const favoriteIcon = isFavorited ? '❤️' : '🤍';
    const favoriteClass = isFavorited ? 'active' : '';

    const eventHtml = `
<div class="event-detail-header">
    <img src="${event.image_url || 'https://placehold.co/1200x400/1e1e1e/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}" class="event-detail-image">
    <button class="card-save-btn ${favoriteClass}" data-action="toggle-favorite">${favoriteIcon}</button>
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
            <div class="info-item"><strong>🗓️ Дата</strong><span>${dateString}</span></div>
            <div class="info-item" id="rating-section">
                <strong>⭐ Рейтинг</strong>
                <div class="vote">
                    <button data-action="vote" data-value="1" ${hasVoted ? 'disabled' : ''}>▲</button>
                    <span class="score ${scoreClass}">${rating} ${scoreIcon}</span>
                    <button data-action="vote" data-value="-1" ${hasVoted ? 'disabled' : ''}>▼</button>
                </div>
            </div>
        </div>
        <h2>Описание</h2>
        <div style="white-space: pre-wrap;">${DOMPurify.sanitize(event.description || 'Описание отсутствует.', {ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li']})}</div>
    </div>
    <div class="event-detail-sidebar">
        <h3>Комментарии</h3>
        <div class="comments-section">
            <div id="comments-list-container">${commentsHtml}</div>
            <form id="comment-form">
                <input id="comment-input" placeholder="Написать комментарий..." required>
                <button type-="submit">Отправить</button>
            </form>
        </div>
    </div>
</div>`;
}
