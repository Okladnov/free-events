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
// НАСТРОЙКИ ПАГИНАЦИИ
// =================================================================
const PAGE_SIZE = 9;
let currentPage = 0;
let currentSortOrder = 'created_at'; // По умолчанию сортируем по дате добавления

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); };
window.logout = async function() { await supabaseClient.auth.signOut(); };

supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;
  loginBtn.style.display = session ? 'none' : 'block';
  logoutBtn.style.display = session ? 'block' : 'none';
  userInfo.textContent = session ? `Вы вошли как: ${session.user.email}` : '';
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
  const imageFile = document.getElementById('image-input').files[0];
  let imageUrl = null;
  if (imageFile) {
    const cleanFileName = imageFile.name.replace(/\s/g, '-');
    const fileName = `${currentUser.id}/${Date.now()}_${cleanFileName}`;
    const { data, error } = await supabaseClient.storage.from('event-images').upload(fileName, imageFile);
    if (error) { console.error('Ошибка загрузки изображения:', error); message.textContent = "Ошибка при загрузке изображения."; submitButton.disabled = false; return; }
    const { data: { publicUrl } } = supabaseClient.storage.from('event-images').getPublicUrl(fileName);
    imageUrl = publicUrl;
  }
  const { error: insertError } = await supabaseClient.from("events").insert([{ title, description: document.getElementById("description").value.trim(), city: document.getElementById("city").value.trim(), event_date: document.getElementById("date").value, created_by: currentUser.id, image_url: imageUrl }]);
  submitButton.disabled = false;
  if (insertError) { console.error("Ошибка добавления:", insertError); message.textContent = "Ошибка."; return; }
  message.textContent = "✅ Отправлено на модерацию!";
  addEventForm.reset();
});

// =================================================================
// УПРАВЛЕНИЕ СОБЫТИЕМ (РЕДАКТИРОВАНИЕ, УДАЛЕНИЕ)
// =================================================================
window.deleteEvent = async function(eventId) {
  if (confirm("Вы уверены, что хотите удалить это событие?")) {
    const { error } = await supabaseClient.from('events').delete().match({ id: eventId });
    if (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось удалить событие. Убедитесь, что вы являетесь автором.');
    }
  }
};

window.editEvent = async function(eventId) {
  const { data: event, error: fetchError } = await supabaseClient.from('events').select().eq('id', eventId).single();
  if (fetchError || !event) { alert('Не удалось загрузить данные для редактирования.'); return; }
  
  const newTitle = prompt("Редактировать название:", event.title);
  if (newTitle === null) return;

  const newDescription = prompt("Редактировать описание:", event.description);
  const newCity = prompt("Редактировать город:", event.city);
  const newDate = prompt("Редактировать дату (ГГГГ-ММ-ДД):", event.event_date);
  
  const { error: updateError } = await supabaseClient.from('events')
    .update({ 
      title: newTitle.trim(), 
      description: newDescription.trim(),
      city: newCity.trim(),
      event_date: newDate || null
    })
    .match({ id: eventId });

  if (updateError) {
    console.error('Ошибка обновления:', updateError);
    alert('Не удалось обновить событие. Убедитесь, что вы являетесь автором.');
  }
};

// =================================================================
// ГОЛОСОВАНИЕ и КОММЕНТАРИИ
// =================================================================
window.vote = async function(eventId, value) { if (!currentUser) { alert("Пожалуйста, войдите."); return; } await supabaseClient.from("votes").insert([{ event_id: eventId, value, user_id: currentUser.id }]); };
window.addComment = async function(eventId) { if (!currentUser) { alert("Пожалуйста, войдите."); return; } const contentInput = document.getElementById(`comment-input-${eventId}`); const content = contentInput.value.trim(); if (!content) { return; } const { error } = await supabaseClient.from('comments').insert([{ content, event_id: eventId, user_id: currentUser.id }]); if (!error) { contentInput.value = ''; } };

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================
function formatDisplayDate(dateString) { if (!dateString) return ""; return new Date(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
window.resetFilters = function() { searchInput.value = ''; cityFilter.value = ''; loadEvents(true); }

// Новая функция для установки порядка сортировки
window.setSortOrder = function(sortOrder) {
  // 1. Запоминаем новый порядок
  currentSortOrder = sortOrder;

  // 2. Снимаем класс 'active' со всех кнопок
  document.getElementById('sort-new').classList.remove('active');
  document.getElementById('sort-popular').classList.remove('active');
  
  // 3. Добавляем класс 'active' только что нажатой кнопке
  if (sortOrder === 'created_at') {
    document.getElementById('sort-new').classList.add('active');
  } else if (sortOrder === 'rating') {
    document.getElementById('sort-popular').classList.add('active');
  }

  // 4. Перезагружаем все события с самого начала с новой сортировкой
  loadEvents(true);
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

  let query = supabaseClient.from("events").select(`
    id, title, description, city, event_date, created_by, image_url,
    profiles ( full_name ),
    votes ( user_id, value ),
    comments ( id, content, created_at, profiles ( full_name ) )
  `, { count: 'exact' }).eq('is_approved', true);

  if (searchTerm) { query = query.ilike('title', `%${searchTerm}%`); }
  if (city) { query = query.ilike('city', `%${city}%`); }

  query = query.range(from, to).order(currentSortOrder, { ascending: false });

  const { data, error, count } = await query;

  if (error) { console.error("Ошибка загрузки:", error); eventsContainer.innerHTML = "Ошибка загрузки."; return; }

  if (isNewSearch && (!data || data.length === 0)) {
    eventsContainer.innerHTML = "Событий по вашему запросу не найдено.";
    paginationControls.innerHTML = "";
    return;
  }

  if (isNewSearch) {
    eventsContainer.innerHTML = "";
  }

  data.forEach(event => {
    const rating = event.votes.reduce((sum, v) => sum + v.value, 0);
    let scoreClass = ''; let scoreIcon = '';
    if (rating < 0) { scoreClass = 'score-cold'; scoreIcon = '❄️'; } 
    else if (rating > 20) { scoreClass = 'score-fire'; scoreIcon = '🔥🔥'; } 
    else if (rating > 5) { scoreClass = 'score-hot'; scoreIcon = '🔥'; }

    const hasVoted = currentUser ? event.votes.some(v => v.user_id === currentUser.id) : false;
    const displayDate = formatDisplayDate(event.event_date);
    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';
    
    let adminControls = '';
    if (currentUser && currentUser.id === event.created_by) {
      adminControls = `
        <div class="card-admin-controls">
          <button class="admin-btn" onclick="editEvent(${event.id})">✏️</button>
          <button class="admin-btn" onclick="deleteEvent(${event.id})">🗑️</button>
        </div>
      `;
    }
    
    let commentsHtml = '<ul class="comments-list">'; event.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(comment => { const commentAuthor = comment.profiles ? comment.profiles.full_name : 'Аноним'; const commentDate = new Date(comment.created_at).toLocaleString('ru-RU'); commentsHtml += `<li class="comment"><span class="comment-author">${commentAuthor}</span><span class="comment-date">${commentDate}</span><p>${comment.content}</p></li>`; }); commentsHtml += '</ul>';
    
    const div = document.createElement("div"); 
    div.className = "event-card";
    
    div.innerHTML = `
      ${adminControls} 
      ${event.image_url ? `<img src="${event.image_url}" alt="${event.title}" class="event-card-image">` : ''}
      <div class="card-content">
        <h3>${event.title}</h3>
        <p>${event.description || "Нет описания."}</p>
        <div class="meta">
          <span class="meta-item">📍 ${event.city || "Весь мир"}</span>
          ${displayDate ? `<span class="meta-item">🗓️ ${displayDate}</span>` : ''}
        </div>
        <div class="author">👤 Добавил: ${authorName}</div>
        <div class="vote">
          <button onclick="vote(${event.id}, 1)" ${hasVoted ? 'disabled' : ''}>▲</button>
          <span class="score ${scoreClass}">${rating} ${scoreIcon}</span>
          <button onclick="vote(${event.id}, -1)" ${hasVoted ? 'disabled' : ''}>▼</button>
        </div>
        <div class="comments-section">
          <h4>Комментарии</h4>
          ${commentsHtml}
          <form class="comment-form" onsubmit="addComment(${event.id}); return false;">
            <input id="comment-input-${event.id}" placeholder="Написать комментарий..." required>
            <button type="submit">Отправить</button>
          </form>
        </div>
      </div>
    `;
    eventsContainer.appendChild(div);
  });

  paginationControls.innerHTML = "";
  const totalLoaded = (currentPage + 1) * PAGE_SIZE;
  
  if (count > totalLoaded) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.textContent = 'Загрузить еще';
    loadMoreBtn.id = 'load-more-btn';
    loadMoreBtn.onclick = () => { currentPage++; loadEvents(false); };
    paginationControls.appendChild(loadMoreBtn);
  }
}

// =================================================================
// REAL-TIME ПОДПИСКА
// =================================================================
const subscription = supabaseClient.channel('public-schema-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
    console.log('Получено изменение в базе данных, перезагружаю события!', payload);
    loadEvents(true);
  })
  .subscribe();

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEvents(true);
