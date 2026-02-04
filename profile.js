// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const userAvatar = document.getElementById('user-avatar');
const welcomeMessage = document.getElementById('welcome-message');
const profileNameInput = document.getElementById('profile-name');
const profileEmailInput = document.getElementById('profile-email');
const avatarUploadInput = document.getElementById('avatar-upload');
const profileForm = document.getElementById('profile-form');
const profileMessage = document.getElementById('profile-message');
const logoutProfileBtn = document.getElementById('logout-profile-btn');
const showFavoritesBtn = document.getElementById('show-favorites-btn');
const showCommentsBtn = document.getElementById('show-comments-btn');
const favoritesListContainer = document.getElementById('favorites-list');
const commentsListContainer = document.getElementById('comments-list');

// =================================================================
// ТОЧКА ВХОДА
// =================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Инициализируем шапку и проверяем пользователя (из app.js)
    await initializeHeader();

    // 2. Если пользователь не вошел, отправляем его на страницу логина
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    // 3. Загружаем и настраиваем контент страницы профиля
    setupProfilePageListeners();
    loadProfileData();
    loadUserFavorites();
    loadUserCommentedEvents();
});

// =================================================================
// НАСТРОЙКА ОБРАБОТЧИКОВ СОБЫТИЙ
// =================================================================
function setupProfilePageListeners() {
    // Предпросмотр аватара при выборе
    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => { userAvatar.src = event.target.result; };
            reader.readAsDataURL(file);
        }
    });

    // Сохранение формы
    profileForm.addEventListener('submit', handleProfileUpdate);

    // Выход из профиля
    logoutProfileBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = '/';
    });
    
    // Переключение табов
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

// =================================================================
// ЛОГИКА СТРАНИЦЫ ПРОФИЛЯ
// =================================================================

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

async function handleProfileUpdate(e) {
    e.preventDefault();
    const submitButton = profileForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    profileMessage.textContent = 'Сохраняем...';
    profileMessage.style.color = 'var(--text-color)';

    try {
        const newName = profileNameInput.value.trim();
        const avatarFile = avatarUploadInput.files[0];
        let avatarUrl = null;

        if (avatarFile) {
            const filePath = `${currentUser.id}/avatar-${Date.now()}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('avatars') // Убедись, что бакет 'avatars' существует в Supabase
                .upload(filePath, avatarFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
            avatarUrl = data.publicUrl;
        }

        const updates = {
            id: currentUser.id,
            full_name: newName,
            updated_at: new Date(),
        };
        if (avatarUrl) {
            updates.avatar_url = avatarUrl;
        }

        const { error: updateError } = await supabaseClient.from('profiles').upsert(updates);
        if (updateError) throw updateError;

        profileMessage.textContent = '✅ Профиль успешно обновлен!';
        profileMessage.style.color = '#2ecc71';
        
        // Обновляем имя в шапке "на лету", без перезагрузки
        document.getElementById('user-name-display').textContent = newName;

    } catch (error) {
        profileMessage.textContent = `Ошибка: ${error.message}`;
        profileMessage.style.color = '#e74c3c';
    } finally {
        submitButton.disabled = false;
        setTimeout(() => { profileMessage.textContent = ''; }, 3000);
    }
}

function createEventCard(event) {
    const div = document.createElement("div");
    // Используем классы из style.css для карточек в профиле
    div.className = "event-card-v3"; 
    
    const authorName = 'Вы'; // В контексте профиля
    const authorAvatar = userAvatar.src; // Текущий аватар пользователя

    div.innerHTML = `
        <div class="card-body">
            <a href="event.html?id=${event.id}" class="card-image-link">
                <img src="${event.image_url || 'https://placehold.co/250x250/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
            </a>
            <div class="card-content">
                <a href="event.html?id=${event.id}" class="card-title-link">
                    <h3>${sanitizeHTML(event.title)}</h3>
                </a>
                <p class="card-description">${sanitizeHTML(event.description || '').substring(0, 100)}...</p>
                <div class="card-author">
                    <img src="${authorAvatar}" alt="avatar">
                    <span>${sanitizeHTML(authorName)}</span>
                </div>
            </div>
        </div>
        <div class="card-footer">
            <a href="event.html?id=${event.id}" class="card-main-link">К событию</a>
        </div>
    `;
    return div;
}

async function loadUserFavorites() {
    favoritesListContainer.innerHTML = '<p>Загрузка закладок...</p>';
    
    const { data: favoriteRelations, error } = await supabaseClient
        .from('favorites')
        .select('events(*, categories(*))')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        favoritesListContainer.innerHTML = '<p>Ошибка загрузки закладок.</p>';
        return;
    }
    
    const favoriteEvents = favoriteRelations.map(rel => rel.events).filter(Boolean); // .filter(Boolean) уберет null, если событие было удалено
    
    if (favoriteEvents.length === 0) {
        favoritesListContainer.innerHTML = '<p>У вас пока нет событий в закладках.</p>';
        return;
    }
    
    favoritesListContainer.innerHTML = '';
    favoriteEvents.forEach(event => {
        favoritesListContainer.appendChild(createEventCard(event));
    });
}

async function loadUserCommentedEvents() {
    commentsListContainer.innerHTML = '<p>Загрузка комментированных событий...</p>';
    
    const { data: eventIds, error: rpcError } = await supabaseClient.rpc('get_commented_event_ids_by_user', { p_user_id: currentUser.id });
    
    if (rpcError) {
        commentsListContainer.innerHTML = '<p>Ошибка загрузки комментариев.</p>';
        return;
    }

    const uniqueEventIds = eventIds.map(item => item.event_id);
    
    if (uniqueEventIds.length === 0) {
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
