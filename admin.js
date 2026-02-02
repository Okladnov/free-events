// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const unapprovedContainer = document.getElementById('unapproved-events');
const userInfo = document.getElementById('user-info');
const logoutBtn = document.getElementById('logoutBtn');

// =================================================================
// ГЛАВНАЯ ЛОГИКА
// =================================================================
// Привязываем выход к кнопке
logoutBtn.onclick = async function() {
    await supabaseClient.auth.signOut();
    window.location.reload();
};

// Главная функция, которая запускается при загрузке страницы
async function main() {
    // 1. Получаем текущего пользователя
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        showAccessDenied();
        return;
    }
    const currentUser = session.user;
    
    userInfo.textContent = `Пользователь: ${currentUser.email}`;
    logoutBtn.style.display = 'block';

    // 2. Проверяем, админ ли он, через ПРЯМОЙ ВЫЗОВ ФУНКЦИИ
    const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('is_admin');
    if (rpcError || !isAdmin) {
        showAccessDenied();
        return;
    }
    
    // 3. Если админ - загружаем события
    userInfo.textContent = `👑 Админ: ${currentUser.email}`;
    loadUnapprovedEvents();
}

// Функция, которая показывает "Доступ запрещен"
function showAccessDenied() {
    unapprovedContainer.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов.</p>';
}

// Функция, которая загружает события
async function loadUnapprovedEvents() {
    unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
    
    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

    if (error) {
        // Эта ошибка - наш ключ. 'AbortError' говорит о таймауте.
        unapprovedContainer.innerHTML = `<p style="color: red;">Ошибка загрузки: ${error.message}. <br>Это может быть из-за "холодного старта" базы данных. <b>Пожалуйста, обновите страницу через 15 секунд.</b></p>`;
        return;
    }
    
    if (!events || events.length === 0) {
        unapprovedContainer.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
        return;
    }
    
    unapprovedContainer.innerHTML = '';
    events.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = 'admin-event-card';
        eventCard.style.cssText = 'border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;';
        eventCard.innerHTML = `<h4>${event.title}</h4><p>${event.description || 'Нет описания.'}</p><button onclick="approveEvent(${event.id}, this)">Одобрить</button>`;
        unapprovedContainer.appendChild(eventCard);
    });
}

// Функция одобрения
window.approveEvent = async function(eventId, buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Одобряем...';
    const { error } = await supabaseClient.from('events').update({ is_approved: true }).eq('id', eventId);
    if (error) {
        alert('Не удалось одобрить событие.');
        buttonElement.disabled = false;
    } else {
        buttonElement.closest('.admin-event-card').remove();
    }
};

// ЗАПУСКАЕМ ВСЮ ЛОГИКУ
main();
