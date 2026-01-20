// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";

// ИСПРАВЛЕНО: Мы создаем константу с ДРУГИМ именем, чтобы не было конфликта
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
let currentUser = null;

const searchInput = document.getElementById('search-input');
const cityFilter = document.getElementById('city-filter');

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
  currentUser = session ? session.user : null;
  loginBtn.style.display = session ? 'none' : 'block';
  logoutBtn.style.display = session ? 'block' : 'none';
  userInfo.textContent = session ? `Вы вошли как: ${session.user.email}` : '';
  loadEvents();
});

// =================================================================
// ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ
// =================================================================
addEventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) { alert("Пожалуйста, войдите, чтобы добавить событие."); return; }
  message.textContent = "";
  const title = document.getElementById("title").value.trim();
  if (!title) { message.textContent = "Введите название."; return; }
  const { error } = await supabaseClient.from("events").insert([{ title, description: document.getElementById("description").value.trim(), city: document.getElementById("city").value.trim(), event_date: document.getElementById("date").value, created_by: currentUser.id }]);
  if (error) { console.error("Ошибка добавления:", error); message.textContent = "Ошибка."; return; }
  message.textContent = "✅ Отправлено на модерацию!";
  addEventForm.reset();
});

// =================================================================
// ГОЛОСОВАНИЕ
// =================================================================
window.vote = async function (eventId, value) {
  if (!currentUser) { alert("Пожалуйста, войдите, чтобы проголосовать."); return; }
  const { error } = await supabaseClient.from("votes").insert([{ event_id: eventId, value, user_id: currentUser.id }]);
  // Real-time обновит страницу, поэтому здесь больше ничего не делаем
};

// =================================================================
// ДОБАВЛЕНИЕ КОММЕНТАРИЯ
// =================================================================
window.addComment = async function(eventId) {
  if (!currentUser) { alert("Пожалуйста, войдите, чтобы оставить комментарий."); return; }
  const contentInput = document.getElementById(`comment-input-${eventId}`);
  const content = contentInput.value.trim();
  if (!content) { return; }
  const { error } = await supabaseClient.from('comments').insert([{ content, event_id: eventId, user_id: currentUser.id }]);
  if (error) { console.error('Ошибка добавления комментария:', error); }
  else { contentInput.value = ''; }
  // Real-time обновит страницу
};

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================
function formatDisplayDate(dateString) { if (!dateString) return ""; return new Date(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
window.resetFilters = function() { searchInput.value = ''; cityFilter.value = ''; loadEvents(); }

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: ЗАГРУЗКА СОБЫТИЙ
// =================================================================
async function loadEvents() {
  const searchTerm = searchInput.value.trim();
  const city = cityFilter.value.trim();

  let query = supabaseClient.from("events").select(`
    id, title, description, city, event_date, created_by,
    profiles ( full_name ),
    votes ( user_id, value ),
    comments ( id, content, created_at, profiles ( full_name ) )
  `).eq('is_approved', true);

  if (searchTerm) { query = query.ilike('title', `%${searchTerm}%`); }
  if (city) { query = query.ilike('city', `%${city}%`); }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) { console.error("Ошибка загрузки:", error); eventsContainer.innerHTML = "Ошибка загрузки."; return; }
  if (!data || !data.length) { eventsContainer.innerHTML = "Событий по вашему запросу не найдено."; return; }

  eventsContainer.innerHTML = "";
  data.forEach(event => {
    const rating = event.votes.reduce((sum, v) => sum + v.value, 0);
    const hasVoted = currentUser ? event.votes.some(v => v.user_id === currentUser.id) : false;
    const displayDate = formatDisplayDate(event.event_date);
    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';

    let commentsHtml = '<ul class="comments-list">';
    event.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(comment => {
      const commentAuthor = comment.profiles ? comment.profiles.full_name : 'Аноним';
      const commentDate = new Date(comment.created_at).toLocaleString('ru-RU');
      commentsHtml += `<li class="comment"><span class="comment-author">${commentAuthor}</span><span class="comment-date">${commentDate}</span><p>${comment.content}</p></li>`;
    });
    commentsHtml += '</ul>';

    const div = document.createElement("div");
    div.className = "event-card";

    div.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description || "Нет описания."}</p>
      <div class="meta">
        <span class="meta-item">📍 ${event.city || "Весь мир"}</span>
        ${displayDate ? `<span class="meta-item">🗓️ ${displayDate}</span>` : ''}
      </div>
      <div class="author">👤 Добавил: ${authorName}</div>
      <div class="vote">
        <button onclick="vote(${event.id}, 1)" ${hasVoted ? 'disabled' : ''}>▲</button>
        <span class="score">${rating}</span>
        <button onclick="vote(${event.id}, -1)" ${hasVoted ? 'disabled' : ''}>▼</button>
      </div>
      <div class="comments-section">
        <h4>Комментарии</h4>
        ${commentsHtml}
        <form class="comment-form" onsubmit="addComment(${event.id}); return false;">
          <input id="comment-input-${event.id}" placeholder="Написать комментарий..." required>
          <button type="submit">Отправить</button>
        </form>
      </div>
    `;
    eventsContainer.appendChild(div);
  });
};

// =================================================================
// REAL-TIME ПОДПИСКА
// =================================================================
const subscription = supabaseClient.channel('public-schema-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
    console.log('Получено изменение в базе данных, перезагружаю события!', payload);
    loadEvents();
  })
  .subscribe();

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEvents();
