document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader(); // Ждем, пока app.js отработает и определит пользователя

    // Если пользователь не авторизован, отправляем на главную
    if (!currentUser) {
        alert("Пожалуйста, войдите, чтобы добавлять или редактировать события.");
        window.location.href = '/';
        return;
    }

    // 1. ИНИЦИАЛИЗИРУЕМ РЕДАКТОР TINYMCE
    tinymce.init({
        selector: '#editor-container',
        plugins: 'autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
        toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist outdent indent | link image | code',
        height: 300,
        menubar: false,
        content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size:15px }',
        // Адаптация под тёмную тему
        skin: (window.matchMedia('(prefers-color-scheme: dark)').matches || document.body.classList.contains('dark-theme')) ? "oxide-dark" : "default",
        content_css: (window.matchMedia('(prefers-color-scheme: dark)').matches || document.body.classList.contains('dark-theme')) ? "dark" : "default",

        setup: function (editor) {
            editor.on('init', async function () {
                // Этот код выполнится, когда редактор будет полностью готов
                // 3. ПРОВЕРЯЕМ, РЕДАКТИРОВАНИЕ ЛИ ЭТО, И ЗАГРУЖАЕМ ДАННЫЕ
                const urlParams = new URLSearchParams(window.location.search);
                const eventId = urlParams.get('id');
                if (eventId) {
                    const formTitle = document.getElementById('form-title');
                    if (formTitle) formTitle.textContent = 'Редактирование события';
                    await loadEventDataForEdit(eventId);
                }
            });
        }
    });

    // 2. ЗАГРУЖАЕМ КАТЕГОРИИ
    await loadCategories();

    // 4. НАСТРАИВАЕМ ЗАГРУЗЧИК ИЗОБРАЖЕНИЙ (код без изменений)
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('image-file-input');
    const instructions = document.getElementById('upload-instructions');
    const preview = document.getElementById('image-preview');
    let selectedFile = null;

    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            if (e.target.id === 'select-file-btn' || e.target.closest('#select-file-btn')) {
                fileInput.click();
                e.preventDefault();
            } else if (e.target.id === 'upload-area' || e.target.closest('.upload-area')) {
                 fileInput.click();
                 e.preventDefault();
            }
        });
    }

    if (fileInput) fileInput.addEventListener('change', () => handleFileSelect(fileInput.files[0]));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        if (uploadArea) uploadArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        if (uploadArea) uploadArea.addEventListener(eventName, () => uploadArea.classList.add('active'));
    });
    ['dragleave', 'drop'].forEach(eventName => {
        if (uploadArea) uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('active'));
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
    
    // 5. ВЕШАЕМ ОБРАБОТЧИК НА ОТПРАВКУ ФОРМЫ
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');
        eventForm.addEventListener('submit', (e) => handleFormSubmit(e, eventId, selectedFile));
    }
});

// ===================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===================================================================

async function loadCategories() {
    // ... (код без изменений)
}

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

        document.getElementById('event-title').value = event.title;
        document.getElementById('event-link').value = event.link || '';
        
        // ИЗМЕНЕНО: Устанавливаем контент в TinyMCE
        tinymce.get('editor-container').setContent(event.description || '');

        document.getElementById('event-image-url').value = event.image_url || '';
        document.getElementById('event-category').value = event.category_id;
        document.getElementById('event-date').value = event.event_date;
        document.getElementById('event-city').value = event.city || '';
        
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
        if (fileToUpload) {
            if (formMessage) formMessage.textContent = 'Загружаем изображение...';
            const filePath = `${currentUser.id}/${Date.now()}-${fileToUpload.name}`;
            const { error: uploadError } = await supabaseClient.storage.from('events-images').upload(filePath, fileToUpload, { upsert: true }); 
            if (uploadError) throw new Error(`Ошибка загрузки изображения: ${uploadError.message}`);
            const { data: urlData } = supabaseClient.storage.from('events-images').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }
        
        if (formMessage) formMessage.textContent = 'Сохраняем событие...';
        
        const eventData = {
            title: document.getElementById('event-title').value.trim(),
            // ИЗМЕНЕНО: Получаем контент из TinyMCE
            description: tinymce.get('editor-container').getContent(),
            image_url: imageUrl,
            category_id: document.getElementById('event-category').value,
            event_date: document.getElementById('event-date').value || null,
            city: document.getElementById('event-city').value.trim(),
            link: document.getElementById('event-link').value.trim(),
            created_by: currentUser.id,
        };

        const { data, error } = eventId
            ? await supabaseClient.from('events').update(eventData).eq('id', eventId).select().single()
            : await supabaseClient.from('events').insert(eventData).select().single();
        
        if (error) throw error;
        
        if (formMessage) {
            formMessage.textContent = '✅ Успешно! Перенаправляем...';
            formMessage.style.color = 'var(--success-color)';
        }
        
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
