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
let currentUser = null;

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); };
window.logout = async function() { await supabaseClient.auth.signOut(); };

supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;

  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('user-info');
  const favoritesLink = document.getElementById('favorites-link');

  loginBtn.style.display = session ? 'none' : 'block';
  logoutBtn.style.display = session ? 'block' : 'none';
  userInfo.textContent = session ? `Вы вошли как: ${session.user.email}` : '';
  favoritesLink.style.display = session ? 'inline' : 'none';

  // Загружаем избранное только если пользователь вошел в систему
  if (currentUser) {
    loadFavoriteEvents();
  } else {
    // Прячем старые события, если пользователь вышел, и показываем сообщение
    const eventsContainer = document.getElementById("events");
    eventsContainer.innerHTML = '<p>Пожалуйста, <a href="#" onclick="loginWithGoogle(); return false;">войдите в свой аккаунт</a>, чтобы увидеть избранные события.</p>';
  }
});


// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: ЗАГРУЗКА ИЗБРАННЫХ СОБЫТИЙ
// =================================================================
async function loadFavoriteEvents() {
    eventsContainer.innerHTML = 'Загрузка ваших избранных событий...';

    // 1. Сначала получаем ID всех "лайкнутых" событий
    const { data: favoriteIds, error: idsError } = await supabaseClient
        .from('favorites')
        .select('event_id')
        .eq('user_id', currentUser.id);

    if (idsError) {
        console.error('Ошибка получения ID избранных:', idsError);
        eventsContainer.innerHTML = '<p>Не удалось загрузить избранные события.</p>';
        return;
    }

    if (!favoriteIds || favoriteIds.length === 0) {
        eventsContainer.innerHTML = '<p>Вы пока не добавили ни одного события в избранное. Пора это исправить! <a href="/">Перейти на главную</a></p>';
        return;
    }

    // "Вытаскиваем" только сами ID в чистый массив: [12, 42, 55]
    const ids = favoriteIds.map(item => item.event_id);

    // 2. Теперь загружаем события, ID которых есть в нашем массиве
    const { data: events, error: eventsError } = await supabaseClient
        .from('events')
        .select(`
            id, title, description, city, event_date, created_by, image_url, rating,
            profiles ( full_name ),
            favorites ( user_id ),
            categories ( id, name )
        `)
        .in('id', ids) // .in() - это команда "где id находится в этом массиве"
        .order('created_at', { ascending: false });

    if (eventsError) {
        console.error('Ошибка загрузки событий:', eventsError);
        eventsContainer.innerHTML = '<p>Не удалось загрузить избранные события.</p>';
        return;
    }

    eventsContainer.innerHTML = ""; // Очищаем контейнер

    // 3. Используем ТОТ ЖЕ КОД ОТРИСОВКИ, что и на главной (но без лишних функций)
    events.forEach(event => {
        let dateHtml = '';
        if (event.event_date) { const d = new Date(event.event_date); const day = d.getDate(); const month = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', ''); dateHtml = `<div class="event-card-date"><span class="day">${day}</span><span class="month">${month}</span></div>`; }
        
        let categoriesHtml = '';
        if (event.categories && event.categories.length > 0) {
            categoriesHtml = '<div class="card-categories">';
            event.categories.forEach(cat => {
                categoriesHtml += `<span class="tag" onclick="window.location.href='/?category=${cat.id}'">${cat.name}</span>`;
            });
            categoriesHtml += '</div>';
        }

        const isFavorited = true; // Все события на этой странице - избранные
        const favoriteIcon = '❤️';
        const favoriteClass = 'active';

        const div = document.createElement("div");
        div.onclick = () => { window.location.href = `event.html?id=${event.id}`; };
        div.className = "event-card";
        div.innerHTML = `
          <div class="event-card-image-container">
            <img src="${event.image_url || 'https://placehold.co/600x337/f0f2f5/ff6a00?text=Нет+фото'}" alt="${event.title}" class="event-card-image">
            ${dateHtml}
            <button class="card-save-btn ${favoriteClass}" onclick="event.stopPropagation(); alert('Удаление из избранного будет здесь!')">${favoriteIcon}</button>
          </div>
          <div class="card-content">
            <h3>${event.title}</h3>
            ${categoriesHtml}
            <p>${event.description || 'Нет описания.'}</p>
            <div class="meta">
                <div class="meta-item">
                    <span>📍</span>
                    <span>${event.city || 'Онлайн'}</span>
                </div>
                <div class="meta-item">
                    <span>👤</span>
                    <span>Добавил: ${event.profiles ? event.profiles.full_name : 'Аноним'}</span>
                </div>
            </div>
          </div>`;
        eventsContainer.appendChild(div);
    });
}
