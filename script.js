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
    setupEventListeners(); 
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    const loginBtn = document.getElementById('loginBtn');
    const addEventModalBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (currentUser) {
        loginBtn.style.display = 'none';
        addEventModalBtn.style.display = 'block';
        profileDropdown.style.display = 'block';
        
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        const userName = (profile && profile.full_name) ? profile.full_name : currentUser.email.split('@')[0];
        document.getElementById('user-name-display').textContent = userName;

        const { data: adminStatus } = await supabaseClient.rpc('is_admin');
        isAdmin = adminStatus;
        if (isAdmin) {
            document.getElementById('admin-link').style.display = 'block';
        }

    } else {
        loginBtn.style.display = 'block';
        addEventModalBtn.style.display = 'none';
        profileDropdown.style.display = 'none';
    }

    loadAndDisplayCategories();
    loadEvents(true);
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
    
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    const addEventModal = document.getElementById('add-event-modal');
    const addEventModalBtn = document.getElementById('add-event-modal-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    
    if(addEventModalBtn) addEventModalBtn.onclick = () => { addEventModal.style.display = 'flex'; };
    if(modalCloseBtn) modalCloseBtn.onclick = () => { addEventModal.style.display = 'none'; };
    if(addEventModal) addEventModal.onclick = (event) => { if (event.target === addEventModal) { addEventModal.style.display = 'none'; } };
    
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
// ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ
// =================================================================
if(addEventForm) {
    addEventForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentUser) { alert("Пожалуйста, войдите."); return; }
        const submitButton = addEventForm.querySelector('button[type="submit"]');
        submitButton.disabled = true; message.textContent = "Загрузка...";
        try {
            const { data: eventData, error: insertError } = await supabaseClient.from("events").insert({ title: document.getElementById("title").value.trim(), description: document.getElementById("description").value.trim(), city: document.getElementById("city").value.trim(), event_date: document.getElementById("date").value || null, created_by: currentUser.id }).select().single();
            if (insertError) throw insertError;
            const newEventId = eventData.id;
            const imageFile = document.getElementById('image-input').files[0];
            if (imageFile) {
                const fileName = `${currentUser.id}/${newEventId}_${Date.now()}_${imageFile.name.replace(/\s/g, '-')}`;
                await supabaseClient.storage.from('event-images').upload(fileName, imageFile, { upsert: true });
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
            setTimeout(() => {
                document.getElementById('add-event-modal').style.display = 'none';
                message.textContent = "";
                loadEvents(true);
            }, 1500);
        } catch (error) {
            message.textContent = `Ошибка: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });
}

// =================================================================
// УПРАВЛЕНИЕ СОБЫТИЕМ И ФИЛЬТРЫ
// =================================================================
window.deleteEvent = async (eventId, button) => {
    if (!confirm('Вы уверены, что хотите удалить это событие?')) return;
    const card = button.closest('.event-card-new');
    card.style.opacity = '0.5';
    const { error } = await supabaseClient.from('events').delete().match({ id: eventId });
    if(error) {
        alert('Не удалось удалить событие.');
        card.style.opacity = '1';
    } else {
        card.remove();
    }
};
window.editEvent = (eventId) => { window.location.href = `edit-event.html?id=${eventId}`; };
window.resetFilters = () => {
    searchInput.value = '';
    const activePill = document.querySelector('.category-pill.active');
    if(activePill) activePill.classList.remove('active');
    currentCategoryId = null;
    loadEvents(true);
};
window.setCategoryFilter = (categoryId) => {
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    document.querySelector(`.category-pill[onclick="setCategoryFilter(${categoryId})"]`).classList.add('active');
    currentCategoryId = categoryId;
    loadEvents(true);
};
window.toggleFavorite = async (eventId, isFavorited, buttonElement) => {
    if (!currentUser) { alert('Пожалуйста, войдите, чтобы добавлять в избранное.'); return; }
    buttonElement.disabled = true;
    if (isFavorited) {
        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
        if (error) { buttonElement.disabled = false; } else {
            buttonElement.innerHTML = '🤍'; buttonElement.classList.remove('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, false, this)`); buttonElement.disabled = false;
        }
    } else {
        const { error } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
        if (error) { buttonElement.disabled = false; } else {
            buttonElement.innerHTML = '❤️'; buttonElement.classList.add('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, true, this)`); buttonElement.disabled = false;
        }
    }
};

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ
// =================================================================
async function loadEvents(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 0;
        eventsContainer.innerHTML = 'Загрузка событий...';
    }
    const searchTerm = searchInput.value.trim();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const selectString = `id, title, description, city, event_date, created_by, image_url, rating, profiles ( full_name ), favorites ( user_id ), categories${currentCategoryId ? '!inner' : ''} ( id, name )`;
    
    let query = supabaseClient.from("events").select(selectString, { count: 'exact' }).eq('is_approved', true);
    
    if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    }
    if (currentCategoryId) query = query.eq('categories.id', currentCategoryId);
    
    query = query.order('created_at', { ascending: false }).range(from, to);
    const { data, error, count } = await query;

    if (error && error.code !== 'PGRST103') { 
        eventsContainer.innerHTML = "Ошибка загрузки."; 
        return; 
    }
    
    if (isNewSearch) {
        eventsContainer.innerHTML = "";
        if (!data || data.length === 0) {
            eventsContainer.innerHTML = 'Событий по вашему запросу не найдено. <a href="#" onclick="resetFilters(); return false;">Сбросить фильтры</a>';
            paginationControls.innerHTML = "";
            return;
        }
    }
    
    (data || []).forEach(event => {
        const div = document.createElement("div");
        div.className = "event-card-new";
        let dateHtml = '';
        if (event.event_date) { dateHtml = new Date(event.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
        const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
        const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
        const favoriteIcon = isFavorited ? '❤️' : '🤍';
        const favoriteClass = isFavorited ? 'active' : '';
        let adminControls = '';
        if (currentUser && (currentUser.id === event.created_by || isAdmin)) {
            adminControls = `<div class="card-admin-controls"><button class="admin-btn" onclick="event.stopPropagation(); editEvent(${event.id})">✏️</button><button class="admin-btn" onclick="event.stopPropagation(); deleteEvent(${event.id}, this)">🗑️</button></div>`;
        }
        let categoriesHtml = '';
        if (event.categories && event.categories.length > 0) {
            categoriesHtml = '<div class="card-categories">';
            event.categories.forEach(cat => { categoriesHtml += `<span class="tag" onclick="event.stopPropagation(); setCategoryFilter(${cat.id})">${sanitizeHTML(cat.name)}</span>`; });
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
            <button class="card-save-btn ${favoriteClass}" onclick="event.stopPropagation(); toggleFavorite(${event.id}, ${isFavorited}, this)">${favoriteIcon}</button>
            ${adminControls}
          </div>`;
        eventsContainer.appendChild(div);
    });

    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    if ((currentPage + 1) * PAGE_SIZE < count) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
        paginationControls.appendChild(loadMoreBtn);
    }
}

// =================================================================
// ЗАГРУЗКА КАТЕГОРИЙ
// =================================================================
async function loadAndDisplayCategories() {
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) return;
    
    const categoriesContainer = document.getElementById('categories-container');
    const categoryPillsContainer = document.getElementById('category-pills-container');
    
    let categoriesCheckboxesHtml = '<p>Выберите категорию:</p>';
    data.forEach(category => {
        categoriesCheckboxesHtml += `<div class="category-checkbox"><input type="checkbox" id="cat-form-${category.id}" name="categories" value="${category.id}"><label for="cat-form-${category.id}">${category.name}</label></div>`;
    });
    if (categoriesContainer) categoriesContainer.innerHTML = categoriesCheckboxesHtml;
    
    let categoryPillsHtml = '<button class="category-pill" onclick="resetFilters()">Все</button>';
    data.forEach(category => {
        categoryPillsHtml += `<button class="category-pill" onclick="setCategoryFilter(${category.id})">${category.name}</button>`;
    });
    if (categoryPillsContainer) categoryPillsContainer.innerHTML = categoryPillsHtml;
}

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
main();
