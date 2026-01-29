// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// =================================================================
const eventDetailContainer = document.getElementById('event-detail-container');
let currentUser = null;

// =================================================================
// ЛОГИКА АВТОРИЗАЦИИ (такая же, как на главной)
// =================================================================
window.loginWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); };
window.logout = async function() { await supabaseClient.auth.signOut(); };

supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('user-info');
    loginBtn.style.display = session ? 'none' : 'block';
    logoutBtn.style.display = session ? 'block' : 'none';
    userInfo.textContent = session ? `Вы вошли как: ${session.user.email}` : '';
});


// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: ЗАГРУЗКА ДЕТАЛЕЙ СОБЫТИЯ
// =================================================================
async function loadEventDetails() {
    // 1. "Вытаскиваем" ID из URL
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Ошибка: ID события не найден в URL.</p>`;
        return;
    }

    // 2. Делаем запрос к Supabase, чтобы получить ОДНО событие
    const { data: event, error } = await supabaseClient
        .from('events')
        .select(`
            id, title, description, city, event_date, created_by, image_url, rating,
            profiles ( full_name ),
            categories ( id, name )
        `)
        .eq('id', eventId)
        .single(); // .single() говорит, что мы ожидаем только одну запись

    if (error || !event) {
        console.error('Ошибка загрузки события:', error);
        document.title = "Событие не найдено";
        eventDetailContainer.innerHTML = `<p style="color: red; text-align: center;">Событие не найдено или произошла ошибка.</p>`;
        return;
    }

    // 3. Генерируем HTML и "рисуем" страницу
    document.title = event.title; // Меняем заголовок вкладки

    let dateString = 'Дата не указана';
    if (event.event_date) {
        dateString = new Date(event.event_date).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    
    let categoriesHtml = '';
    if (event.categories && event.categories.length > 0) {
        event.categories.forEach(cat => {
            // Ссылка ведет на главную страницу с уже примененным фильтром
            categoriesHtml += `<a href="/?category=${cat.id}" class="tag">${cat.name}</a>`;
        });
    }

    const authorName = event.profiles ? event.profiles.full_name : 'Аноним';

    const eventHtml = `
        <div class="event-detail-header">
            <img src="${event.image_url || 'https://placehold.co/1200x600/f0f2f5/ff6a00?text=Нет+фото'}" alt="${event.title}" class="event-detail-image">
            <div class="event-detail-title-card">
                <div class="event-detail-tags">${categoriesHtml}</div>
                <h1>${event.title}</h1>
                <p>Добавил: ${authorName}</p>
            </div>
        </div>
        
        <div class="event-detail-body">
            <div class="event-detail-info">
                <h2>Детали события</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>📍 Город:</strong>
                        <span>${event.city || 'Онлайн'}</span>
                    </div>
                    <div class="info-item">
                        <strong>🗓️ Дата:</strong>
                        <span>${dateString}</span>
                    </div>
                </div>
                <h2>Описание</h2>
                <p>${event.description || 'Описание отсутствует.'}</p>
            </div>
            <div class="event-detail-sidebar">
                <!-- Здесь в будущем будет карта -->
                <h3>Место на карте</h3>
                <div id="map-placeholder" style="width: 100%; height: 250px; background-color: #f0f2f5; border-radius: 8px; display:flex; align-items:center; justify-content:center; text-align:center; color:#888;">
                    Интерактивная карта появится здесь
                </div>
            </div>
        </div>
    `;
    
    eventDetailContainer.innerHTML = eventHtml;
}

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
loadEventDetails();

