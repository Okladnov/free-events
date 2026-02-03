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
// [УЛУЧШЕНИЕ 1] ДОБАВЛЕНА ФУНКЦИЯ БЕЗОПАСНОСТИ
// =================================================================
function sanitizeHTML(text) {
    if (!text) return '';
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'] });
}

// =================================================================
// ГЛАВНАЯ ЛОГИКА
// =================================================================
logoutBtn.onclick = async function() {
    await supabaseClient.auth.signOut();
    window.location.reload();
};

async function main() {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        showAccessDenied();
        return;
    }
    const currentUser = session.user;
    
    userInfo.textContent = `Пользователь: ${currentUser.email}`;
    logoutBtn.style.display = 'block';

    const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('is_admin');
    if (rpcError || !isAdmin) {
        showAccessDenied();
        return;
    }
    
    userInfo.textContent = `👑 Админ: ${currentUser.email}`;
    loadUnapprovedEvents();
}

function showAccessDenied() {
    unapprovedContainer.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов.</p>';
}

async function loadUnapprovedEvents() {
    unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
    
    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

    if (error) {
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
        
        // [УЛУЧШЕНИЕ 2 и 3] Применяем sanitizeHTML и добавляем ссылку
        eventCard.innerHTML = `
            <h4>${sanitizeHTML(event.title)}</h4>
            <p>${sanitizeHTML(event.description) || 'Нет описания.'}</p>
            <p><a href="event.html?id=${event.id}" target="_blank">Посмотреть на детальной странице →</a></p>
            <button onclick="approveEvent(${event.id}, this)">Одобрить</button>
        `;
        unapprovedContainer.appendChild(eventCard);
    });
}

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

main();
