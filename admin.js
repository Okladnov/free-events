// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ АДМИНКИ - admin.html (admin.js)
// =================================================================
// Важно: supabaseClient и currentUser уже созданы в script.js.

// --- 1. Функция-инициализатор для этой страницы ---
function initializeAdminPage() {
    const unapprovedContainer = document.getElementById('unapproved-events');

    // Проверяем, на той ли мы странице. Если блока для событий нет - выходим.
    if (!unapprovedContainer) {
        return;
    }

    // Проверяем права доступа. currentUser - это глобальная переменная из script.js
    if (currentUser && currentUser.user_metadata.role === 'admin') {
        // Если пользователь админ, загружаем события для модерации
        loadUnapprovedEvents();
    } else {
        // Если нет, показываем сообщение "Доступ запрещен"
        showAccessDenied();
    }
}


// --- 2. Функции, специфичные для админки ---

// Показывает сообщение об ошибке доступа
function showAccessDenied() {
    const unapprovedContainer = document.getElementById('unapproved-events');
    if (unapprovedContainer) {
      unapprovedContainer.innerHTML = `
        <div class="card access-denied">
            <h2>⛔ Доступ запрещен</h2>
            <p>Эта страница доступна только для администраторов.</p>
            <a href="/" class="submit-btn secondary">На главную</a>
        </div>`;
    }
}

// Загружает неодобренные события
async function loadUnapprovedEvents() {
    const unapprovedContainer = document.getElementById('unapproved-events');
    unapprovedContainer.innerHTML = '<p class="loading-message">Загрузка списка событий для модерации...</p>';

    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

    if (error) {
        unapprovedContainer.innerHTML = `<p class="error-message">Ошибка загрузки: ${error.message}.</p>`;
        return;
    }

    if (!events || events.length === 0) {
        unapprovedContainer.innerHTML = '<p class="info-message">🎉 Все события одобрены! Новых на модерацию нет.</p>';
        return;
    }

    unapprovedContainer.innerHTML = '';
    events.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = 'admin-event-card'; // Добавь стили для этого класса

        // Используем глобальную функцию sanitizeHTML из script.js
        eventCard.innerHTML = `
            <h4>${sanitizeHTML(event.title)}</h4>
            <p>${sanitizeHTML(event.description) || 'Нет описания.'}</p>
            <div class="admin-card-footer">
                <a href="event.html?id=${event.id}" target="_blank">Посмотреть на странице</a>
                <button class="submit-btn primary" onclick="approveEvent(${event.id}, this)">Одобрить</button>
                <button class="submit-btn danger" onclick="rejectEvent(${event.id}, this)">Отклонить</button>
            </div>
        `;
        unapprovedContainer.appendChild(eventCard);
    });
}

// Одобряет событие (делаем ее глобальной, чтобы работала в onclick)
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
        // Удаляем карточку со страницы
        buttonElement.closest('.admin-event-card').remove();
        if (document.getElementById('unapproved-events').children.length === 0) {
            document.getElementById('unapproved-events').innerHTML = '<p class="info-message">🎉 Все события одобрены!</p>';
        }
    }
};

// Отклоняет (удаляет) событие
window.rejectEvent = async function(eventId, buttonElement) {
    if (!confirm('Вы уверены, что хотите безвозвратно удалить это событие?')) {
        return;
    }
    buttonElement.disabled = true;
    buttonElement.textContent = 'Удаляем...';

    const { error } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', eventId);
    
    if (error) {
        alert('Не удалось удалить событое.');
        buttonElement.disabled = false;
        buttonElement.textContent = 'Отклонить';
    } else {
        buttonElement.closest('.admin-event-card').remove();
        if (document.getElementById('unapproved-events').children.length === 0) {
            document.getElementById('unapproved-events').innerHTML = '<p class="info-message">🎉 Все события промодерированы!</p>';
        }
    }
}


// --- 3. Точка входа: запускаем инициализацию ---
document.addEventListener('DOMContentLoaded', initializeAdminPage);
