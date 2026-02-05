document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader();

    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    // 1. ИНИЦИАЛИЗИРУЕМ КАСТОМНЫЙ РЕДАКТОР
const editor = pell.init({
    element: document.getElementById('editor-container'),
    onChange: html => {},
    defaultParagraphSeparator: 'p',
    actions: [
        {
            name: 'bold',
            icon: '<b>B</b>',
            result: () => pell.exec('bold')
        },
        {
            name: 'italic',
            icon: '<i>I</i>',
            result: () => pell.exec('italic')
        },
        {
            name: 'underline',
            icon: '<u>U</u>',
            result: () => pell.exec('underline')
        },
        {
            name: 'link',
            icon: '🔗',
            result: () => {
                const url = window.prompt('Введите URL');
                if (url) pell.exec('createLink', url);
            }
        }
    ],
    // Указываем, что будем использовать свои классы для кнопок
    classes: {
        actionbar: 'pell-actionbar-custom',
        button: 'pell-button-custom',
        content: 'pell-content',
        selected: 'pell-button-selected'
    }
});
    
    await loadCategories();

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (eventId) {
        document.getElementById('form-title').textContent = 'Редактирование события';
        await loadEventDataForEdit(eventId, editor);
    }

    // 2. ОБРАБОТЧИК ПРЕДПРОСМОТРА КАРТИНКИ
    document.getElementById('preview-btn').addEventListener('click', () => {
        const imageUrl = document.getElementById('event-image-url').value;
        const preview = document.getElementById('image-preview');
        if (imageUrl) {
            preview.src = imageUrl;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    });

    document.getElementById('event-form').addEventListener('submit', (e) => handleFormSubmit(e, eventId, editor));
});


async function loadCategories() {
    // ... (код этой функции не меняется, можно скопировать из старой версии)
    const categorySelect = document.getElementById('event-category');
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) { console.error("Ошибка загрузки категорий:", error); return; }
    categorySelect.innerHTML = data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
}

async function loadEventDataForEdit(eventId, editor) {
    const { data: event, error } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    if (error || !event) {
        alert("Событие не найдено.");
        window.location.href = '/';
        return;
    }
    if (event.user_id !== currentUser.id && !isAdmin) {
         alert("Нет прав на редактирование.");
         window.location.href = '/';
         return;
    }

    document.getElementById('event-title').value = event.title;
    document.getElementById('event-link').value = event.link || '';
    editor.content.innerHTML = event.description || ''; // ЗАПОЛНЯЕМ РЕДАКТОР
    document.getElementById('event-image-url').value = event.image_url || '';
    document.getElementById('event-category').value = event.category_id;
    document.getElementById('event-date').value = event.event_date;
    document.getElementById('event-city').value = event.city || '';
    
    // Показываем предпросмотр, если есть картинка
    if(event.image_url) {
        document.getElementById('image-preview').src = event.image_url;
        document.getElementById('image-preview').style.display = 'block';
    }
}

async function handleFormSubmit(e, eventId, editor) {
    e.preventDefault();
    const formMessage = document.getElementById('form-message');
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    formMessage.textContent = 'Сохраняем...';

    try {
        const eventData = {
            title: document.getElementById('event-title').value,
            description: editor.content.innerHTML, // ПОЛУЧАЕМ HTML ИЗ РЕДАКТОРА
            image_url: document.getElementById('event-image-url').value,
            category_id: document.getElementById('event-category').value,
            event_date: document.getElementById('event-date').value || null,
            city: document.getElementById('event-city').value,
            link: document.getElementById('event-link').value,
            user_id: currentUser.id,
        };
        
        let result = eventId 
            ? await supabaseClient.from('events').update(eventData).eq('id', eventId).select().single()
            : await supabaseClient.from('events').insert(eventData).select().single();

        const { data, error } = result;
        if (error) throw error;
        
        formMessage.textContent = '✅ Успешно! Перенаправляем...';
        setTimeout(() => { window.location.href = `/event.html?id=${data.id}`; }, 1500);

    } catch (error) {
        formMessage.textContent = `Ошибка: ${error.message}`;
        submitButton.disabled = false;
    }
}
