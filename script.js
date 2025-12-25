const SUPABASE_URL = "https://mdnhfgwfstsacspfieqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_9Dtu9yqI4dzNNzDzLDuqyw_znguPR9k";

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

const eventsContainer = document.getElementById("events");
const message = document.getElementById("message");

async function loadEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  eventsContainer.innerHTML = "";

  if (error) {
    eventsContainer.textContent = "Ошибка загрузки";
    return;
  }

  if (data.length === 0) {
    eventsContainer.textContent = "Событий пока нет";
    return;
  }

  data.forEach(e => {
    const div = document.createElement("div");
    div.className = "event";
    div.innerHTML = `
      <h3>${e.title}</h3>
      <p>${e.description || ""}</p>
      <small>${e.city || ""} · ${e.event_date || ""}</small>
    `;
    eventsContainer.appendChild(div);
  });
}

document.getElementById("addBtn").onclick = async () => {
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
    return;
  }

  message.textContent = "✅ Событие добавлено";
  loadEvents();
};

loadEvents();
