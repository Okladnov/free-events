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
        // [ THE FIX ] - Убираем .single() и делаем запрос более надежным
        const { data: profiles, error } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id);

        if (error) {
            console.error('Ошибка получения профиля:', error);
            showAccessDenied();
            return;
        }

        // Берем первый профиль из массива, если он есть
        const profile = profiles && profiles.length > 0 ? profiles[0] : null;

        if (profile && profile.role === 'admin') {
            userInfo.textContent = `👑 Админ: ${currentUser.email}`;
            loadUnapprovedEvents();
        } else {
            showAccessDenied();
        }

    } else {
        showAccessDenied();
    }
});

function showAccessDenied() {
    unapprovedContainer.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов сайта.</p><a href="/">Перейти на главную</a>';
}

// =================================================================
// ОСТАЛЬНОЙ КОД (без изменений)
// =================================================================
window.approveEvent = async function(eventId, buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Одобряем...';
    const { error } = await supabaseClient.from('events').update({ is_approved: true }).eq('id', eventId);
    if (error) {
        console.error('Ошибка одобрения:', error);
        alert('Не удалось одобрить событие.');
        buttonElement.disabled = false;
        buttonElement.textContent = 'Одобрить';
    } else {
        const card = buttonElement.closest('.admin-event-card');
        if (card) {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => card.remove(), 500);
        }
    }
};

async function loadUnapprovedEvents() {
    unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
    const { data: events, error } = await supabaseClient.from('events').select('*').eq('is_approved', false).order('created_at', { ascending: true });
    if (error) {
        console.error('Ошибка загрузки неодобренных событий:', error);
        unapprovedContainer.innerHTML = `<p style="color: red;">Не удалось загрузить список. Ошибка: ${error.message}</p>`;
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
        eventCard.innerHTML = `<h4>${sanitizeHTML(event.title)}</h4><p><strong>Описание:</strong> ${sanitizeHTML(event.description) || 'Нет'}</p><p><strong>Город:</strong> ${sanitizeHTML(event.city) || 'Не указан'}</p><p><strong>Дата:</strong> ${event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Не указана'}</p><p><a href="event.html?id=${event.id}" target="_blank">Посмотреть на детальной странице →</a></p><button onclick="approveEvent(${event.id}, this)">Одобрить</button>`;
        unapprovedContainer.appendChild(eventCard);
    });
}
