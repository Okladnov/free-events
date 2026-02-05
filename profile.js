// =================================================================
// profile.js - ФИНАЛЬНАЯ, ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
// =================================================================

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ (остаются без изменений)
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
    await initializeHeader();

    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    setupProfilePageListeners();

    // === ОПТИМИЗАЦИЯ: Запускаем все асинхронные загрузки ПАРАЛЛЕЛЬНО ===
    Promise.all([
        loadProfileData(),
        loadUserFavorites(),
        loadUserCommentedEvents()
    ]).catch(error => {
        // Общий обработчик ошибок для параллельных запросов
        console.error("Произошла ошибка при загрузке данных профиля:", error);
        document.getElementById('profile-page-container').innerHTML = `<p class="error-message">Не удалось загрузить данные профиля. Попробуйте обновить страницу.</p>`;
    });
});

// =================================================================
// НАСТРОЙКА ОБРАБОТЧИКОВ СОБЫТИЙ (без изменений)
// =================================================================
function setupProfilePageListeners() {
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
// ЛОГИКА СТРАНИЦЫ ПРОФИЛЯ (с оптимизациями)
// =================================================================

async function loadProfileData() {
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', currentUser.id)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error; // Игнорируем ошибку "not found"

    if (profile) {
        profileNameInput.value = profile.full_name || '';
        welcomeMessage.textContent = `Привет, ${profile.full_name || currentUser.email.split('@')[0]}!`;
        if (profile.avatar_url) {
            userAvatar.src = profile.avatar_url;
        }
    } else {
         welcomeMessage.textContent = `Привет, ${currentUser.email.split('@')[0]}!`;
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
            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
            if (uploadError) throw uploadError;
            const { data } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
            avatarUrl = data.publicUrl;
        }

        const updates = { id: currentUser.id, full_name: newName, updated_at: new Date() };
        if (avatarUrl) updates.avatar_url = avatarUrl;
        
        // upsert - обновит профиль, если он есть, или создаст новый
        const { error: updateError } = await supabaseClient.from('profiles').upsert(updates);
        if (updateError) throw updateError;

        profileMessage.textContent = '✅ Профиль успешно обновлен!';
        profileMessage.style.color = '#2ecc71';
        
        document.getElementById('user-name-display').textContent = newName;
        welcomeMessage.textContent = `Привет, ${newName}!`; // Обновляем и приветствие
    } catch (error) {
        profileMessage.textContent = `Ошибка: ${error.message}`;
        profileMessage.style.color = '#e74c3c';
    } finally {
        submitButton.disabled = false;
        setTimeout(() => { profileMessage.textContent = ''; }, 3000);
    }
}

async function loadUserFavorites() {
    favoritesListContainer.innerHTML = '<p>Загрузка избранного...</p>';
    
    // Используем такой же эффективный запрос, как и в favorites.js
    const { data: favoriteRelations, error } = await supabaseClient
        .from('favorites')
        .select('events(*, categories(name))')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    
    const favoriteEvents = favoriteRelations.map(rel => rel.events).filter(Boolean);
    
    if (favoriteEvents.length === 0) {
        favoritesListContainer.innerHTML = '<p>У вас пока нет событий в избранном.</p>';
        return;
    }
    
    favoritesListContainer.innerHTML = '';
    favoriteEvents.forEach(event => {
        favoritesListContainer.insertAdjacentHTML('beforeend', createEventCard(event));
    });
}

// === ОПТИМИЗАЦИЯ: Используем новое VIEW ===
async function loadUserCommentedEvents() {
    commentsListContainer.innerHTML = '<p>Загрузка комментированных событий...</p>';
    
    // ОДИН запрос к нашему новому "умному" представлению
    const { data: events, error } = await supabaseClient
        .from('user_commented_events')
        .select(`*, categories(name)`)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
        
    if (error) throw error;
    
    if (events.length === 0) {
        commentsListContainer.innerHTML = '<p>Вы еще не оставляли комментариев.</p>';
        return;
    }
    
    commentsListContainer.innerHTML = '';
    events.forEach(event => {
        commentsListContainer.insertAdjacentHTML('beforeend', createEventCard(event));
    });
}

// Рендер-функция для карточки (без изменений)
function createEventCard(event) {
    const categoriesHtml = (event.categories || []).map(cat => `<span class="tag">${sanitizeHTML(cat.name)}</span>`).join('');
    return `
      <div class="event-card-v3">
        <a href="event.html?id=${event.id}" class="card-image-link">
            <img src="${event.image_url || 'https://placehold.co/250x250/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
        </a>
        <div class="card-content">
            <div class="card-categories">${categoriesHtml}</div>
            <a href="event.html?id=${event.id}" class="card-title-link"><h3>${sanitizeHTML(event.title)}</h3></a>
            <p class="card-description">${sanitizeHTML(event.description || '').substring(0, 80)}...</p>
        </div>
        <div class="card-footer">
            <a href="event.html?id=${event.id}" class="card-main-link">К событию</a>
        </div>
      </div>`;
}
