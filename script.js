// 🔹 Подключение Supabase (ОДИН раз)
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";

const supabase = window.supabaseJs.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// 🔹 Элементы DOM
const eventsContainer = document.getElementById("events");
const message = document.getElementById("message");

// 🔹 Загрузка событий
window.loadEvents = async function () {
  eventsContainer.textContent = "Загрузка событий...";

  const { data, error } = await supabase
    .from("events")
    .select(`
      id,
      title,
      description,
      city,
      event_date,
      votes(value)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    eventsContainer.textContent = "Ошибка загрузки событий";
    return;
  }

  if (!data || data.length === 0) {
    eventsContainer.textContent = "Событий пока нет";
    return;
  }

  eventsContainer.innerHTML = "";

  data.forEach(event => {
    const rating = event.votes
      ? event.votes.reduce((sum, v) => sum + v.value, 0)
      : 0;

    const div = document.createElement("div");
    div.className = "event";

    div.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description || ""}</p>
      <small>${event.city || ""} · ${event.event_date || ""}</small>

      <div class="vote">
        <button onclick="vote(${event.id}, 1)">▲</button>
        <span class="score">${rating}</span>
        <button onclick="vote(${event.id}, -1)">▼</button>
      </div>
    `;

    eventsContainer.appendChild(div);
  });
};

// 🔹 Добавление события
window.addEvent = async function () {
  message.textContent = "";

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const city = document.getElementById("city").value.trim();
  const date = document.getElementById("date").value;

  if (!title) {
    message.textContent = "Введите название события";
    return;
  }

  const { error } = await supabase.from("events").insert([
    {
      title,
      description,
      city,
      event_date: date
    }
  ]);

  if (error) {
    console.error(error);
    message.textContent = "Ошибка при добавлении события";
    return;
  }

  message.textContent = "✅ Событие добавлено";

  // очистка формы
  document.getElementById("title").value = "";
  document.getElementById("description").value = "";
  document.getElementById("city").value = "";
  document.getElementById("date").value = "";

  loadEvents();
};

// 🔹 Голосование
window.vote = async function (eventId, value) {
  const { error } = await supabase.from("votes").insert([
    { event_id: eventId, value }
  ]);

  if (error) {
    console.error(error);
    alert("Ошибка при голосовании");
    return;
  }

  loadEvents();
};

// 🔹 Старт
loadEvents();
