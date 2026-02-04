document.addEventListener('DOMContentLoaded', async () => {
    // Инициализируем шапку и проверяем пользователя
    await initializeHeader();

    // Если гость - отправляем на логин
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    // Загружаем категории в выпадающий список
    await loadCategories();

    // Проверяем, это создание или редактирование
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (eventId) {
        // Режим редактирования
        document.getElementById('form-title').textContent = 'Редактирование события';
        await loadEventDataForEdit(eventId);
    }

    // Вешаем обработчик на форму
    document.getElementById('event-form').addEventListener('submit', (e) => handleFormSubmit(e, eventId));
});

// Загрузка категорий в <select>
async function loadCategories() {
    const categorySelect = document.getElementById('event-category');
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) {
        console.error("Ошибка загрузки категорий:", error);
        return;
    }
    categorySelect.innerHTML = data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
}

// Загрузка данных для существующего события
async function loadEventDataForEdit(eventId) {
    const { data: event, error } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    if (error || !event) {
        alert("Событие не найдено или у вас нет прав на его редактирование.");
        window.location.href = '/';
        return;
    }
    
    // Проверяем, является ли текущий юзер автором
    if (event.user_id !== currentUser.id && !isAdmin) {
         alert("У вас нет прав на редактирование этого события.");
         window.location.href = '/';
         return;
    }

    // Заполняем форму
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-description').value = event.description || '';
    document.getElementById('event-image-url').value = event.image_url || '';
    document.getElementById('event-category').value = event.category_id;
    document.getElementById('event-date').value = event.event_date;
    document.getElementById('event-city').value = event.city || '';
    document.getElementById('event-link').value = event.link || ''; // ЗАПОЛНЯЕМ НОВОЕ ПОЛЕ
}

// Обработчик отправки формы
async function handleFormSubmit(e, eventId) {
    e.preventDefault();
    const formMessage = document.getElementById('form-message');
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    formMessage.textContent = 'Сохраняем...';
    formMessage.style.color = 'var(--text-color)';

    try {
        const eventData = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            image_url: document.getElementById('event-image-url').value,
            category_id: document.getElementById('event-category').value,
            event_date: document.getElementById('event-date').value || null,
            city: document.getElementById('event-city').value,
            link: document.getElementById('event-link').value, // ПОЛУЧАЕМ НОВОЕ ПОЛЕ
            user_id: currentUser.id,
        };
        
        let result;
        if (eventId) {
            // Обновляем существующее
            result = await supabaseClient.from('events').update(eventData).eq('id', eventId).select().single();
        } else {
            // Создаем новое
            result = await supabaseClient.from('events').insert(eventData).select().single();
        }

        const { data, error } = result;

        if (error) throw error;
        
        formMessage.textContent = '✅ Успешно сохранено! Перенаправляем...';
        formMessage.style.color = '#2ecc71';
        
        // Перенаправляем на страницу созданного/обновленного события
        setTimeout(() => { window.location.href = `/event.html?id=${data.id}`; }, 1500);

    } catch (error) {
        formMessage.textContent = `Ошибка: ${error.message}`;
        formMessage.style.color = '#e74c3c';
        submitButton.disabled = false;
    }
}
