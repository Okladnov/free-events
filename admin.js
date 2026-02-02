// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE (С ТВОИМ НОВЫМ КЛЮЧОМ)
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D"; // <--- ТВОЙ КЛЮЧ
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const unapprovedContainer = document.getElementById('unapproved-events');
let currentUser = null;

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================
function sanitizeHTML(text) {
    if (!text) return '';
    return DOMPurify.sanitize(text, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'],
    });
}

// =================================================================
// АВТОРИЗАЦИЯ И ПРОВЕРКА РОЛИ
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
        // Используем прямой вызов функции, как самый надежный метод
        const { data: isAdmin, error } = await supabaseClient.rpc('is_admin');

        if (error) {
            console.error('Ошибка при вызове is_admin:', error);
            showAccessDenied('Критическая ошибка при проверке прав.');
            return;
        }

        if (isAdmin === true) {
            userInfo.textContent = `👑 Админ: ${currentUser.email}`;
            loadUnapprovedEvents();
        } else {
            showAccessDenied();
        }

    } else {
        showAccessDenied();
    }
});

function showAccessDenied(message = 'Эта страница доступна только для администраторов сайта.') {
    unapprovedContainer.innerHTML = `<h2>⛔ Доступ запрещен</h2><p>${message}</p>`;
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// =================================================================
async function loadUnapprovedEvents() {
    unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
    const { data: events, error } = await supabaseClient.from('events').select('*').eq('is_approved', false).order('created_at', { ascending: true });
    if (error) {
        console.error('Ошибка загрузки событий:', error);
        unapprovedContainer.innerHTML = `<p style="color: red;">Ошибка: ${error.message}</p>`;
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
        eventCard.innerHTML = `<h4>${sanitizeHTML(event.title)}</h4><p><strong>Описание:</strong> ${sanitizeHTML(event.description) || 'Нет'}</p><p><strong>Город:</strong> ${sanitizeHTML(event.city) || 'Не указан'}</p><p><strong>Дата:</strong> ${event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Не указана'}</p><p><a href="event.html?id=${event.id}" target="_blank">Посмотреть →</a></p><button onclick="approveEvent(${event.id}, this)">Одобрить</button>`;
        unapprovedContainer.appendChild(eventCard);
    });
}

// =================================================================
// Функции, которые пока не используются, но должны быть
// =================================================================
window.approveEvent = async function(eventId, buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Одобряем...';
    const { error } = await supabaseClient.from('events').update({ is_approved: true }).eq('id', eventId);
    if (error) {
        alert('Не удалось одобрить событие.');
        buttonElement.disabled = false;
    } else {
        const card = buttonElement.closest('.admin-event-card');
        if (card) {
            card.style.transition = 'opacity 0.5s ease';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 500);
        }
    }
};

