const SUPABASE_URL = "https://mdnhfgwfstsacspfieqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_9Dtu9yqI4dzNNzDzLDuqyw_znguPR9k";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  const container = document.getElementById("events");
  container.innerHTML = "";

  if (error) {
    container.textContent = "Ошибка загрузки событий";
    console.error(error);
    return;
  }

  if (data.length === 0) {
    container.textContent = "Событий пока нет";
    return;
  }

  data.forEach(event => {
    const div = document.createElement("div");
    div.className = "event";
    div.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description || ""}</p>
      <small>
        ${event.city || "Город не указан"}
        ${event.event_date ? " | " + event.event_date : ""}
      </small>
    `;
    container.appendChild(div);
  });
}

loadEvents();
