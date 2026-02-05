// ===================================================================
// edit-event.js - ЕДИНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Ждем, пока app.js отработает и определит пользователя
    await initializeHeader();

    // Если пользователь не авторизован, отправляем на страницу входа
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
            { name: 'bold', icon: '<b>B</b>', result: () => pell.exec('bold') },
            { name: 'italic', icon: '<i>I</i>', result: () => pell.exec('italic') },
            { name: 'underline', icon: '<u>U</u>', result: () => pell.exec('underline') },
            { name: 'link', icon: '🔗', result: () => { const url = window.prompt('Введите URL'); if (url) pell.exec('createLink', url); } }
        ],
        classes: {
            actionbar: 'pell-actionbar-custom',
            button: 'pell-button-custom',
            content: 'pell-content',
            selected: 'pell-button-selected'
        }
    });

    // 2. ЗАГРУЖАЕМ КАТЕГОРИИ
    await loadCategories();

    // 3. НАСТРАИВАЕМ ЗАГРУЗЧИК ИЗОБРАЖЕНИЙ
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('image-file-input');
    const instructions = document.getElementById('upload-instructions');
    const preview = document.getElementById('image-preview');
    let selectedFile = null;

    // Открываем выбор файла по клику на область или кнопку
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // Обрабатываем выбор файла
    fileInput.addEventListener('change', () => handleFileSelect(fileInput.files[0]));

    // Обрабатываем Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('active'));
    });
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('active'));
    });
    uploadArea.addEventListener('drop', (e) => handleFileSelect(e.dataTransfer.files[0]));

    function handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) return;
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
            instructions.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // 4. ПРОВЕРЯЕМ, РЕДАКТИРОВАНИЕ ЛИ ЭТО, И ЗАГРУЖАЕМ ДАННЫЕ
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (eventId) {
        document.getElementById('form-title').textContent = 'Редактирование события';
        await loadEventDataForEdit(eventId, editor);
    }

    // 5. ВЕШАЕМ ОБРАБОТЧИК НА ОТПРАВКУ ФОРМЫ
    document.getElementById('event-form').addEventListener('submit', (e) => handleFormSubmit(e, eventId, editor, selectedFile));
});

// ===================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===================================================================

/**
 * Загружает категории в выпадающий список
 */
async function loadCategories() {
    const categorySelect = document.getElementById('event-category');
    if (!categorySelect) return;
    try {
        const { data, error } = await supabaseClient.from('categories').select('*').order('name');
        if (error) throw error;
        categorySelect.innerHTML = data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    } catch (error) {
        console.error("Ошибка загрузки категорий:", error);
    }
}

/**
 * Загружает данные события для редактирования
 */
async function loadEventDataForEdit(eventId, editor) {
    try {
        const { data: event, error } = await supabaseClient.from('events').select('*').eq('id', eventId).single();

        if (error || !event) {
            alert("Событие не найдено.");
            window.location.href = '/';
            return;
        }

        if (event.created_by !== currentUser.id && !isAdmin) {
             alert("У вас нет прав на редактирование этого события.");
             window.location.href = '/';
             return;
        }

        // Заполняем все поля формы
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-link').value = event.link || '';
        editor.content.innerHTML = event.description || '';
        document.getElementById('event-image-url').value = event.image_url || '';
        document.getElementById('event-category').value = event.category_id;
        document.getElementById('event-date').value = event.event_date;
        document.getElementById('event-city').value = event.city || '';

        // Показываем предпросмотр, если есть картинка
        if (event.image_url) {
            document.getElementById('image-preview').src = event.image_url;
            document.getElementById('image-preview').style.display = 'block';
            document.getElementById('upload-instructions').style.display = 'none';
        }
    } catch (error) {
        console.error("Ошибка загрузки данных события:", error);
        alert("Произошла ошибка при загрузке данных.");
    }
}

/**
 * Обрабатывает отправку формы (создание или обновление)
 */
async function handleFormSubmit(e, eventId, editor, fileToUpload) {
    e.preventDefault();
    const title = document.getElementById('event-title').value.trim();
if (!title) {
    formMessage.textContent = 'Ошибка: Заголовок не может быть пустым.';
    formMessage.style.color = '#e74c3c';
    submitButton.disabled = false;
    return; // Прерываем выполнение функции
}
    const formMessage = document.getElementById('form-message');
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    formMessage.textContent = 'Сохраняем...';
    formMessage.style.color = 'var(--text-color)';

    try {
        let imageUrl = document.getElementById('event-image-url').value.trim();

        // 1. Если выбран новый файл, загружаем его
        if (fileToUpload) {
            formMessage.textContent = 'Загружаем изображение...';
            // Убедись, что бакет 'events-images' существует и он публичный!
            const filePath = `${currentUser.id}/${Date.now()}-${fileToUpload.name}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('events-images')
                .upload(filePath, fileToUpload, { upsert: true }); // upsert: true перезапишет файл, если имя совпадет
            
            if (uploadError) throw new Error(`Ошибка загрузки изображения: ${uploadError.message}`);

            const { data: urlData } = supabaseClient.storage.from('events-images').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }
        
        formMessage.textContent = 'Сохраняем событие...';
        
        // 2. Собираем все данные из формы
        const eventData = {
            title: document.getElementById('event-title').value.trim(),
            description: editor.content.innerHTML,
            image_url: imageUrl,
            category_id: document.getElementById('event-category').value,
            event_date: document.getElementById('event-date').value || null,
            city: document.getElementById('event-city').value.trim(),
            link: document.getElementById('event-link').value.trim(),
            created_by: currentUser.id,
        };

        // 3. Обновляем или вставляем запись
        const { data, error } = eventId
            ? await supabaseClient.from('events').update(eventData).eq('id', eventId).select().single()
            : await supabaseClient.from('events').insert(eventData).select().single();
        
        if (error) throw error;
        
        formMessage.textContent = '✅ Успешно! Перенаправляем...';
        formMessage.style.color = '#2ecc71';
        
        // 4. Перенаправляем на страницу события
        setTimeout(() => { window.location.href = `/event.html?id=${data.id}`; }, 1500);

    } catch (error) {
        formMessage.textContent = `Ошибка: ${error.message}`;
        formMessage.style.color = '#e74c3c';
        submitButton.disabled = false;
    }
}
