// ===================================================================
// edit-event.js - ВЕРСИЯ С УМНЫМ ПОИСКОМ ОРГАНИЗАЦИЙ
// ===================================================================

let pellEditor = null;
let selectedFile = null;
let selectedOrganizationId = null; // Для хранения ID выбранной организации

document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader();

    if (!currentUser) {
        alert("Пожалуйста, войдите, чтобы добавлять или редактировать события.");
        window.location.href = '/';
        return;
    }

    // 1. Инициализируем редактор Pell
    pellEditor = pell.init({
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
            actionbar: 'pell-actionbar',
            button: 'pell-button',
            content: 'pell-content',
            selected: 'pell-button-selected'
        }
    });

    // 2. Загружаем категории
    await loadCategories();
    
    // 3. Настраиваем поиск организаций
    setupOrganizationSearch();
    
    // 4. Настраиваем загрузчик изображений
    setupImageUploader();
    
    // 5. Проверяем, редактирование ли это, и загружаем данные
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (eventId) {
        const formTitle = document.getElementById('form-title');
        if (formTitle) formTitle.textContent = 'Редактирование события';
        await loadEventDataForEdit(eventId);
    }

    // 6. Вешаем обработчик на отправку формы
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', (e) => handleFormSubmit(e, eventId, selectedFile));
    }
});

// ===================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===================================================================

function setupImageUploader() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('image-file-input');
    const instructions = document.getElementById('upload-instructions');
    const preview = document.getElementById('image-preview');
    
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            if (fileInput && (e.target.id === 'select-file-btn' || e.target.closest('#select-file-btn'))) {
                fileInput.click();
                e.preventDefault(); 
            } else if (fileInput) {
                 fileInput.click();
                 e.preventDefault();
            }
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', () => handleFileSelect(fileInput.files[0]));
    }
    if (uploadArea) {
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
            if (instructions) {
                instructions.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }
}

async function setupOrganizationSearch() {
    const searchInput = document.getElementById('organization-search');
    const resultsContainer = document.getElementById('organization-results');
    const organizationIdInput = document.getElementById('organization-id');

    searchInput.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value;
        if (searchTerm.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }

        const { data, error } = await supabaseClient
            .from('organizations')
            .select('id, name')
            .ilike('name', `%${searchTerm}%`)
            .limit(5);

        resultsContainer.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(org => {
                const item = document.createElement('div');
                item.classList.add('search-result-item');
                item.textContent = org.name;
                item.dataset.id = org.id;
                resultsContainer.appendChild(item);
            });
            resultsContainer.classList.remove('hidden');
        } else {
            resultsContainer.classList.add('hidden');
        }
    });

    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item')) {
            const orgId = e.target.dataset.id;
            const orgName = e.target.textContent;
            
            searchInput.value = orgName;
            organizationIdInput.value = orgId;
            selectedOrganizationId = orgId;
            
            resultsContainer.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.organization-search-wrapper')) {
            resultsContainer.classList.add('hidden');
        }
    });
}

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

async function loadEventDataForEdit(eventId) {
    try {
        const { data: event, error } = await supabaseClient.from('events').select('*, organization:organization_id(name)').eq('id', eventId).single();
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
        
        if (pellEditor && pellEditor.content) {
            pellEditor.content.innerHTML = event.description || '';
        }
        
        if (event.organization) {
            document.getElementById('organization-search').value = event.organization.name;
            document.getElementById('organization-id').value = event.organization_id;
            selectedOrganizationId = event.organization_id;
        }
        
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
    const form = e.target;
if (!form.checkValidity() || pellEditor.content.innerText.trim() === '') {
    alert('Пожалуйста, заполните все обязательные поля (*).');
    form.reportValidity();
    return;
}
    const formMessage = document.getElementById('form-message');
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (formMessage) {
        formMessage.textContent = 'Сохраняем...';
        formMessage.style.color = 'var(--text-color)';
    }

    try {
        
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
        
        // --- НАЧАЛО ЗАМЕНЫ ---
const organizationSearchValue = document.getElementById('organization-search').value.trim();

const eventData = {
    title: document.getElementById('event-title').value.trim(),
    description: pellEditor.content.innerHTML,
    image_url: imageUrl,
    category_id: document.getElementById('event-category').value,
    
    // Если ID выбран, сохраняем его. Если нет, сохраняем введенный текст.
    organization_id: selectedOrganizationId,
    new_organization_name: selectedOrganizationId ? null : (organizationSearchValue || null),
    
    event_date: document.getElementById('event-date').value || null,
    
    // Для города сохраняем текст
    city: document.getElementById('event-city').value.trim(),
    // И добавляем новое поле, если город не из списка
    new_city_name: ['Москва', 'Санкт-Петербург', 'Онлайн'].includes(document.getElementById('event-city').value.trim()) ? null : document.getElementById('event-city').value.trim(),
    
    link: document.getElementById('event-link').value.trim(),
    created_by: currentUser.id,
    
    // Новое/отредактированное событие всегда отправляется на модерацию
    is_approved: false
};

        const { data, error } = eventId
            ? await supabaseClient.from('events').update(eventData).eq('id', eventId).select().single()
            : await supabaseClient.from('events').insert(eventData).select().single();
        
        if (error) throw error;
        
        if (formMessage) {
            alert('✅ Успешно! Ваше событие отправлено на модерацию.');
            setTimeout(() => { window.location.href = `/event.html?id=${data.id}`; }, 1000);
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
