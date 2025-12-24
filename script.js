const SUPABASE_URL = "https://mdnhfgwfstsacspfieqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_9Dtu9yqI4dzNNzDzLDuqyw_znguPR9k";

// ✅ ПРАВИЛЬНО ДЛЯ CDN
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

async function loadEvents() {
  const container = document.getElementById("events");

  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    container.textContent = "Ошибка загрузки событий";
    return;
  }

  if (!data || data.length === 0) {
    container.textContent = "Событий пока нет";
    return;
  }

  container.innerHTML = "";

  data.forEach(event => {
    const div = document.createElement("div");
    div.className = "event";

    div.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description ?? ""}</p>
      <small>
        ${event.city ?? "Город не указан"}
        ${event.event_date ? " | " + event.event_date : ""}
      </small>
    `;

    container.appendChild(div);
  });
}

loadEvents();
