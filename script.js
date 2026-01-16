// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const eventsContainer = document.getElementById("events");
const message = document.getElementById("message");


// =================================================================
// ЗАГРУЗКА СОБЫТИЙ
// =================================================================
window.loadEvents = async function () {
  // Получаем ID событий, за которые пользователь уже голосовал
  const votedEvents = JSON.parse(localStorage.getItem('voted_events')) || [];

  const { data, error } = await supabaseClient
    .from("events")
    .select(`id, title, description, city, event_date, votes(value)`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Ошибка загрузки:", error);
    eventsContainer.textContent = "Ошибка загрузки.";
    return;
  }

  if (!data || data.length === 0) {
    eventsContainer.textContent = "Событий пока нет.";
    return;
  }

  eventsContainer.innerHTML = "";
  data.forEach(event => {
    const rating = event.votes ? event.votes.reduce((sum, v) => sum + v.value, 0) : 0;
    // Проверяем, голосовал ли пользователь за это событие
    const hasVoted = votedEvents.includes(event.id);

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


// =================================================================
// ДОБАВЛЕНИЕ СОБЫТИЯ
// =================================================================
window.addEvent = async function () {
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
      event_date: document.getElementById("date").value 
    }
  ]);

  if (error) {
    console.error("Ошибка добавления:", error);
    message.textContent = "Ошибка. Проверьте RLS-политику для INSERT.";
    return;
  }

  message.textContent = "✅ Событие успешно добавлено!";
  document.getElementById("add-event-form").reset();
  loadEvents();
};


// =================================================================
// ГОЛОСОВАНИЕ (С ЗАЩИТОЙ ОТ НАКРУТКИ)
// =================================================================
window.vote = async function (eventId, value) {
  // 1. Получаем ID событий, за которые уже голосовали
  const votedEvents = JSON.parse(localStorage.getItem('voted_events')) || [];

  // 2. Проверяем, есть ли текущее событие в списке
  if (votedEvents.includes(eventId)) {
    alert("Вы уже голосовали за это событие!");
    return; // Останавливаем выполнение
  }

  // 3. Если не голосовал, отправляем голос в Supabase
  const { error } = await supabaseClient.from("votes").insert([
    { event_id: eventId, value }
  ]);

  if (error) {
    console.error("Ошибка голосования:", error);
    alert("Произошла ошибка при голосовании.");
    return;
  }

  // 4. Запоминаем, что пользователь проголосовал
  votedEvents.push(eventId);
  localStorage.setItem('voted_events', JSON.stringify(votedEvents));

  // 5. Обновляем список событий, чтобы показать новый рейтинг
  loadEvents();
};


// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEvents();
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

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() {
  await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
};

window.logout = async function() {
  await supabaseClient.auth.signOut();
};

// Эта функция следит за состоянием пользователя (вошел, вышел) и обновляет интерфейс
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    // Пользователь вошел
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    userInfo.textContent = `Вы вошли как: ${session.user.email}`;
  } else {
    // Пользователь вышел
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    userInfo.textContent = '';
  }
});

// ... (остальной код остается таким же) ...

// =================================================================
// ЗАГРУЗКА СОБЫТИЙ
// =================================================================
window.loadEvents = async function () { /* ... код без изменений ... */ };
addEventForm.addEventListener('submit', async (e) => { e.preventDefault(); await window.addEvent(); });
window.addEvent = async function () { /* ... код без изменений ... */ };
window.vote = async function (eventId, value) { /* ... код без изменений ... */ };
loadEvents();
