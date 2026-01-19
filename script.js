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

// ИЗМЕНЕНИЕ: Добавляем элементы для фильтров
const searchInput = document.getElementById('search-input');
const cityFilter = document.getElementById('city-filter');

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() { /* ... код без изменений ... */ };
window.logout = async function() { /* ... код без изменений ... */ };
supabaseClient.auth.onAuthStateChange((event, session) => { /* ... код без изменений ... */ });

// =================================================================
// ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ
// =================================================================
addEventForm.addEventListener('submit', async (event) => { /* ... код без изменений ... */ });

// =================================================================
// ГОЛОСОВАНИЕ
// =================================================================
window.vote = async function (eventId, value) { /* ... код без изменений ... */ };

// =================================================================
// ФУНКЦИЯ ДЛЯ КРАСИВОЙ ДАТЫ
// =================================================================
function formatDisplayDate(dateString) { /* ... код без изменений ... */ }

// =================================================================
// ИЗМЕНЕНИЕ: НОВАЯ ФУНКЦИЯ ДЛЯ СБРОСА ФИЛЬТРОВ
// =================================================================
window.resetFilters = function() {
  searchInput.value = '';
  cityFilter.value = '';
  loadEvents();
}

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ (с поиском и фильтрами)
// =================================================================
window.loadEvents = async function() { // Сделаем ее глобальной, чтобы кнопка "Найти" работала
  const searchTerm = searchInput.value.trim();
  const city = cityFilter.value.trim();

  // Начинаем строить запрос
  let query = supabaseClient
    .from("events")
    .select(`
      id, title, description, city, event_date, created_by,
      profiles ( full_name ),
      votes ( user_id, value )
    `)
    .eq('is_approved', true);

  // ИЗМЕНЕНИЕ: Добавляем фильтры, если они есть
  if (searchTerm) {
    // ilike - это поиск без учета регистра (большие/маленькие буквы)
    query = query.ilike('title', `%${searchTerm}%`);
  }
  if (city) {
    query = query.ilike('city', `%${city}%`);
  }

  // Завершаем запрос
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Ошибка загрузки:", error);
    eventsContainer.innerHTML = "Ошибка загрузки.";
    return;
  }

  if (!data || !data.length) {
    eventsContainer.innerHTML = "Событий по вашему запросу не найдено.";
    return;
  }

  eventsContainer.innerHTML = "";
  data.forEach(event => {
    // ... остальная часть кода для рендеринга карточки не изменилась ...
    const rating = event.votes.reduce((sum, v) => sum + v.value, 0);
    const hasVoted = currentUser ? event.votes.some(v => v.user_id === currentUser.id) : false;
    const displayDate = formatDisplayDate(event.event_date);
    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';

    const div = document.createElement("div");
    div.className = "event-card";

    div.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description || "Нет описания."}</p>
      <div class="meta">
        <span class="meta-item">📍 ${event.city || "Весь мир"}</span>
        ${displayDate ? `<span class="meta-item">🗓️ ${displayDate}</span>` : ''}
      </div>
      <div class="author">
        👤 Добавил: ${authorName}
      </div>
      <div class="vote">
        <button onclick="vote(${event.id}, 1)" ${hasVoted ? 'disabled' : ''}>▲</button>
        <span class="score">${rating}</span>
        <button onclick="vote(${event.id}, -1)" ${hasVoted ? 'disabled' : ''}>▼</button>
      </div>
    `;
    eventsContainer.appendChild(div);
  });
};

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEvents();
