document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader();
    if (!currentUser) { window.location.href = '/login.html'; return; }

    const editor = pell.init({
        element: document.getElementById('editor-container'),
        onChange: () => {},
        defaultParagraphSeparator: 'p',
        actions: [
            { name: 'bold', icon: '<b>B</b>', result: () => pell.exec('bold') },
            { name: 'italic', icon: '<i>I</i>', result: () => pell.exec('italic') },
            { name: 'underline', icon: '<u>U</u>', result: () => pell.exec('underline') },
            { name: 'link', icon: '🔗', result: () => { const url = window.prompt('Введите URL'); if (url) pell.exec('createLink', url); } }
        ],
        classes: { actionbar: 'pell-actionbar-custom', button: 'pell-button-custom', content: 'pell-content', selected: 'pell-button-selected' }
    });
    
    await loadCategories();

    // --- ЛОГИКА ЗАГРУЗКИ ИЗОБРАЖЕНИЙ ---
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('image-file-input');
    const instructions = document.getElementById('upload-instructions');
    const preview = document.getElementById('image-preview');
    let selectedFile = null;

    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFileSelect(fileInput.files[0]));
    
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
    // --- КОНЕЦ ЛОГИКИ ЗАГРУЗКИ ---

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (eventId) {
        document.getElementById('form-title').textContent = 'Редактирование события';
        await loadEventDataForEdit(eventId, editor, handleFileSelect);
    }

    document.getElementById('event-form').addEventListener('submit', (e) => handleFormSubmit(e, eventId, editor, selectedFile));
});

async function loadEventDataForEdit(eventId, editor) {
    const { data: event, error } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    if (error || !event) { alert("Событие не найдено."); window.location.href = '/'; return; }
    if (event.user_id !== currentUser.id && !isAdmin) { alert("Нет прав на редактирование."); window.location.href = '/'; return; }

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
}

async function handleFormSubmit(e, eventId, editor, fileToUpload) {
    e.preventDefault();
    const formMessage = document.getElementById('form-message');
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    formMessage.textContent = 'Сохраняем...';

    try {
        let imageUrl = document.getElementById('event-image-url').value;

        if (fileToUpload) {
            formMessage.textContent = 'Загружаем изображение...';
            const filePath = `${currentUser.id}/${Date.now()}-${fileToUpload.name}`;
            const { error: uploadError } = await supabaseClient.storage.from('events-images').upload(filePath, fileToUpload);
            if (uploadError) throw new Error(`Ошибка загрузки изображения: ${uploadError.message}`);
            const { data: urlData } = supabaseClient.storage.from('events-images').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }
        
        formMessage.textContent = 'Сохраняем событие...';
        const eventData = {
            title: document.getElementById('event-title').value, description: editor.content.innerHTML, image_url: imageUrl,
            category_id: document.getElementById('event-category').value, event_date: document.getElementById('event-date').value || null,
            city: document.getElementById('event-city').value, link: document.getElementById('event-link').value, user_id: currentUser.id,
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

async function loadCategories() {
    const categorySelect = document.getElementById('event-category');
    if (!categorySelect) return;
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) { console.error("Ошибка загрузки категорий:", error); return; }
    categorySelect.innerHTML = data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
}
