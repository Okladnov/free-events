// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const unapprovedContainer = document.getElementById('unapproved-events');

// =================================================================
// ТОЧКА ВХОДА
// =================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader();

    if (!isAdmin) {
        document.body.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов. <a href="/">На главную</a></p>';
        return;
    }

    const unapprovedContainer = document.getElementById('unapproved-events');
    loadUnapprovedEvents(unapprovedContainer);
    setupAdminListeners(unapprovedContainer);
});


function setupAdminListeners(container) {
    container.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const eventId = button.dataset.eventId;
        const card = button.closest('.admin-event-card');

        if (action === 'approve') {
            await handleEventAction('approve', eventId, button, card, container);
        }
        if (action === 'delete') {
            if (confirm('Вы уверены, что хотите НАВСЕГДА удалить это событие?')) {
                 await handleEventAction('delete', eventId, button, card, container);
            }
        }
    });
}

async function handleEventAction(action, eventId, button, card, container) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Выполняем...';

    let error;
    if (action === 'approve') {
        const { error: approveError } = await supabaseClient.from('events').update({ is_approved: true }).eq('id', eventId);
        error = approveError;
    } else if (action === 'delete') {
        const { error: deleteError } = await supabaseClient.from('events').delete().eq('id', eventId);
        error = deleteError;
    }

    if (error) {
        alert(`Ошибка: ${error.message}`);
        button.disabled = false;
        button.textContent = originalText;
    } else {
        card.remove();
        if (container.children.length === 0) {
            container.innerHTML = '<p>🎉 Список пуст!</p>';
        }
    }
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
    <div class="admin-actions">
        <button data-action="approve" data-event-id="${event.id}">Одобрить</button>
        <button data-action="delete" data-event-id="${event.id}" class="danger-btn">Удалить</button>
    </div>
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
