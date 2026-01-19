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

// Элементы для фильтров
const searchInput = document.getElementById('search-input');
const cityFilter = document.getElementById('city-filter');

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() {
  await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
};

window.logout = async function() {
  await supabaseClient.auth.signOut();
};

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = session.user;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    userInfo.textContent = `Вы вошли как: ${currentUser.email}`;
  } else {
    currentUser = null;
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    userInfo.textContent = '';
  }
  loadEvents();
});

// =================================================================
// ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ
// =================================================================
addEventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  if (!currentUser) {
    alert("Пожалуйста, войдите в аккаунт, чтобы добавить событие.");
    return;
  }
  
  message.textContent = "";
  const title = document.getElementById("title").value.trim();
  if (!title) {
    message.textContent = "Введите название события.";
    return;
  }

  const { error } = await supabaseClient.from("events").insert([
    { 
      title: title, 
      description: document.getElementById("description").value.trim(), 
      city: document.getElementById("city").value.trim(), 
      event_date: document.getElementById("date").value,
      created_by: currentUser.id
    }
  ]);

  if (error) {
    console.error("Ошибка добавления:", error);
    message.textContent = "Произошла ошибка при добавлении.";
    return;
  }

  message.textContent = "✅ Отлично! Ваше событие отправлено на модерацию.";
  addEventForm.reset();
});

// =================================================================
// ГОЛОСОВАНИЕ
// =================================================================
window.vote = async function (eventId, value) {
  if (!currentUser) {
    alert("Пожалуйста, войдите в аккаунт, чтобы проголосовать.");
    return;
  }

  const { error } = await supabaseClient.from("votes").insert([
    { event_id: eventId, value: value, user_id: currentUser.id }
  ]);

  if (error && error.code === '23505') {
    // Пользователь уже голосовал
  } else if (error) {
    console.error("Ошибка голосования:", error);
  } else {
    loadEvents();
  }
};

// =================================================================
// ФУНКЦИЯ ДЛЯ КРАСИВОЙ ДАТЫ
// =================================================================
function formatDisplayDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

// =================================================================
// НОВАЯ ФУНКЦИЯ ДЛЯ СБРОСА ФИЛЬТРОВ
// =================================================================
window.resetFilters = function() {
  searchInput.value = '';
  cityFilter.value = '';
  loadEvents();
}

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ (с поиском и фильтрами)
// =================================================================
window.loadEvents = async function() {
  const searchTerm = searchInput.value.trim();
  const city = cityFilter.value.trim();

  let query = supabaseClient
    .from("events")
    .select(`
      id, title, description, city, event_date, created_by,
      profiles ( full_name ),
      votes ( user_id, value )
    `)
    .eq('is_approved', true);

  if (searchTerm) {
    query = query.ilike('title', `%${searchTerm}%`);
  }
  if (city) {
    query = query.ilike('city', `%${city}%`);
  }

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
