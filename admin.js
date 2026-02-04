// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const unapprovedContainer = document.getElementById('unapproved-events');

// =================================================================
// ТОЧКА ВХОДА
// =================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Инициализируем шапку, проверяем пользователя и его права (из app.js)
    await initializeHeader();

    // 2. `isAdmin` - это глобальная переменная из app.js.
    //    Если false, блокируем доступ, если пользователь ввел URL вручную.
    if (!isAdmin) {
        showAccessDenied();
        return;
    }

    // 3. Если мы здесь, значит пользователь - админ. Загружаем события.
    loadUnapprovedEvents();
});

// =================================================================
// СПЕЦИФИЧНАЯ ЛОГИКА АДМИНКИ
// =================================================================

function showAccessDenied() {
    unapprovedContainer.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов. <a href="/">На главную</a></p>';
}

async function loadUnapprovedEvents() {
    unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
    
    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

    if (error) {
        unapprovedContainer.innerHTML = `<p style="color: red;">Ошибка загрузки: ${error.message}.</p>`;
        return;
    }
    
    if (!events || events.length === 0) {
        unapprovedContainer.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
        return;
    }
    
    unapprovedContainer.innerHTML = '';
    events.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = 'admin-event-card'; // Можешь добавить стили для этого класса в style.css
        
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
    
    const { error } = await supabaseClient
        .from('events')
        .update({ is_approved: true })
        .eq('id', eventId);
        
    if (error) {
        alert('Не удалось одобрить событие.');
        buttonElement.disabled = false;
        buttonElement.textContent = 'Одобрить';
    } else {
        buttonElement.closest('.admin-event-card').remove();
        if (unapprovedContainer.children.length === 0) {
            unapprovedContainer.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
        }
    }
};
