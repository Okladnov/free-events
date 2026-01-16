// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE (ПРАВИЛЬНЫЕ КЛЮЧИ)
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";

// Важно: создаем клиент из глобального объекта supabase, который дает CDN-скрипт
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
  eventsContainer.textContent = "Загрузка событий...";

  const { data, error } = await supabaseClient
    .from("events")
    .select(`
      id,
      title,
      description,
      city,
      event_date,
      votes ( value )
    `)
    .order("created_at", { ascending: false });

  // Если ошибка
  if (error) {
    console.error("Ошибка загрузки:", error);
    eventsContainer.textContent = "Ошибка загрузки. Проверьте RLS-политики в Supabase.";
    return;
  }

  // Если данных нет
  if (!data || data.length === 0) {
    eventsContainer.textContent = "Событий пока нет. Добавьте первое!";
    return;
  }

  // Очищаем контейнер и рендерим события
  eventsContainer.innerHTML = "";

  data.forEach(event => {
    const rating = event.votes
      ? event.votes.reduce((sum, v) => sum + v.value, 0)
      : 0;

    const div = document.createElement("div");
    div.className = "event-card"; // Используем новый класс для стилей

    div.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description || "Нет описания."}</p>
      <div class="meta">
        <span>${event.city || "Весь мир"}</span>
        <span>${event.event_date || ""}</span>
      </div>
      <div class="vote">
        <button onclick="vote(${event.id}, 1)">▲</button>
        <span class="score">${rating}</span>
        <button onclick="vote(${event.id}, -1)">▼</button>
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
  const description = document.getElementById("description").value.trim();
  const city = document.getElementById("city").value.trim();
  const date = document.getElementById("date").value;

  if (!title) {
    message.textContent = "Введите название события.";
    return;
  }

  const { error } = await supabaseClient.from("events").insert([
    { title, description, city, event_date: date }
  ]);

  if (error) {
    console.error("Ошибка добавления:", error);
    message.textContent = "Ошибка. Проверьте RLS-политику для INSERT.";
    return;
  }

  message.textContent = "✅ Событие успешно добавлено!";

  // Очистка формы
  document.getElementById("add-event-form").reset();

  // Обновляем список
  loadEvents();
};


// =================================================================
// ГОЛОСОВАНИЕ
// =================================================================
window.vote = async function (eventId, value) {
  const { error } = await supabaseClient.from("votes").insert([
    { event_id: eventId, value }
  ]);

  if (error) {
    console.error("Ошибка голосования:", error);
    alert("Ошибка. Возможно, вы уже голосовали или проверьте RLS для 'votes'.");
    return;
  }

  // Обновляем список, чтобы показать новый рейтинг
  loadEvents();
};


// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEvents();
