const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Элементы для редактирования профиля ---
const userAvatar = document.getElementById('user-avatar');
const welcomeMessage = document.getElementById('welcome-message');
const profileNameInput = document.getElementById('profile-name');
const profileEmailInput = document.getElementById('profile-email');
const avatarUploadInput = document.getElementById('avatar-upload');
const profileForm = document.getElementById('profile-form');
const profileMessage = document.getElementById('profile-message');
const logoutProfileBtn = document.getElementById('logout-profile-btn');

// --- Новые элементы для активности ---
const showFavoritesBtn = document.getElementById('show-favorites-btn');
const showCommentsBtn = document.getElementById('show-comments-btn');
const favoritesListContainer = document.getElementById('favorites-list');
const commentsListContainer = document.getElementById('comments-list');

let currentUser = null;
let isAdmin = false; // Понадобится для отображения кнопок админа

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function sanitizeHTML(text) { if (!text) return ''; return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'] }); }
function sanitizeForAttribute(text) { if (!text) return ''; return text.toString().replace(/"/g, '&quot;'); }

async function main() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return;
    }
    currentUser = session.user;
    
    // Проверяем, админ ли, для кнопок на карточках
    const { data: adminStatus } = await supabaseClient.rpc('is_admin');
    isAdmin = adminStatus;

    loadProfileData();
    setupEventListeners();
    
    // Загружаем активность пользователя
    loadUserFavorites();
    loadUserCommentedEvents();
}

async function loadProfileData() {
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', currentUser.id)
        .single();
    
    if (profile) {
        profileNameInput.value = profile.full_name || '';
        welcomeMessage.textContent = `Привет, ${profile.full_name || currentUser.email.split('@')[0]}!`;
        if (profile.avatar_url) {
            userAvatar.src = profile.avatar_url;
        }
    }
    profileEmailInput.value = currentUser.email;
}

function setupEventListeners() {
    // --- Шапка ---
    setupHeader();

    // --- Редактирование профиля ---
    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => { userAvatar.src = event.target.result; };
            reader.readAsDataURL(file);
        }
    });
    profileForm.addEventListener('submit', handleProfileUpdate);
    logoutProfileBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = '/';
    });
    
    // --- Новые табы ---
    showFavoritesBtn.addEventListener('click', () => {
        showFavoritesBtn.classList.add('active');
        showCommentsBtn.classList.remove('active');
        favoritesListContainer.style.display = 'block';
        commentsListContainer.style.display = 'none';
    });
    showCommentsBtn.addEventListener('click', () => {
        showCommentsBtn.classList.add('active');
        showFavoritesBtn.classList.remove('active');
        commentsListContainer.style.display = 'block';
        favoritesListContainer.style.display = 'none';
    });
}

function setupHeader() { /* ... код из предыдущего шага ... */ }

async function handleProfileUpdate(e) { /* ... код из предыдущего шага ... */ }


// =================================================================
// НОВАЯ ЛОГИКА: ЗАГРУЗКА И ОТОБРАЖЕНИЕ АКТИВНОСТИ
// =================================================================

/** Универсальная функция для создания карточки события, как на главной */
function createEventCard(event) {
    const div = document.createElement("div");
    div.className = "event-card-new";
    
    let dateHtml = '';
    if (event.event_date) { dateHtml = new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
    
    // Проверяем, в избранном ли это событие (понадобится для кнопки)
    const isFavorited = true; // В контексте этих списков, закладка всегда "активна"
    const favoriteIcon = '❤️';
    const favoriteClass = 'active';

    div.innerHTML = `
      <a href="event.html?id=${event.id}" class="event-card-new-image-link">
        <img src="${event.image_url || 'https://placehold.co/400x400/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
      </a>
      <div class="event-card-new-content">
        <a href="event.html?id=${event.id}" class="event-card-new-title-link">
          <h3>${sanitizeHTML(event.title)}</h3>
        </a>
        <div class="meta">
            <div class="meta-item"><span>🗓️</span><span>${dateHtml || 'Дата не указана'}</span></div>
            <div class="meta-item"><span>📍</span><span>${sanitizeHTML(event.city) || 'Онлайн'}</span></div>
        </div>
      </div>`;
    return div;
}

async function loadUserFavorites() {
    favoritesListContainer.innerHTML = '<p>Загрузка закладок...</p>';
    
    const { data: favoriteRelations, error: favError } = await supabaseClient
        .from('favorites')
        .select('events(*, categories(*))') // Сразу получаем все данные о событии
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (favError) {
        favoritesListContainer.innerHTML = '<p>Ошибка загрузки закладок.</p>';
        return;
    }
    
    const favoriteEvents = favoriteRelations.map(rel => rel.events);
    
    if (!favoriteEvents || favoriteEvents.length === 0) {
        favoritesListContainer.innerHTML = '<p>У вас пока нет событий в закладках.</p>';
        return;
    }
    
    favoritesListContainer.innerHTML = '';
    favoriteEvents.forEach(event => {
        if(event) { // Доп. проверка, если событие было удалено, а закладка осталась
            favoritesListContainer.appendChild(createEventCard(event));
        }
    });
}

async function loadUserCommentedEvents() {
    commentsListContainer.innerHTML = '<p>Загрузка комментированных событий...</p>';
    
    // Используем RPC функцию, чтобы получить уникальные ID событий, которые комментировал юзер
    const { data: eventIds, error: rpcError } = await supabaseClient.rpc('get_commented_event_ids_by_user', { p_user_id: currentUser.id });
    
    if (rpcError) {
        commentsListContainer.innerHTML = '<p>Ошибка загрузки комментариев.</p>';
        return;
    }

    const uniqueEventIds = eventIds.map(item => item.event_id);
    
    if (!uniqueEventIds || uniqueEventIds.length === 0) {
        commentsListContainer.innerHTML = '<p>Вы еще не оставляли комментариев.</p>';
        return;
    }
    
    const { data: events, error: eventsError } = await supabaseClient
        .from('events')
        .select('*, categories(*)')
        .in('id', uniqueEventIds)
        .order('created_at', { ascending: false });

    if (eventsError) {
        commentsListContainer.innerHTML = '<p>Ошибка загрузки событий.</p>';
        return;
    }
    
    commentsListContainer.innerHTML = '';
    events.forEach(event => {
        commentsListContainer.appendChild(createEventCard(event));
    });
}


main();
