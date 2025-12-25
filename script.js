const SUPABASE_URL = "https://mdnhfgwfstsacspfieqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_9Dtu9yqI4dzNNzDzLDuqyw_znguPR9k";

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

const eventsContainer = document.getElementById("events");
const message = document.getElementById("message");

async function loadEvents() {
  const { data, error } = await supabase
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

  eventsContainer.innerHTML = "";

  if (error) {
    eventsContainer.textContent = "Ошибка загрузки";
    console.error(error);
    return;
  }

  if (data.length === 0) {
    eventsContainer.textContent = "Событий пока нет";
    return;
  }

  data.forEach(e => {
    const rating = e.votes
      ? e.votes.reduce((s, v) => s + v.value, 0)
      : 0;

    const div = document.createElement("div");
    div.className = "event";

    div.innerHTML = `
      <h3>${e.title}</h3>
      <p>${e.description || ""}</p>
      <small>${e.city || ""} · ${e.event_date || ""}</small>

      <div class="vote">
        <button onclick="vote(${e.id}, 1)">▲</button>
        <span class="score">${rating}</span>
        <button onclick="vote(${e.id}, -1)">▼</button>
      </div>
    `;

    eventsContainer.appendChild(div);
  });
}

async function addEvent() {
  message.textContent = "";

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const city = document.getElementById("city").value.trim();
  const date = document.getElementById("date").value;

  if (!title) {
    message.textContent = "Введите название";
    return;
  }

  const { error } = await supabase.from("events").insert([{
    title,
    description,
    city,
    event_date: date
  }]);

  if (error) {
    message.textContent = "Ошибка при добавлении";
    console.error(error);
    return;
  }

  message.textContent = "✅ Событие добавлено";
  loadEvents();
}

async function vote(eventId, value) {
  const { error } = await supabase
    .from("votes")
    .insert([{ event_id: eventId, value }]);

  if (error) {
    alert("Ошибка голосования");
    console.error(error);
    return;
  }

  loadEvents();
}

loadEvents();
