// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XoQ2Gi3bMJI9Bx226mg7GQ_z0S4XPAA";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const unapprovedContainer = document.getElementById('unapproved-events');
let currentUser = null;

// =================================================================
// АВТОРИЗАЦИЯ (ДЛЯ ДИАГНОСТИКИ)
// =================================================================
window.logout = async function() {
    await supabaseClient.auth.signOut();
    window.location.reload();
};

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session ? session.user : null;
    const userInfo = document.getElementById('user-info');
    document.getElementById('logoutBtn').style.display = session ? 'block' : 'none';

    if (currentUser) {
        // Проверяем, админ ли это, чтобы запустить тест
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

        if (profile && profile.role === 'admin') {
            userInfo.textContent = `👑 Диагностика для админа: ${currentUser.email}`;
            // ЗАПУСКАЕМ НАШУ ДИАГНОСТИЧЕСКУЮ ФУНКЦИЮ
            runDiagnostic();
        } else {
            showAccessDenied();
        }
    } else {
        showAccessDenied();
    }
});

function showAccessDenied() {
    unapprovedContainer.innerHTML = '<h2>⛔ Доступ запрещен</h2>';
}

// =================================================================
// ВРЕМЕННАЯ ДИАГНОСТИЧЕСКАЯ ФУНКЦИЯ
// =================================================================
async function runDiagnostic() {
    unapprovedContainer.innerHTML = '<p>Запускаю диагностику...</p>';
    
    console.log('--- НАЧАЛО ДИАГНОСТИКИ ---');
    console.log('Выполняю запрос: supabase.from("events").select("id, title, is_approved")');

    // Делаем самый простой запрос: дай мне id, title и is_approved из ВСЕХ событий
    const { data, error } = await supabaseClient
        .from('events')
        .select('id, title, is_approved');

    if (error) {
        console.error('ДИАГНОСТИКА: Ошибка при запросе!', error);
        unapprovedContainer.innerHTML = `<p style="color: red;">ДИАГНОСТИКА: Ошибка! ${error.message}</p>`;
        console.log('--- КОНЕЦ ДИАГНОСТИКИ С ОШИБКОЙ ---');
        return;
    }

    console.log('ДИАГНОСТИКА: УСПЕХ! Вот что Supabase ответил:');
    // Используем console.table для красивого вывода массива объектов
    console.table(data);

    unapprovedContainer.innerHTML = '<h2>Диагностика завершена.</h2><p>Открой консоль разработчика (F12) и посмотри, что там написано.</p>';
    
    console.log('--- КОНЕЦ ДИАГНОСТИКИ ---');
}
