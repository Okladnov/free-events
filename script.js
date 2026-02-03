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
const eventsContainer = document.getElementById("events");
const message = document.getElementById("message");
const addEventForm = document.getElementById("add-event-form");
const searchInput = document.getElementById('search-input');
const cityFilter = document.getElementById('city-filter');
const paginationControls = document.getElementById('pagination-controls');
let currentUser = null;
let isAdmin = false;

// =================================================================
// НАСТРОЙКИ
// =================================================================
const PAGE_SIZE = 9;
let currentPage = 0;
let currentCategoryId = null;

// =================================================================
// ГЛАВНАЯ ЛОГИКА
// =================================================================
async function main() {
    // [УЛУЧШЕНИЕ 1] Используем прямой, надежный способ получения сессии
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    if (currentUser) {
        const { data: adminStatus } = await supabaseClient.rpc('is_admin');
        isAdmin = adminStatus;
    }

    // Показываем информацию о пользователе
    document.getElementById('loginBtn').style.display = session ? 'none' : 'block';
    document.getElementById('logoutBtn').style.display = session ? 'block' : 'none';
    document.getElementById('favorites-link').style.display = session ? 'inline' : 'none';
    if(session) {
        document.getElementById('user-info').textContent = `Вы вошли как: ${session.user.email}`;
    }
    
    window.loginWithGoogle = async () => await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
    document.getElementById('logoutBtn').onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    // Запускаем загрузку событий и категорий
    loadAndDisplayCategories();
    loadEvents(true);
}

// =================================================================
// ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ (без изменений, код хороший)
// =================================================================
addEventForm.addEventListener('submit', async (event) => {
    // ... (весь код формы остается без изменений)
    event.preventDefault();
    if (!currentUser) { alert("Пожалуйста, войдите."); return; }
    const submitButton = addEventForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; message.textContent = "Загрузка...";
    try {
        const { data: eventData, error: insertError } = await supabaseClient.from("events").insert({ title: document.getElementById("title").value.trim(), description: document.getElementById("description").value.trim(), city: document.getElementById("city").value.trim(), event_date: document.getElementById("date").value, created_by: currentUser.id }).select().single();
        if (insertError) throw insertError;
        const newEventId = eventData.id;
        const imageFile = document.getElementById('image-input').files[0];
        if (imageFile) {
            const fileName = `${currentUser.id}/${newEventId}_${imageFile.name.replace(/\s/g, '-')}`;
            await supabaseClient.storage.from('event-images').upload(fileName, imageFile);
            const { data: { publicUrl } } = supabaseClient.storage.from('event-images').getPublicUrl(fileName);
            await supabaseClient.from('events').update({ image_url: publicUrl }).match({ id: newEventId });
        }
        const selectedCategories = Array.from(document.querySelectorAll('#categories-container input:checked')).map(cb => Number(cb.value));
        if (selectedCategories.length > 0) {
            const linksToInsert = selectedCategories.map(categoryId => ({ event_id: newEventId, category_id: categoryId }));
            await supabaseClient.from('event_categories').insert(linksToInsert);
        }
        message.textContent = "✅ Отправлено на модерацию!";
        addEventForm.reset();
    } catch (error) {
        message.textContent = `Ошибка: ${error.message}`;
    } finally {
        submitButton.disabled = false;
    }
});


// =================================================================
// УПРАВЛЕНИЕ СОБЫТИЕМ И ФИЛЬТРЫ (без изменений)
// =================================================================
window.deleteEvent = async (eventId) => { /*...*/ };
window.editEvent = (eventId) => { window.location.href = `edit-event.html?id=${eventId}`; };
window.resetFilters = () => { /*...*/ };
window.setCategoryFilter = (categoryId) => { /*...*/ };
window.toggleFavorite = async (eventId, isFavorited, buttonElement) => { /*...*/ };

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: ЗАГРУЗКА СОБЫТИЙ
// =================================================================
async function loadEvents(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 0;
        eventsContainer.innerHTML = 'Загрузка событий...';
    }
    const searchTerm = searchInput.value.trim();
    const city = cityFilter.value.trim();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const selectString = `id, title, description, city, event_date, created_by, image_url, rating, profiles ( full_name ), favorites ( user_id ), categories${currentCategoryId ? '!inner' : ''} ( id, name )`;
    
    // [УЛУЧШЕНИЕ 3] Убрали дублирующийся фильтр
    let query = supabaseClient.from("events").select(selectString, { count: 'exact' }).eq('is_approved', true);
    
    if (searchTerm) {
  query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
}
    
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) { eventsContainer.innerHTML = "Ошибка загрузки."; return; }

    if (isNewSearch) {
        eventsContainer.innerHTML = "";
        if (!data || data.length === 0) {
            eventsContainer.innerHTML = 'Событий по вашему запросу не найдено. <a href="#" onclick="resetFilters(); return false;">Сбросить фильтр</a>';
            paginationControls.innerHTML = "";
            return;
        }
    }

    data.forEach(event => {
        const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
        let dateHtml = '';
        if (event.event_date) { const d = new Date(event.event_date); const day = d.getDate(); const month = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', ''); dateHtml = `<div class="event-card-date"><span class="day">${day}</span><span class="month">${month}</span></div>`; }
        
        let adminControls = '';
        // [УЛУЧШЕНИЕ 4] Админ видит все кнопки
        if (currentUser && (currentUser.id === event.created_by || isAdmin)) {
            adminControls = `<div class="card-admin-controls"><button class="admin-btn" onclick="event.stopPropagation(); editEvent(${event.id})">✏️</button><button class="admin-btn" onclick="event.stopPropagation(); deleteEvent(${event.id})">🗑️</button></div>`;
        }

        let categoriesHtml = '';
        if (event.categories && event.categories.length > 0) {
            categoriesHtml = '<div class="card-categories">';
            event.categories.forEach(cat => { categoriesHtml += `<span class="tag" onclick="event.stopPropagation(); setCategoryFilter(${cat.id})">${sanitizeHTML(cat.name)}</span>`; });
            categoriesHtml += '</div>';
        }

        const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
        const favoriteIcon = isFavorited ? '❤️' : '🤍';
        const favoriteClass = isFavorited ? 'active' : '';
        
        const div = document.createElement("div");
        div.onclick = () => { window.location.href = `event.html?id=${event.id}`; };
        div.className = "event-card";
        
        // [УЛУЧШЕНИЕ 2] Применяем sanitizeForAttribute
        div.innerHTML = `
          <div class="event-card-image-container">
            <img src="${event.image_url || 'https://placehold.co/600x337/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}" class="event-card-image">
            ${dateHtml}
            <button class="card-save-btn ${favoriteClass}" onclick="event.stopPropagation(); toggleFavorite(${event.id}, ${isFavorited}, this)">${favoriteIcon}</button>
            ${adminControls}
          </div>
          <div class="card-content">
            <h3>${sanitizeHTML(event.title)}</h3>
            ${categoriesHtml}
            <p>${sanitizeHTML(event.description) || 'Нет описания.'}</p>
            <div class="meta">
                <div class="meta-item"><span>📍</span><span>${sanitizeHTML(event.city) || 'Онлайн'}</span></div>
                <div class="meta-item"><span>👤</span><span>Добавил: ${sanitizeHTML(authorName)}</span></div>
            </div>
          </div>`;
        eventsContainer.appendChild(div);
    });

    paginationControls.innerHTML = "";
    const totalLoaded = document.querySelectorAll('.event-card').length;
    if (count > totalLoaded) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
        paginationControls.appendChild(loadMoreBtn);
    }
}

// =================================================================
// ЗАГРУЗКА КАТЕГОРИЙ (без изменений)
// =================================================================
async function loadAndDisplayCategories() { /*...*/ }

// =================================================================
// REAL-TIME ПОДПИСКА (убрал, т.к. требует RLS, который мы выключили для простоты)
// =================================================================

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
main();
