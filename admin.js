// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
console.log('[1] Скрипт admin.js запущен.');

const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('[2] Клиент Supabase создан.');

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const unapprovedContainer = document.getElementById('unapproved-events');
let currentUser = null;

console.log('[3] Переменные объявлены.');

// =================================================================
// АВТОРИЗАЦИЯ И ПРОВЕРКА РОЛИ
// =================================================================
window.logout = async function() {
    console.log('Выполняется logout...');
    await supabaseClient.auth.signOut();
    window.location.reload();
};

console.log('[4] Устанавливаю обработчик onAuthStateChange...');

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('[5] onAuthStateChange сработал! Событие:', event);
    
    currentUser = session ? session.user : null;
    const userInfo = document.getElementById('user-info');
    document.getElementById('logoutBtn').style.display = session ? 'block' : 'none';

    if (currentUser) {
        console.log('[6] Пользователь найден:', currentUser.email);
        console.log('[7] Запрашиваю профиль пользователя...');

        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

        if (error || !profile) {
            console.error('[!!! ОШИБКА !!!] Не удалось получить профиль!', error);
            showAccessDenied();
            return;
        }

        console.log('[8] Профиль получен. Роль:', profile.role);

        if (profile.role === 'admin') {
            console.log('[9] Роль "admin". Запускаю loadUnapprovedEvents...');
            userInfo.textContent = `👑 Админ: ${currentUser.email}`;
            loadUnapprovedEvents();
        } else {
            console.log('[9] Роль НЕ "admin". Доступ запрещен.');
            userInfo.textContent = `Пользователь: ${currentUser.email}`;
            showAccessDenied();
        }

    } else {
        console.log('[6] Пользователь НЕ найден. Доступ запрещен.');
        userInfo.textContent = 'Вход не выполнен';
        showAccessDenied();
    }
});

function showAccessDenied() {
    console.log('Вызвана функция showAccessDenied.');
    unapprovedContainer.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов сайта.</p><a href="/">Перейти на главную</a>';
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ (пока без изменений)
// =================================================================
async function loadUnapprovedEvents() {
    console.log('[10] Функция loadUnapprovedEvents запущена.');
    unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';

    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[!!! ОШИБКА !!!] Не удалось загрузить события!', error);
        unapprovedContainer.innerHTML = `<p style="color: red;">Ошибка: ${error.message}</p>`;
        return;
    }
    
    console.log('[11] События получены:', events);

    if (!events || events.length === 0) {
        console.log('[12] Событий для модерации нет.');
        unapprovedContainer.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
        return;
    }

    // ... остальной код без изменений, до него пока не дойдет
    console.log(`[12] Найдено ${events.length} событий. Отрисовываю...`);
    unapprovedContainer.innerHTML = '';
    // ...
}
