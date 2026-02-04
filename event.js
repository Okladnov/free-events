// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ БЕЗОПАСНОСТИ
// =================================================================
function sanitizeHTML(text) { if (!text) return ''; return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'] }); }
function sanitizeForAttribute(text) { if (!text) return ''; return text.toString().replace(/"/g, '&quot;'); }

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const eventDetailContainer = document.getElementById('event-detail-container');
let currentUser = null; // Оставляем для функций vote, addComment, toggleFavorite

// =================================================================
// ГЛАВНАЯ ЛОГИКА - ОБНОВЛЕННАЯ
// =================================================================
async function main() {
    setupEventListeners(); // Настраиваем шапку

    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    if (currentUser) {
        // Пользователь вошел - настраиваем его меню
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('profile-dropdown').style.display = 'block';

        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        const userName = (profile && profile.full_name) ? profile.full_name : currentUser.email.split('@')[0];
        document.getElementById('user-name-display').textContent = userName;

        const { data: adminStatus } = await supabaseClient.rpc('is_admin');
        if (adminStatus) {
            document.getElementById('admin-link').style.display = 'block';
        }
    } else {
        // Пользователь - гость
        document.getElementById('loginBtn').style.display = 'inline-block';
        document.getElementById('profile-dropdown').style.display = 'none';
    }

    // Загружаем основную информацию страницы
    loadEventDetails();
}

// =================================================================
// СТАНДАРТНАЯ ЛОГИКА ШАПКИ
// =================================================================
function setupEventListeners() {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if(themeToggle) themeToggle.checked = true;
    }
    if(themeToggle) {
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
        const profileTrigger = document.getElementById('profile-trigger');
        profileTrigger.onclick = (event) => {
            event.stopPropagation();
            profileDropdown.classList.toggle('open');
        };
    }
    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('open');
        }
    });
}

// =================================================================
// СПЕЦИФИЧНАЯ ЛОГИКА СТРАНИЦЫ (без изменений)
// =================================================================

window.toggleFavorite = async function(eventId, isCurrentlyFavorited, buttonElement) {
    if (!currentUser) { alert('Пожалуйста, войдите, чтобы добавлять в избранное.'); return; }
    buttonElement.disabled = true;
    if (isCurrentlyFavorited) {
        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
        if (error) { buttonElement.disabled = false; } else {
            buttonElement.innerHTML = '🤍';
            buttonElement.classList.remove('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, false, this)`);
            buttonElement.disabled = false;
        }
    } else {
        const { error } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
        if (error) { buttonElement.disabled = false; } else {
            buttonElement.innerHTML = '❤️';
            buttonElement.classList.add('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, true, this)`);
            buttonElement.disabled = false;
        }
    }
};

window.vote = async function(eventId, value) {
    if (!currentUser) { alert("Пожалуйста, войдите."); return; }
    await supabaseClient.from("votes").insert([{ event_id: eventId, value, user_id: currentUser.id }]);
    location.reload();
};

window.addComment = async function(eventId) {
    if (!currentUser) { alert("Пожалуйста, войдите."); return; }
    const contentInput = document.getElementById('comment-input');
    const content = contentInput.value.trim();
    if (!content) return;
    const { error } = await supabaseClient.from('comments').insert([{ content, event_id: eventId, user_id: currentUser.id }]);
    if (!error) location.reload();
};

async function loadEventDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) {
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Ошибка: ID события не найден.</p>`;
        return;
    }
    const { data: event, error: eventError } = await supabaseClient.from('events').select(`id, title, description, city, event_date, created_by, image_url, rating, profiles ( full_name ), categories ( id, name ), votes(user_id, value), favorites(user_id)`).eq('id', eventId).single();
    if (eventError || !event) {
        document.title = "Событие не найдено";
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Событие не найдено.</p>`;
        return;
    }
    const { data: comments, error: commentsError } = await supabaseClient.from('comments').select('id, content, created_at, profiles ( full_name )').eq('event_id', eventId).order('created_at', { ascending: true });
    
    document.title = sanitizeForAttribute(event.title);
    
    let dateString = 'Дата не указана';
    if (event.event_date) { dateString = new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
    
    let categoriesHtml = '';
    if (event.categories && event.categories.length > 0) {
        event.categories.forEach(cat => { categoriesHtml += `<a href="/?category=${cat.id}" class="tag">${sanitizeHTML(cat.name)}</a>`; });
    }
    
    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
    const rating = event.rating;
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
    
    let isFavorited = false;
    if (currentUser && event.favorites) { isFavorited = event.favorites.some(fav => fav.user_id === currentUser.id); }
    
    const favoriteIcon = isFavorited ? '❤️' : '🤍';
    const favoriteClass = isFavorited ? 'active' : '';
    
const eventHtml = `
    <div class="event-detail-header">
        <img src="${event.image_url || 'https://placehold.co/1200x400/1e1e1e/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}" class="event-detail-image">
        <button class="card-save-btn ${favoriteClass}" onclick="event.stopPropagation(); toggleFavorite(${event.id}, ${isFavorited}, this)">${favoriteIcon}</button>
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
                <div class="info-item">
                    <strong>📍 Город</strong>
                    <span>${sanitizeHTML(event.city) || 'Онлайн'}</span>
                </div>
                <div class="info-item">
                    <strong>🗓️ Дата</strong>
                    <span>${dateString}</span>
                </div>
                <div class="info-item">
                    <strong>⭐ Рейтинг</strong>
                    <div class="vote">
                        <button onclick="vote(${event.id}, 1)" ${hasVoted ? 'disabled' : ''}>▲</button>
                        <span class="score ${scoreClass}">${rating} ${scoreIcon}</span>
                        <button onclick="vote(${event.id}, -1)" ${hasVoted ? 'disabled' : ''}>▼</button>
                    </div>
                </div>
            </div>

            <h2>Описание</h2>
            <p style="white-space: pre-wrap;">${sanitizeHTML(event.description) || 'Описание отсутствует.'}</p>
        </div>

        <div class="event-detail-sidebar">
            <h3>Комментарии</h3>
            <div class="comments-section">
                ${commentsHtml}
                <form class="comment-form" onsubmit="addComment(${event.id}); return false;">
                    <input id="comment-input" placeholder="Написать комментарий..." required>
                    <button type="submit">Отправить</button>
                </form>
            </div>
        </div>
    </div>
`;
    eventDetailContainer.innerHTML = eventHtml;
}

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
main();
