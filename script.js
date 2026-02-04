// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================
function sanitizeHTML(text) { if (!text) return ''; return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }); }
function sanitizeForAttribute(text) { if (!text) return ''; return text.toString().replace(/"/g, '&quot;'); }

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " г. назад";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " мес. назад";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " д. назад";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ч. назад";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " мин. назад";
    return "только что";
}

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

    if (currentUser) {
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('add-event-modal-btn').style.display = 'block';
        document.getElementById('profile-dropdown').style.display = 'block';
        
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        const userName = (profile && profile.full_name) ? profile.full_name : currentUser.email.split('@')[0];
        document.getElementById('user-name-display').textContent = userName;

        const { data: adminStatus } = await supabaseClient.rpc('is_admin');
        isAdmin = adminStatus;
        if (isAdmin) {
            document.getElementById('admin-link').style.display = 'block';
        }
    } else {
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('add-event-modal-btn').style.display = 'none';
        document.getElementById('profile-dropdown').style.display = 'none';
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
    const card = button.closest('.event-card-v3'); // Обновленный класс
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
            buttonElement.classList.remove('active');
        }
    } else {
        const { error } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
        if (error) { buttonElement.disabled = false; } else {
            buttonElement.classList.add('active');
        }
    }
    buttonElement.disabled = false;
};

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ - ВЕРСИЯ V3
// =================================================================
async function loadEvents(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 0;
        eventsContainer.innerHTML = '<p>Загрузка событий...</p>';
        paginationControls.innerHTML = '';
    }

    const searchTerm = searchInput.value.trim();
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    let query = supabaseClient
        .from('events_with_comment_count')
        .select(`*, organizations(name), categories!inner(id, name), profiles(full_name, avatar_url), favorites(user_id)`)
        .eq('is_approved', true);
    
    if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    }
    if (currentCategoryId) {
        query = query.eq('categories.id', currentCategoryId);
    }
    
    query = query.order('created_at', { ascending: false }).range(from, to - 1);

    const { data: events, error, count } = await query;

    if (error) {
        console.error("Ошибка загрузки событий:", error);
        if (isNewSearch) eventsContainer.innerHTML = "<p>Ошибка загрузки событий.</p>";
        return; 
    }
    
    if (isNewSearch) {
        eventsContainer.innerHTML = "";
    }

    if (!events || events.length === 0) {
        if (isNewSearch) eventsContainer.innerHTML = '<p>Событий по вашему запросу не найдено.</p>';
        paginationControls.innerHTML = '';
        return;
    }
    
    events.forEach(event => {
        const div = document.createElement("div");
        div.className = "event-card-v3"; 
        
        const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
        const authorAvatar = event.profiles ? event.profiles.avatar_url : 'https://placehold.co/24x24/f0f2f5/ccc';
        const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;

        div.innerHTML = `
            <div class="card-header">
                <span>Опубликовано ${timeAgo(event.created_at)}</span>
                <span class="card-temp">-5°</span>
            </div>
            <div class="card-body">
                <a href="event.html?id=${event.id}" class="card-image-link">
                    <img src="${event.image_url || 'https://placehold.co/250x250/f0f2f5/ff6a00?text=Нет+фото'}" alt="${sanitizeForAttribute(event.title)}">
                </a>
                <div class="card-content">
                    ${event.organizations ? `<a href="/?org=${event.organization_id}" class="card-organization">${sanitizeHTML(event.organizations.name)}</a>` : '<div class="card-organization-placeholder"></div>'}
                    <a href="event.html?id=${event.id}" class="card-title-link">
                        <h3>${sanitizeHTML(event.title)}</h3>
                    </a>
                    <p class="card-description">${sanitizeHTML(event.description || '').substring(0, 100)}...</p>
                    <div class="card-author">
                        <img src="${authorAvatar || 'https://placehold.co/24x24/f0f2f5/ccc'}" alt="avatar">
                        <span>${sanitizeHTML(authorName)}</span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-actions">
                    <button class="action-btn ${isFavorited ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${event.id}, ${isFavorited}, this)">
                        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                        <span>В избранное</span>
                    </button>
                    <div class="action-btn">
                        <svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"></path></svg>
                        <span>${event.comment_count}</span>
                    </div>
                </div>
                <a href="event.html?id=${event.id}" class="card-main-link">К событию</a>
            </div>
        `;
        eventsContainer.appendChild(div);
    });

    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) existingLoadMoreBtn.remove();
    
    if (count && count > to) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.textContent = 'Загрузить еще';
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
    (data || []).forEach(category => {
        categoriesCheckboxesHtml += `<div class="category-checkbox"><input type="checkbox" id="cat-form-${category.id}" name="categories" value="${category.id}"><label for="cat-form-${category.id}">${category.name}</label></div>`;
    });
    if (categoriesContainer) categoriesContainer.innerHTML = categoriesCheckboxesHtml;
    
    let categoryPillsHtml = '<button class="category-pill" onclick="resetFilters()">Все</button>';
    (data || []).forEach(category => {
        categoryPillsHtml += `<button class="category-pill" onclick="setCategoryFilter(${category.id})">${category.name}</button>`;
    });
    if (categoryPillsContainer) categoryPillsContainer.innerHTML = categoryPillsHtml;
}

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
main();
