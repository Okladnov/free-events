// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// =================================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ОЧИСТКА HTML
// =================================================================
function sanitizeHTML(text) {
    return DOMPurify.sanitize(text, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'],
    });}

function sanitizeForAttribute(text) {
    if (!text) return '';
    // Эта функция заменяет кавычки на их безопасный HTML-эквивалент
    return text.toString().replace(/"/g, '&quot;');
}

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('user-info');
const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
let currentUser = null;
let allFavoriteEventIds = []; // Здесь будем хранить все ID избранных

// =================================================================
// НАСТРОЙКИ ПАГИНАЦИИ
// =================================================================
const PAGE_SIZE = 6; // Можно поставить любое число, 6 - хороший вариант для начала
let currentPage = 0;

// =================================================================
// УДАЛЕНИЕ ИЗ ИЗБРАННОГО
// =================================================================
async function removeFromFavorites(eventId, buttonElement) {
    if (!currentUser) {
        alert('Вы не авторизованы.');
        return;
    }
    buttonElement.disabled = true;
    const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
    if (error) {
        console.error('Ошибка удаления из избранного:', error);
        alert('Не удалось удалить событие из избранного.');
        buttonElement.disabled = false;
    } else {
        // Убираем карточку с анимацией
        const card = buttonElement.closest('.event-card');
        if (card) {
            card.style.transition = 'opacity 0.5s ease';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 500);
        }
        // Обновляем счетчик для пагинации
        allFavoriteEventIds = allFavoriteEventIds.filter(id => id !== eventId);
        if (document.querySelectorAll('.event-card').length === 0 && allFavoriteEventIds.length === 0) {
            eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
            paginationControls.innerHTML = '';
        }
    }
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: ЗАГРУЗКА ИЗБРАННЫХ СОБЫТИЙ
// =================================================================
async function loadFavoriteEvents(isInitialLoad = false) {
    if (isInitialLoad) {
        currentPage = 0;
        eventsContainer.innerHTML = 'Загрузка ваших избранных событий...';
        paginationControls.innerHTML = '';

        const { data: favoriteIdsData, error: idsError } = await supabaseClient.from('favorites').select('event_id').eq('user_id', currentUser.id);
        if (idsError) {
            eventsContainer.innerHTML = '<p>Не удалось загрузить избранные события.</p>';
            return;
        }

        if (!favoriteIdsData || favoriteIdsData.length === 0) {
            eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
            return;
        }
        
        allFavoriteEventIds = favoriteIdsData.map(item => item.event_id);
        eventsContainer.innerHTML = "";
    }

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const idsToFetch = allFavoriteEventIds.slice(from, to + 1);

    if (idsToFetch.length === 0) {
        const existingLoadMoreBtn = document.getElementById('load-more-btn');
        if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
        return;
    }

    const { data: events, error: eventsError } = await supabaseClient.from('events').select(`id, title, description, city, event_date, created_by, image_url, rating, profiles ( full_name ), categories ( id, name )`).in('id', idsToFetch).order('created_at', { ascending: false });

    if (eventsError) {
        console.error('Ошибка загрузки событий:', eventsError);
        eventsContainer.innerHTML += '<p>Ошибка загрузки части событий.</p>';
        return;
    }
    
    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();

    events.forEach(event => {
        let dateHtml = '';
        if (event.event_date) { const d = new Date(event.event_date); const day = d.getDate(); const month = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', ''); dateHtml = `<div class="event-card-date"><span class="day">${day}</span><span class="month">${month}</span></div>`; }

        let categoriesHtml = '';
        if (event.categories && event.categories.length > 0) {
            categoriesHtml = '<div class="card-categories">';
            event.categories.forEach(cat => { categoriesHtml += `<span class="tag" onclick="window.location.href='/?category=${cat.id}'">${cat.name}</span>`; });
            categoriesHtml += '</div>';
        }

        const div = document.createElement("div");
        div.className = "event-card";
        div.innerHTML = `
          <div class="event-card-image-container" onclick="window.location.href = 'event.html?id=${event.id}'">
            <img src="${event.image_url || 'https://placehold.co/600x337/f0f2f5/ff6a00?text=Нет+фото'}" alt="${event.title}" class="event-card-image">
            ${dateHtml}
            <button class="card-save-btn active" onclick="event.stopPropagation(); removeFromFavorites(${event.id}, this)">❤️</button>
          </div>
          <div class="card-content" onclick="window.location.href = 'event.html?id=${event.id}'">
            <h3>${sanitizeHTML(event.title)}</h3>
            ${categoriesHtml}
            <p>${sanitizeHTML(event.description) || 'Нет описания.'}</p>
            <div class="meta">
                <div class="meta-item"><span>📍</span><span>${sanitizeHTML(event.city) || 'Онлайн'}</span>
                <div class="meta-item"><span>👤</span><span>Добавил: ${event.profiles ? sanitizeHTML(event.profiles.full_name) : 'Аноним'}</span>
            </div>
          </div>`;
        eventsContainer.appendChild(div);
    });

    const totalLoaded = document.querySelectorAll('.event-card').length;
    if (totalLoaded < allFavoriteEventIds.length) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.onclick = () => {
            currentPage++;
            loadFavoriteEvents(false);
        };
        paginationControls.appendChild(loadMoreBtn);
    }
}

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); };
window.logout = async function() { await supabaseClient.auth.signOut(); };

supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;
  document.getElementById('loginBtn').style.display = session ? 'none' : 'block';
  document.getElementById('logoutBtn').style.display = session ? 'block' : 'none';
  document.getElementById('user-info').textContent = session ? `Вы вошли как: ${session.user.email}` : '';
  document.getElementById('favorites-link').style.display = session ? 'inline' : 'none';

  if (currentUser) {
    loadFavoriteEvents(true); // Запускаем первую загрузку
  } else {
    eventsContainer.innerHTML = '<p>Пожалуйста, <a href="#" onclick="loginWithGoogle(); return false;">войдите в свой аккаунт</a>, чтобы увидеть избранные события.</p>';
  }
});
