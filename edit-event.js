// ===================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ СОЗДАНИЯ/РЕДАКТИРОВАНИЯ - edit-event.html
// ===================================================================
// Важно: supabaseClient и currentUser уже созданы в script.js.

// --- 1. Функция-инициализатор для этой страницы ---
function initializeEditEventPage() {
    const eventForm = document.getElementById('event-form');
    // Если мы не на странице с формой, ничего не делаем
    if (!eventForm) return;

    // Сразу проверяем, авторизован ли пользователь
    if (!currentUser) {
        alert("Для доступа к этой странице необходимо войти в систему.");
        window.location.href = '/login.html';
        return;
    }

    // --- Если пользователь на месте, запускаем всю логику ---
    const editor = initializeEditor();
    initializeImageUploader();
    loadCategories();

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (eventId) {
        document.getElementById('form-title').textContent = 'Редактирование события';
        loadEventDataForEdit(eventId, editor);
    }

    eventForm.addEventListener('submit', (e) => {
        // Получаем файл в момент отправки
        const fileInput = document.getElementById('image-file-input');
        const selectedFile = fileInput.files[0] || null;
        handleFormSubmit(e, eventId, editor, selectedFile);
    });
}

// --- 2. Инициализация редактора Pell ---
function initializeEditor() {
    return pell.init({
        element: document.getElementById('editor-container'),
        onChange: html => {},
        defaultParagraphSeparator: 'p',
        actions: [
            { name: 'bold', icon: '<b>B</b>', result: () => pell.exec('bold') },
            { name: 'italic', icon: '<i>I</i>', result: () => pell.exec('italic') },
            { name: 'underline', icon: '<u>U</u>', result: () => pell.exec('underline') },
            { name: 'link', icon: '🔗', result: () => { const url = window.prompt('Введите URL'); if (url) pell.exec('createLink', url); } }
        ],
        classes: { actionbar: 'pell-actionbar-custom', button: 'pell-button-custom', content: 'pell-content' }
    });
}

// --- 3. Инициализация загрузчика изображений ---
function initializeImageUploader() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('image-file-input');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFileSelect(fileInput.files[0]));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => uploadArea.addEventListener(eName, e => {e.preventDefault(); e.stopPropagation();}));
    ['dragenter', 'dragover'].forEach(eName => uploadArea.addEventListener(eName, () => uploadArea.classList.add('active')));
    ['dragleave', 'drop'].forEach(eName => uploadArea.addEventListener(eName, () => uploadArea.classList.remove('active')));
    uploadArea.addEventListener('drop', e => handleFileSelect(e.dataTransfer.files[0]));
}

function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('image-preview').src = e.target.result;
        document.getElementById('image-preview').style.display = 'block';
        document.getElementById('upload-instructions').style.display = 'none';
    };
    reader.readAsDataURL(file);
    // Важно: мы не сохраняем файл в переменную здесь, а берем его из fileInput при отправке
}


// --- 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (загрузка, сохранение) ---

async function loadCategories() {
    const categorySelect = document.getElementById('event-category');
    try {
        const { data, error } = await supabaseClient.from('categories').select('*').order('name');
        if (error) throw error;
        categorySelect.innerHTML = data.map(cat => `<option value="${cat.id}">${sanitizeHTML(cat.name)}</option>`).join('');
    } catch (error) { console.error("Ошибка загрузки категорий:", error); }
}

async function loadEventDataForEdit(eventId, editor) {
    try {
        const { data: event, error } = await supabaseClient.from('events').select('*, profiles(id)').eq('id', eventId).single();
        if (error || !event) {
            alert("Событие не найдено.");
            window.location.href = '/';
            return;
        }
        // Проверяем права: либо ты автор, либо админ (isAdmin из script.js)
        if (event.user_id !== currentUser.id && currentUser.user_metadata.role !== 'admin') {
             alert("У вас нет прав на редактирование этого события.");
             window.location.href = '/';
             return;
        }
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-link').value = event.link || '';
        editor.content.innerHTML = event.description || '';
        document.getElementById('event-image-url').value = event.image_url || '';
        document.getElementById('event-category').value = event.category_id;
        document.getElementById('event-date').value = event.event_date;
        document.getElementById('event-city').value = event.city || '';
        if (event.image_url) {
            document.getElementById('image-preview').src = event.image_url;
            document.getElementById('image-preview').style.display = 'block';
            document.getElementById('upload-instructions').style.display = 'none';
        }
    } catch (error) { console.error("Ошибка загрузки данных события:", error); }
}

async function handleFormSubmit(e, eventId, editor, fileToUpload) {
    e.preventDefault();
    const formMessage = document.getElementById('form-message');
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    formMessage.textContent = 'Сохраняем...';
    
    try {
        let imageUrl = document.getElementById('event-image-url').value.trim();
        if (fileToUpload) {
            formMessage.textContent = 'Загружаем изображение...';
            const filePath = `${currentUser.id}/${Date.now()}-${fileToUpload.name}`;
            const { error: uploadError } = await supabaseClient.storage.from('events-images').upload(filePath, fileToUpload, { upsert: true });
            if (uploadError) throw new Error(`Ошибка загрузки изображения: ${uploadError.message}`);
            const { data: urlData } = supabaseClient.storage.from('events-images').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }
        
        formMessage.textContent = 'Сохраняем событие...';
        const eventData = {
            title: document.getElementById('event-title').value.trim(),
            description: editor.content.innerHTML,
            image_url: imageUrl,
            category_id: document.getElementById('event-category').value,
            event_date: document.getElementById('event-date').value || null,
            city: document.getElementById('event-city').value.trim(),
            link: document.getElementById('event-link').value.trim(),
            user_id: currentUser.id,
        };

        const { data, error } = eventId
            ? await supabaseClient.from('events').update(eventData).eq('id', eventId).select().single()
            : await supabaseClient.from('events').insert(eventData).select().single();
        
        if (error) throw error;
        
        formMessage.textContent = '✅ Успешно! Перенаправляем...';
        setTimeout(() => { window.location.href = `/event.html?id=${data.id}`; }, 1500);

    } catch (error) {
        formMessage.textContent = `Ошибка: ${error.message}`;
        submitButton.disabled = false;
    }
}


// --- 5. Точка входа: запускаем инициализацию ---
document.addEventListener('DOMContentLoaded', initializeEditEventPage);

