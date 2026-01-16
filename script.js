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

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    userInfo.textContent = `Вы вошли как: ${session.user.email}`;
  } else {
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    userInfo.textContent = '';
  }
});

// =================================================================
// ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ
// =================================================================
addEventForm.addEventListener('submit', async (event) => {
  event.preventDefault(); // Предотвращаем стандартную отправку формы
  
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
  addEventForm.reset();
  loadEvents();
});

// =================================================================
// ГОЛОСОВАНИЕ (С ЗАЩИТОЙ ОТ НАКРУТКИ)
// =================================================================
window.vote = async function (eventId, value) {
  const votedEvents = JSON.parse(localStorage.getItem('voted_events')) || [];
  if (votedEvents.includes(eventId)) {
    return; 
  }

  const { error } = await supabaseClient.from("votes").insert([{ event_id: eventId, value }]);
  if (error) {
    console.error("Ошибка голосования:", error);
    return;
  }

  votedEvents.push(eventId);
  localStorage.setItem('voted_events', JSON.stringify(votedEvents));
  loadEvents();
};


// =================================================================
// ЗАГРУЗКА СОБЫТИЙ
// =================================================================
async function loadEvents() {
  const votedEvents = JSON.parse(localStorage.getItem('voted_events')) || [];
  const { data, error } = await supabaseClient
    .from("events")
    .select(`id, title, description, city, event_date, votes(value)`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Ошибка загрузки:", error);
    eventsContainer.innerHTML = "Ошибка загрузки.";
    return;
  }

  if (!data || data.length === 0) {
    eventsContainer.innerHTML = "Событий пока нет.";
    return;
  }

  eventsContainer.innerHTML = "";
  data.forEach(event => {
    const rating = event.votes ? event.votes.reduce((sum, v) => sum + v.value, 0) : 0;
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
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEvents();
