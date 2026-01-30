// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('user-info');
const eventsContainer = document.getElementById("events");
const message = document.getElementById("message");
const addEventForm = document.getElementById("add-event-form");
let currentUser = null;
const searchInput = document.getElementById('search-input');
const cityFilter = document.getElementById('city-filter');
const paginationControls = document.getElementById('pagination-controls');

// =================================================================
// НАСТРОЙКИ
// =================================================================
const PAGE_SIZE = 9;
let currentPage = 0;
let currentSortOrder = 'created_at';
let currentCategoryId = null;

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); };
window.logout = async function() { await supabaseClient.auth.signOut(); };
supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('user-info');
  const favoritesLink = document.getElementById('favorites-link');
  loginBtn.style.display = session ? 'none' : 'block';
  logoutBtn.style.display = session ? 'block' : 'none';
  userInfo.textContent = session ? `Вы вошли как: ${session.user.email}` : '';
  favoritesLink.style.display = session ? 'inline' : 'none';
  loadEvents(true);
});

// =================================================================
// ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ
// =================================================================
addEventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) { alert("Пожалуйста, войдите, чтобы добавить событие."); return; }
  const submitButton = addEventForm.querySelector('button[type="submit"]');
  submitButton.disabled = true; message.textContent = "Загрузка...";
  const title = document.getElementById("title").value.trim();
  if (!title) { message.textContent = "Введите название."; submitButton.disabled = false; return; }
  try {
    const { data: eventData, error: insertError } = await supabaseClient.from("events").insert({ title: title, description: document.getElementById("description").value.trim(), city: document.getElementById("city").value.trim(), event_date: document.getElementById("date").value, created_by: currentUser.id }).select().single();
    if (insertError) throw insertError;
    const newEventId = eventData.id;
    const imageFile = document.getElementById('image-input').files[0];
    if (imageFile) {
      const cleanFileName = imageFile.name.replace(/\s/g, '-');
      const fileName = `${currentUser.id}/${newEventId}_${cleanFileName}`;
      const { error: uploadError } = await supabaseClient.storage.from('event-images').upload(fileName, imageFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabaseClient.storage.from('event-images').getPublicUrl(fileName);
      const { error: updateImageError } = await supabaseClient.from('events').update({ image_url: publicUrl }).match({ id: newEventId });
      if (updateImageError) throw updateImageError;
    }
    const selectedCategories = Array.from(document.querySelectorAll('#categories-container input:checked')).map(cb => Number(cb.value));
    if (selectedCategories.length > 0) {
      const linksToInsert = selectedCategories.map(categoryId => ({ event_id: newEventId, category_id: categoryId }));
      const { error: linkError } = await supabaseClient.from('event_categories').insert(linksToInsert);
      if (linkError) throw linkError;
    }
    message.textContent = "✅ Отправлено на модерацию!";
    addEventForm.reset();
    document.querySelectorAll('#categories-container input:checked').forEach(cb => cb.checked = false);
  } catch (error) {
    console.error("Ошибка при добавлении события:", error);
    message.textContent = `Ошибка: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});

// =================================================================
// УПРАВЛЕНИЕ СОБЫТИЕМ (РЕДАКТИРОВАНИЕ, УДАЛЕНИЕ)
// =================================================================
window.deleteEvent = async function(eventId) { if (confirm("Вы уверены, что хотите удалить это событие?")) { const { error } = await supabaseClient.from('events').delete().match({ id: eventId }); if (error) { console.error('Ошибка удаления:', error); alert('Не удалось удалить событие.'); } } };
window.editEvent = async function(eventId) { const { data: event, error: fetchError } = await supabaseClient.from('events').select().eq('id', eventId).single(); if (fetchError || !event) { alert('Не удалось загрузить данные для редактирования.'); return; } const newTitle = prompt("Редактировать название:", event.title); if (newTitle === null) return; const newDescription = prompt("Редактировать описание:", event.description); const newCity = prompt("Редактировать город:", event.city); const newDate = prompt("Редактировать дату (ГГГГ-ММ-ДД):", event.event_date); const { error: updateError } = await supabaseClient.from('events').update({ title: newTitle.trim(), description: newDescription.trim(), city: newCity.trim(), event_date: newDate || null }).match({ id: eventId }); if (updateError) { console.error('Ошибка обновления:', updateError); alert('Не удалось обновить событие.'); } };

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================
window.resetFilters = function() { searchInput.value = ''; cityFilter.value = ''; setCategoryFilter(null); };
window.setCategoryFilter = function(categoryId) { if (currentCategoryId === categoryId) return; currentCategoryId = categoryId; document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active')); if (categoryId) { document.getElementById(`cat-pill-${categoryId}`).classList.add('active'); } else { document.getElementById('cat-pill-all').classList.add('active'); } loadEvents(true); };

window.toggleFavorite = async function(eventId, isCurrentlyFavorited, buttonElement) {
    if (!currentUser) {
        alert('Пожалуйста, войдите, чтобы добавлять в избранное.');
        return;
    }
    buttonElement.disabled = true;
    if (isCurrentlyFavorited) {
        const { error } = await supabaseClient.from('favorites').delete().match({ event_id: eventId, user_id: currentUser.id });
        if (error) {
            console.error('Ошибка удаления из избранного:', error);
            buttonElement.disabled = false;
        } else {
            buttonElement.innerHTML = '🤍';
            buttonElement.classList.remove('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, false, this)`);
            buttonElement.disabled = false;
        }
    } else {
        const { error } = await supabaseClient.from('favorites').insert({ event_id: eventId, user_id: currentUser.id });
        if (error) {
            console.error('Ошибка добавления в избранное:', error);
            buttonElement.disabled = false;
        } else {
            buttonElement.innerHTML = '❤️';
            buttonElement.classList.add('active');
            buttonElement.setAttribute('onclick', `event.stopPropagation(); toggleFavorite(${eventId}, true, this)`);
            buttonElement.disabled = false;
        }
    }
}

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
  let query = supabaseClient.from("events").select(selectString, { count: 'exact' }).eq('is_approved', true);
  if (searchTerm) { query = query.ilike('title', `%${searchTerm}%`); }
  if (city) { query = query.ilike('city', `%${city}%`); }
  if (currentCategoryId) { query = query.eq('categories.id', currentCategoryId); }
  query = query.order('created_at', { ascending: false }).range(from, to);
  const { data, error, count } = await query;
  if (error) { console.error("Ошибка загрузки:", error); eventsContainer.innerHTML = "Ошибка загрузки."; return; }
  if (isNewSearch) {
    eventsContainer.innerHTML = "";
    if (!data || data.length === 0) {
      let message = "Событий по вашему запросу не найдено.";
      if (currentCategoryId) { message += ' <a href="#" onclick="resetFilters(); return false;">Сбросить фильтр</a>'; }
      eventsContainer.innerHTML = message;
      paginationControls.innerHTML = "";
      return;
    }
  }
  data.forEach(event => {
    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
    let dateHtml = '';
    if (event.event_date) { const d = new Date(event.event_date); const day = d.getDate(); const month = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', ''); dateHtml = `<div class="event-card-date"><span class="day">${day}</span><span class="month">${month}</span></div>`; }
    let adminControls = '';
    if (currentUser && currentUser.id === event.created_by) { adminControls = `<div class="card-admin-controls"><button class="admin-btn" onclick="event.stopPropagation(); editEvent(${event.id})">✏️</button><button class="admin-btn" onclick="event.stopPropagation(); deleteEvent(${event.id})">🗑️</button></div>`; }
    let categoriesHtml = '';
    if (event.categories && event.categories.length > 0) {
      categoriesHtml = '<div class="card-categories">';
      event.categories.forEach(cat => { categoriesHtml += `<span class="tag" onclick="event.stopPropagation(); setCategoryFilter(${cat.id})">${cat.name}</span>`; });
      categoriesHtml += '</div>';
    }
    let isFavorited = false;
    if (currentUser && event.favorites) { isFavorited = event.favorites.some(fav => fav.user_id === currentUser.id); }
    const favoriteIcon = isFavorited ? '❤️' : '🤍';
    const favoriteClass = isFavorited ? 'active' : '';
    const div = document.createElement("div");
    div.onclick = () => { window.location.href = `event.html?id=${event.id}`; };
    div.className = "event-card";
    div.innerHTML = `
      <div class="event-card-image-container">
        <img src="${event.image_url || 'https://placehold.co/600x337/f0f2f5/ff6a00?text=Нет+фото'}" alt="${event.title}" class="event-card-image">
        ${dateHtml}
        <button class="card-save-btn ${favoriteClass}" onclick="event.stopPropagation(); toggleFavorite(${event.id}, ${isFavorited}, this)">${favoriteIcon}</button>
        ${adminControls}
      </div>
      <div class="card-content">
        <h3>${event.title}</h3>
        ${categoriesHtml}
        <p>${event.description || 'Нет описания.'}</p>
        <div class="meta">
            <div class="meta-item">
                <span>📍</span>
                <span>${event.city || 'Онлайн'}</span>
            </div>
            <div class="meta-item">
                <span>👤</span>
                <span>Добавил: ${authorName}</span>
            </div>
        </div>
      </div>`;
    eventsContainer.appendChild(div);
  });
  paginationControls.innerHTML = "";
  const totalLoaded = document.querySelectorAll('.event-card').length;
  if (count > totalLoaded) { const loadMoreBtn = document.createElement('button'); loadMoreBtn.textContent = 'Загрузить еще'; loadMoreBtn.id = 'load-more-btn'; loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); }; paginationControls.appendChild(loadMoreBtn); }
}

// =================================================================
// ЗАГРУЗКА КАТЕГОРИЙ
// =================================================================
async function loadAndDisplayCategories() {
  const { data: categories, error } = await supabaseClient.from('categories').select('*').order('name');
  if (error) { console.error('Ошибка загрузки категорий:', error); return; }
  const pillsContainer = document.getElementById('category-pills-container');
  let pillsHtml = '<button id="cat-pill-all" class="category-pill active" onclick="setCategoryFilter(null)">Все</button>';
  categories.forEach(category => { pillsHtml += `<button id="cat-pill-${category.id}" class="category-pill" onclick="setCategoryFilter(${category.id})">${category.name}</button>`; });
  pillsContainer.innerHTML = pillsHtml;
  const formContainer = document.getElementById('categories-container');
  let checkboxesHtml = '<p>Выберите категорию (одну или несколько):</p>';
  categories.forEach(category => { checkboxesHtml += `<div class="category-checkbox"><input type="checkbox" id="cat-form-${category.id}" name="categories" value="${category.id}"><label for="cat-form-${category.id}">${category.name}</label></div>`; });
  formContainer.innerHTML = checkboxesHtml;
}

// =================================================================
// REAL-TIME ПОДПИСКА
// =================================================================
const subscription = supabaseClient.channel('public-schema-changes').on('postgres_changes', { event: '*', schema: 'public' }, (payload) => { console.log('Получено изменение в базе данных, перезагружаю события!', payload); loadEvents(true); }).subscribe();

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadAndDisplayCategories();
// loadEvents() будет вызван автоматически через onAuthStateChange
