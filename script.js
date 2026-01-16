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
let currentUser = null; // Переменная для хранения данных о текущем пользователе

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
    currentUser = session.user; // Сохраняем пользователя
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    userInfo.textContent = `Вы вошли как: ${currentUser.email}`;
  } else {
    currentUser = null; // Очищаем пользователя
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    userInfo.textContent = '';
  }
  loadEvents(); // Перезагружаем события, чтобы обновить кнопки голосования
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
      created_by: currentUser.id // Добавляем ID автора события
    }
  ]);

  if (error) {
    console.error("Ошибка добавления:", error);
    message.textContent = "Произошла ошибка при добавлении.";
    return;
  }

  message.textContent = "✅ Событие успешно добавлено!";
  addEventForm.reset();
  loadEvents();
});

// =================================================================
// ГОЛОСОВАНИЕ (С ПРИВЯЗКОЙ К USER_ID)
// =================================================================
window.vote = async function (eventId, value) {
  if (!currentUser) {
    alert("Пожалуйста, войдите в аккаунт, чтобы проголосовать.");
    return;
  }

  // Вставляем голос вместе с ID пользователя
  const { error } = await supabaseClient.from("votes").insert([
    { event_id: eventId, value: value, user_id: currentUser.id }
  ]);

  if (error) {
    // Ошибка 'duplicate key' означает, что пользователь уже голосовал
    if (error.code === '23505') {
      alert("Вы уже голосовали за это событие.");
    } else {
      console.error("Ошибка голосования:", error);
    }
    return;
  }

  loadEvents();
};

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ
// =================================================================
async function loadEvents() {
  const { data, error } = await supabaseClient
    .from("events")
    .select(`id, title, description, city, event_date, votes(user_id, value)`) // Загружаем user_id голосов
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Ошибка загрузки:", error);
    eventsContainer.innerHTML = "Ошибка загрузки.";
    return;
  }

  if (!data || !data.length) {
    eventsContainer.innerHTML = "Событий пока нет.";
    return;
  }

  eventsContainer.innerHTML = "";
  data.forEach(event => {
    const rating = event.votes.reduce((sum, v) => sum + v.value, 0);
    
    // Проверяем, голосовал ли ТЕКУЩИЙ пользователь
    const hasVoted = currentUser ? event.votes.some(v => v.user_id === currentUser.id) : false;

    const div = document.createElement("div");
    div.className = "event-card";

    div.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description || "Нет описания."}</p>
      <div class="meta">
        <span>${event.city || "Весь мир"}</span>
        <span>${event.event_date || ""}</span>
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
