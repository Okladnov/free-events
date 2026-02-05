// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ ПРОФИЛЯ - profile.html (profile.js)
// =================================================================
// Важно: supabaseClient и currentUser уже созданы в script.js.

// --- 1. Функция-инициализатор для этой страницы ---
function initializeProfilePage() {
    const profileForm = document.getElementById('profile-form');
    // Если мы не на странице профиля, ничего не делаем
    if (!profileForm) return;

    // Проверяем, авторизован ли пользователь
    if (!currentUser) {
        alert("Для доступа к этой странице необходимо войти в систему.");
        window.location.href = '/login.html';
        return;
    }

    // Если все ок, запускаем логику страницы
    setupProfilePageListeners();
    loadProfileData();
    loadUserFavorites(); // Загружаем избранное по умолчанию
}

// --- 2. Настройка обработчиков событий ---
function setupProfilePageListeners() {
    const avatarUploadInput = document.getElementById('avatar-upload');
    const profileForm = document.getElementById('profile-form');
    const logoutProfileBtn = document.getElementById('logout-profile-btn');
    const showFavoritesBtn = document.getElementById('show-favorites-btn');
    const showCommentsBtn = document.getElementById('show-comments-btn');

    // Предпросмотр аватара
    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => { document.getElementById('user-avatar').src = event.target.result; };
            reader.readAsDataURL(file);
        }
    });

    // Сохранение формы
    profileForm.addEventListener('submit', handleProfileUpdate);

    // Кнопка выхода (именно та, что в профиле)
    logoutProfileBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('user');
        window.location.href = '/';
    });
    
    // Переключение табов
    showFavoritesBtn.addEventListener('click', () => switchTab('favorites'));
    showCommentsBtn.addEventListener('click', () => switchTab('comments'));
}

function switchTab(tabName) {
    const favoritesBtn = document.getElementById('show-favorites-btn');
    const commentsBtn = document.getElementById('show-comments-btn');
    const favoritesList = document.getElementById('favorites-list');
    const commentsList = document.getElementById('comments-list');

    if (tabName === 'favorites') {
        favoritesBtn.classList.add('active');
        commentsBtn.classList.remove('active');
        favoritesList.style.display = 'block';
        commentsList.style.display = 'none';
        if (favoritesList.innerHTML === '') loadUserFavorites(); // Загружаем, если еще не загружено
    } else { // 'comments'
        commentsBtn.classList.add('active');
        favoritesBtn.classList.remove('active');
        commentsList.style.display = 'block';
        favoritesList.style.display = 'none';
        if (commentsList.innerHTML === '') loadUserCommentedEvents(); // Загружаем, если еще не загружено
    }
}

// --- 3. Логика страницы профиля ---

async function loadProfileData() {
    const { data: profile } = await supabaseClient.from('profiles').select('full_name, avatar_url').eq('id', currentUser.id).single();
    if (profile) {
        document.getElementById('profile-name').value = profile.full_name || '';
        document.getElementById('welcome-message').textContent = `Привет, ${profile.full_name || currentUser.email.split('@')[0]}!`;
        if (profile.avatar_url) {
            document.getElementById('user-avatar').src = profile.avatar_url;
        }
    }
    document.getElementById('profile-email').value = currentUser.email;
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    const profileMessage = document.getElementById('profile-message');
    submitButton.disabled = true;
    profileMessage.textContent = 'Сохраняем...';

    try {
        const newName = document.getElementById('profile-name').value.trim();
        const avatarFile = document.getElementById('avatar-upload').files[0];
        let avatarUrl = document.getElementById('user-avatar').src; // Сохраняем текущий, если нового нет

        if (avatarFile) {
            const filePath = `${currentUser.id}/avatar-${Date.now()}`;
            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
            if (uploadError) throw uploadError;
            const { data } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
            avatarUrl = data.publicUrl;
        }

        const { error: updateError } = await supabaseClient.from('profiles').upsert({ id: currentUser.id, full_name: newName, avatar_url: avatarUrl, updated_at: new Date() });
        if (updateError) throw updateError;
        
        profileMessage.textContent = '✅ Профиль успешно обновлен!';
        // Обновляем имя в шапке "на лету"
        document.getElementById('user-name-display').textContent = newName;
    } catch (error) {
        profileMessage.textContent = `Ошибка: ${error.message}`;
    } finally {
        submitButton.disabled = false;
        setTimeout(() => { profileMessage.textContent = ''; }, 3000);
    }
}

async function loadUserFavorites() {
    const container = document.getElementById('favorites-list');
    container.innerHTML = '<p class="loading-message">Загрузка закладок...</p>';
    const { data: relations, error } = await supabaseClient.from('favorites').select('events(*, categories(name))').eq('user_id', currentUser.id);
    if (error || !relations || relations.length === 0) {
        container.innerHTML = '<p class="info-message">У вас пока нет событий в закладках.</p>';
        return;
    }
    const events = relations.map(r => r.events).filter(Boolean);
    container.innerHTML = '';
    events.forEach(event => container.appendChild(createProfileEventCard(event)));
}

async function loadUserCommentedEvents() {
    const container = document.getElementById('comments-list');
    container.innerHTML = '<p class="loading-message">Загрузка комментированных событий...</p>';
    const { data: ids, error: rpcError } = await supabaseClient.rpc('get_commented_event_ids_by_user', { p_user_id: currentUser.id });
    if (rpcError || !ids || ids.length === 0) {
        container.innerHTML = '<p class="info-message">Вы еще не оставляли комментариев.</p>';
        return;
    }
    const { data: events, error } = await supabaseClient.from('events').select('*, categories(name)').in('id', ids.map(i => i.event_id));
    if (error) {
        container.innerHTML = '<p class="error-message">Ошибка загрузки событий.</p>';
        return;
    }
    container.innerHTML = '';
    events.forEach(event => container.appendChild(createProfileEventCard(event)));
}

// Специальная функция для создания карточки в профиле
function createProfileEventCard(event) {
    const div = document.createElement("div");
    div.className = "profile-event-item";
    div.innerHTML = `
        <img src="${event.image_url || 'https://placehold.co/60x60/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
        <div class="item-info">
            <a href="event.html?id=${event.id}" class="item-title">${sanitizeHTML(event.title)}</a>
            <span class="item-category">${sanitizeHTML(event.categories.name)}</span>
        </div>
        <div class="item-actions">
            <a href="edit-event.html?id=${event.id}" class="edit-btn">✏️</a>
        </div>
    `;
    return div;
}

// --- 4. Точка входа ---
document.addEventListener('appReady', initializeProfilePage);
