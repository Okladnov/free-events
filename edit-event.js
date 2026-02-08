// ===================================================================
// edit-event.js - ЕДИНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
// ===================================================================

let pellEditor = null; // Делаем редактор глобальным, чтобы к нему можно было обратиться

document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader(); // Ждем, пока app.js отработает и определит пользователя

    // Если пользователь не авторизован, отправляем на главную
    if (!currentUser) {
        alert("Пожалуйста, войдите, чтобы добавлять или редактировать события.");
        window.location.href = '/';
        return;
    }

    // 1. ИНИЦИАЛИЗИРУЕМ КАСТОМНЫЙ РЕДАКТОР PELL
    pellEditor = pell.init({
        element: document.getElementById('editor-container'),
        onChange: html => {
            // Здесь можно что-то делать с HTML, например, сохранять в скрытое поле
            // или просто оставить пустым, т.к. мы получаем HTML напрямую из editor.content.innerHTML
        },
        defaultParagraphSeparator: 'p',
        actions: [
            { name: 'bold', icon: '<b>B</b>', result: () => pell.exec('bold') },
            { name: 'italic', icon: '<i>I</i>', result: () => pell.exec('italic') },
            { name: 'underline', icon: '<u>U</u>', result: () => pell.exec('underline') },
            { name: 'link', icon: '🔗', result: () => { const url = window.prompt('Введите URL'); if (url) pell.exec('createLink', url); } }
            // Можно добавить другие стандартные действия Pell: 'blockquote', 'code', 'heading1', 'heading2', 'paragraph', 'strikethrough'
        ],
        classes: {
            actionbar: 'pell-actionbar', // Используем классы из style.css
            button: 'pell-button',
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
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            // Если кликнули на кнопку, открываем fileInput, иначе ничего
            if (e.target.id === 'select-file-btn' || e.target.closest('#select-file-btn')) {
                fileInput.click();
                e.preventDefault(); // Предотвращаем дефолтное поведение кнопки
            } else if (e.target.id === 'upload-area' || e.target.closest('.upload-area')) {
                 fileInput.click();
                 e.preventDefault();
            }
        });
    }

    // Обрабатываем выбор файла
    fileInput.addEventListener('change', () => handleFileSelect(fileInput.files[0]));
    // Обрабатываем Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        if (uploadArea) {
            uploadArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
        }
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        if (uploadArea) {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('active'));
        }
    });
    ['dragleave', 'drop'].forEach(eventName => {
        if (uploadArea) {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('active'));
        }
    });
    if (uploadArea) {
        uploadArea.addEventListener('drop', (e) => handleFileSelect(e.dataTransfer.files[0]));
    }

    function handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) return;
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if (instructions) instructions.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // 4. ПРОВЕРЯЕМ, РЕДАКТИРОВАНИЕ ЛИ ЭТО, И ЗАГРУЖАЕМ ДАННЫЕ
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (eventId) {
        const formTitle = document.getElementById('form-title');
        if (formTitle) formTitle.textContent = 'Редактирование события';
        await loadEventDataForEdit(eventId);
    }

    // 5. ВЕШАЕМ ОБРАБОТЧИК НА ОТПРАВКУ ФОРМЫ
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', (e) => handleFormSubmit(e, eventId, selectedFile));
    }
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
async function loadEventDataForEdit(eventId) {
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
        if (pellEditor && pellEditor.content) { // Убеждаемся, что pellEditor инициализирован
            pellEditor.content.innerHTML = event.description || '';
        }
        document.getElementById('event-image-url').value = event.image_url || '';
        document.getElementById('event-category').value = event.category_id;
        document.getElementById('event-date').value = event.event_date;
        document.getElementById('event-city').value = event.city || '';

        // Показываем предпросмотр, если есть картинка
        const imagePreview = document.getElementById('image-preview');
        const uploadInstructions = document.getElementById('upload-instructions');
        if (event.image_url && imagePreview && uploadInstructions) {
            imagePreview.src = event.image_url;
            imagePreview.style.display = 'block';
            uploadInstructions.style.display = 'none';
        }
    } catch (error) {
        console.error("Ошибка загрузки данных события:", error);
        alert("Произошла ошибка при загрузке данных.");
    }
}

/**
 * Обрабатывает отправку формы (создание или обновление)
 */
async function handleFormSubmit(e, eventId, fileToUpload) {
    e.preventDefault();
    
    const formMessage = document.getElementById('form-message');
    const submitButton = e.target.querySelector('button[type="submit"]');

    if (submitButton) submitButton.disabled = true;
    if (formMessage) {
        formMessage.textContent = 'Сохраняем...';
        formMessage.style.color = 'var(--text-color)';
    }

    try {
        const title = document.getElementById('event-title').value.trim();
        if (!title) {
            if (formMessage) {
                formMessage.textContent = 'Ошибка: Заголовок не может быть пустым.';
                formMessage.style.color = 'var(--danger-color)';
            }
            if (submitButton) submitButton.disabled = false;
            return;
        }

        let imageUrl = document.getElementById('event-image-url').value.trim();

        // 1. Если выбран новый файл, загружаем его
        if (fileToUpload) {
            if (formMessage) formMessage.textContent = 'Загружаем изображение...';
            
            const filePath = `${currentUser.id}/${Date.now()}-${fileToUpload.name}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('events-images')
                .upload(filePath, fileToUpload, { upsert: true }); 
            
            if (uploadError) throw new Error(`Ошибка загрузки изображения: ${uploadError.message}`);
            const { data: urlData } = supabaseClient.storage.from('events-images').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }
        
        if (formMessage) formMessage.textContent = 'Сохраняем событие...';
        
        // 2. Собираем все данные из формы
        const eventData = {
            title: document.getElementById('event-title').value.trim(),
            description: pellEditor ? pellEditor.content.innerHTML : '', // Получаем HTML из Pell
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
        
        if (formMessage) {
            formMessage.textContent = '✅ Успешно! Перенаправляем...';
            formMessage.style.color = 'var(--success-color)';
        }
        
        // 4. Перенаправляем на страницу события
        setTimeout(() => { window.location.href = `/event.html?id=${data.id}`; }, 1500);
    } catch (error) {
        console.error("Ошибка сохранения события:", error);
        if (formMessage) {
            formMessage.textContent = `Ошибка: ${error.message}`;
            formMessage.style.color = 'var(--danger-color)';
        }
        if (submitButton) submitButton.disabled = false;
    }
}
