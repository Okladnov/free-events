// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const eventDetailContainer = document.getElementById('event-detail-container');
let currentUser = null;

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); };
window.logout = async function() { await supabaseClient.auth.signOut(); };
supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('user-info');
    loginBtn.style.display = session ? 'none' : 'block';
    logoutBtn.style.display = session ? 'block' : 'none';
    userInfo.textContent = session ? `Вы вошли как: ${session.user.email}` : '';
});

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================
window.toggleFavorite = async function(eventId, isCurrentlyFavorited, buttonElement) {
    if (!currentUser) {
        alert('Пожалуйста, войдите, чтобы добавлять в избранное.');
        return;
    }
    buttonElement.disabled = true;

    if (isCurrentlyFavorited) {
        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
        if (error) {
            console.error('Ошибка удаления из избранного:', error);
            buttonElement.disabled = false;
        } else {
            buttonElement.innerHTML = '🤍';
            buttonElement.classList.remove('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, false, this)`);
            buttonElement.disabled = false;
        }
    } else {
        const { error } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
        if (error) {
            console.error('Ошибка добавления в избранное:', error);
            buttonElement.disabled = false;
        } else {
            buttonElement.innerHTML = '❤️';
            buttonElement.classList.add('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, true, this)`);
            buttonElement.disabled = false;
        }
    }
}

window.vote = async function(eventId, value) { if (!currentUser) { alert("Пожалуйста, войдите."); return; } await supabaseClient.from("votes").insert([{ event_id: eventId, value, user_id: currentUser.id }]); location.reload(); };
window.addComment = async function(eventId) { if (!currentUser) { alert("Пожалуйста, войдите."); return; } const contentInput = document.getElementById('comment-input'); const content = contentInput.value.trim(); if (!content) return; const { error } = await supabaseClient.from('comments').insert([{ content, event_id: eventId, user_id: currentUser.id }]); if (!error) { location.reload(); } };

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: ЗАГРУЗКА ДЕТАЛЕЙ СОБЫТИЯ
// =================================================================
async function loadEventDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) {
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Ошибка: ID события не найден в URL.</p>`;
        return;
    }

    const { data: event, error: eventError } = await supabaseClient.from('events').select(`id, title, description, city, event_date, created_by, image_url, rating, profiles ( full_name ), categories ( id, name ), votes(user_id, value)`).eq('id', eventId).single();
    if (eventError || !event) {
        console.error('Ошибка загрузки события:', eventError);
        document.title = "Событие не найдено";
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Событие не найдено или произошла ошибка.</p>`;
        return;
    }

    const { data: comments, error: commentsError } = await supabaseClient.from('comments').select('id, content, created_at, profiles ( full_name )').eq('event_id', eventId).order('created_at', { ascending: true });
    if (commentsError) {
        console.error('Ошибка загрузки комментариев:', commentsError);
    }

    document.title = event.title;
    let dateString = 'Дата не указана';
    if (event.event_date) { dateString = new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
    let categoriesHtml = '';
    if (event.categories && event.categories.length > 0) {
        event.categories.forEach(cat => { categoriesHtml += `<a href="/?category=${cat.id}" class="tag">${cat.name}</a>`; });
    }
    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
    const rating = event.rating;
    let scoreClass = '', scoreIcon = '';
    if (rating < 0) { scoreClass = 'score-cold'; scoreIcon = '❄️'; } else if (rating > 20) { scoreClass = 'score-fire'; scoreIcon = '🔥🔥'; } else if (rating > 5) { scoreClass = 'score-hot'; scoreIcon = '🔥'; }
    const hasVoted = currentUser ? event.votes.some(v => v.user_id === currentUser.id) : false;
    const commentsHtml = '<ul class="comments-list">' + (comments || []).map(comment => {
        const commentAuthor = comment.profiles ? comment.profiles.full_name : 'Аноним';
        const commentDate = new Date(comment.created_at).toLocaleString('ru-RU');
        return `<li class="comment"><span class="comment-author">${commentAuthor}</span><span class="comment-date">${commentDate}</span><p>${comment.content}</p></li>`;
    }).join('') + '</ul>';

    const eventHtml = `
        <div class="event-detail-header">
            <img src="${event.image_url || 'https://placehold.co/1200x600/f0f2f5/ff6a00?text=Нет+фото'}" alt="${event.title}" class="event-detail-image">
            <div class="event-detail-title-card">
                <div class="event-detail-tags">${categoriesHtml}</div>
                <h1>${event.title}</h1>
                <p>Добавил: ${authorName}</p>
            </div>
        </div>
        <div class="event-detail-body">
            <div class="event-detail-info">
                <h2>Детали события</h2>
                <div class="info-grid">
                    <div class="info-item"><strong>📍 Город:</strong><span>${event.city || 'Онлайн'}</span></div>
                    <div class="info-item"><strong>🗓️ Дата:</strong><span>${dateString}</span></div>
                    <div class="info-item">
                        <strong>⭐ Рейтинг:</strong>
                        <div class="vote" style="margin-top: 5px;">
                            <button onclick="vote(${event.id}, 1)" ${hasVoted ? 'disabled' : ''}>▲</button>
                            <span class="score ${scoreClass}">${rating} ${scoreIcon}</span>
                            <button onclick="vote(${event.id}, -1)" ${hasVoted ? 'disabled' : ''}>▼</button>
                        </div>
                    </div>
                </div>
                <h2>Описание</h2>
                <p>${event.description || 'Описание отсутствует.'}</p>
                <div class="comments-section">
                    <h2>Комментарии</h2>
                    ${commentsHtml}
                    <form class="comment-form" onsubmit="addComment(${event.id}); return false;">
                        <input id="comment-input" placeholder="Написать комментарий..." required>
                        <button type="submit">Отправить</button>
                    </form>
                </div>
            </div>
            <div class="event-detail-sidebar">
                <h3>Место на карте</h3>
                <div id="map-placeholder" style="width: 100%; height: 250px; background-color: #f0f2f5; border-radius: 8px; display:flex; align-items:center; justify-content:center; text-align:center; color:#888;">Интерактивная карта появится здесь</div>
            </div>
        </div>
    `;
    eventDetailContainer.innerHTML = eventHtml;
}

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEventDetails();
