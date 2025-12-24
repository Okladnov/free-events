const SUPABASE_URL = "https://mdnhfgwfstsacspfieqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_9Dtu9yqI4dzNNzDzLDuqyw_znguPR9k";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ===== ЗАГРУЗКА СОБЫТИЙ =====
async function loadEvents() {
  const { data, error } = await supabaseClient
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

  if (!data || data.length === 0) {
    container.textContent = "Событий пока нет";
    return;
  }

  data.forEach((event) => {
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

// ===== ДОБАВЛЕНИЕ СОБЫТИЯ =====
const form = document.getElementById("add-event-form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const city = document.getElementById("city").value;
  const event_date = document.getElementById("event_date").value;
  const description = document.getElementById("description").value;

  const { error } = await supabaseClient.from("events").insert([
    {
      title,
      city,
      event_date,
      description,
    },
  ]);

  if (error) {
    alert("Ошибка при добавлении события");
    console.error(error);
    return;
  }

  form.reset();
  loadEvents();
});

// ===== СТАРТ =====
loadEvents();
