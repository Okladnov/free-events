// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ БЕЗОПАСНОСТИ
// =================================================================
function sanitizeHTML(text) {
    if (!text) return '';
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'] });
}
function sanitizeForAttribute(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;');
}

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const eventsContainer = document.getElementById("events");
const paginationControls = document.getElementById('pagination-controls');
let currentUser = null;
let allFavoriteEventIds = [];

// =================================================================
// НАСТРОЙКИ ПАГИНАЦИИ
// =================================================================
const PAGE_SIZE = 6;
let currentPage = 0;

// =================================================================
// ГЛАВНАЯ ЛОГИКА
// =================================================================
async function main() {
    setupEventListeners();
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    if (currentUser) {
        document.getElementById('profile-dropdown').style.display = 'block';
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        const userName = (profile && profile.full_name) ? profile.full_name : currentUser.email.split('@')[0];
        document.getElementById('user-name-display').textContent = userName;
        const { data: adminStatus } = await supabaseClient.rpc('is_admin');
        if (adminStatus) { document.getElementById('admin-link').style.display = 'block'; }
        loadFavoriteEvents(true);
    } else {
        document.getElementById('loginBtn').style.display = 'inline-block';
        eventsContainer.innerHTML = '<p>Пожалуйста, <a href="/login.html">войдите в свой аккаунт</a>, чтобы увидеть избранные события.</p>';
    }
}

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
// УДАЛЕНИЕ ИЗ ИЗБРАННОГО
// =================================================================
async function removeFromFavorites(eventId, buttonElement) {
    if (!currentUser) { alert('Вы не авторизованы.'); return; }
    buttonElement.disabled = true;
    const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
    if (error) {
        alert('Не удалось удалить событие из избранного.');
        buttonElement.disabled = false;
    } else {
        const card = buttonElement.closest('.event-card-new');
        if (card) {
            card.style.transition = 'opacity 0.5s ease';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 500);
        }
        allFavoriteEventIds = allFavoriteEventIds.filter(id => id !== eventId);
        if (document.querySelectorAll('.event-card-new').length <= 1 && allFavoriteEventIds.length === 0) {
            setTimeout(() => {
                eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. <a href="/">Перейти на главную</a></p>';
                paginationControls.innerHTML = '';
            }, 500);
        }
    }
}

// =================================================================
// ЗАГРУЗКА ИЗБРАННЫХ СОБЫТИЙ
// =================================================================
async function loadFavoriteEvents(isInitialLoad = false) {
    if (isInitialLoad) {
        currentPage = 0;
        eventsContainer.innerHTML = 'Загрузка ваших избранных событий...';
        paginationControls.innerHTML = '';
        const { data: favoriteIdsData, error: idsError } = await supabaseClient.from('favorites').select('event_id').eq('user_id', currentUser.id);
        if (idsError) { eventsContainer.innerHTML = '<p>Не удалось загрузить избранные события.</p>'; return; }
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
        return;
    }
    
    const { data: events, error: eventsError } = await supabaseClient.from('events').select(`id, title, description, city, event_date, created_by, image_url, rating, profiles ( full_name ), categories ( id, name )`).in('id', idsToFetch).order('created_at', { ascending: false });
    if (eventsError) { eventsContainer.innerHTML += '<p>Ошибка загрузки части событий.</p>'; return; }
    
    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    events.forEach(event => {
        const div = document.createElement("div");
        div.className = "event-card-new";
        let dateHtml = '';
        if (event.event_date) { dateHtml = new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
        let categoriesHtml = '';
        if (event.categories && event.categories.length > 0) {
            categoriesHtml = '<div class="card-categories">';
            event.categories.forEach(cat => { categoriesHtml += `<span class="tag" onclick="window.location.href='/?category=${cat.id}'">${sanitizeHTML(cat.name)}</span>`; });
            categoriesHtml += '</div>';
        }
        div.innerHTML = `
          <a href="event.html?id=${event.id}" class="event-card-new-image-link">
            <img src="${event.image_url || 'https://placehold.co/400x400/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
          </a>
          <div class="event-card-new-content">
            ${categoriesHtml}
            <a href="event.html?id=${event.id}" class="event-card-new-title-link">
              <h3>${sanitizeHTML(event.title)}</h3>
            </a>
            <div class="meta">
                <div class="meta-item"><span>🗓️</span><span>${dateHtml || 'Дата не указана'}</span></div>
                <div class="meta-item"><span>📍</span><span>${sanitizeHTML(event.city) || 'Онлайн'}</span></div>
            </div>
          </div>
          <div class="event-card-new-actions">
            <button class="card-save-btn active" onclick="event.stopPropagation(); removeFromFavorites(${event.id}, this)">❤️</button>
          </div>`;
        eventsContainer.appendChild(div);
    });

    if ((currentPage + 1) * PAGE_SIZE < allFavoriteEventIds.length) {
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
// ПЕРВЫЙ ЗАПУСК
// =================================================================
main();
