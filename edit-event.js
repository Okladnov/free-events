// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const pageTitle = document.getElementById('page-title');
const eventForm = document.getElementById('event-form');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const dateInput = document.getElementById('date');
const cityInput = document.getElementById('city');
const categoriesContainer = document.getElementById('categories-container');
const organizationSelect = document.getElementById('organization-select');
const imagePreview = document.getElementById('image-preview');
const imageUploadInput = document.getElementById('image-upload');
const removeImageBtn = document.getElementById('remove-image-btn');
const formMessage = document.getElementById('form-message');
const submitBtn = document.getElementById('submit-btn');
const deleteBtn = document.getElementById('delete-btn');

// =================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// =================================================================
let currentUser = null;
let isAdmin = false;
let editingEventId = null;
let initialCategoryIds = [];
let imageChanged = false; // Флаг, чтобы отслеживать изменение картинки

// =================================================================
// ГЛАВНАЯ ЛОГИКА
// =================================================================
async function main() {
    setupHeader();

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return;
    }
    currentUser = session.user;
    const { data: adminStatus } = await supabaseClient.rpc('is_admin');
    isAdmin = adminStatus;

    // Загружаем общие данные (категории, организации)
    await Promise.all([
        loadCategories(),
        loadOrganizations()
    ]);
    
    // Проверяем, это страница создания или редактирования
    const urlParams = new URLSearchParams(window.location.search);
    editingEventId = urlParams.get('id');

    if (editingEventId) {
        // РЕЖИМ РЕДАКТИРОВАНИЯ
        pageTitle.textContent = 'Редактирование события';
        submitBtn.textContent = 'Сохранить изменения';
        deleteBtn.style.display = 'block';
        await loadEventForEditing();
    } else {
        // РЕЖИМ СОЗДАНИЯ
        pageTitle.textContent = 'Добавление нового события';
        submitBtn.textContent = 'Опубликовать';
    }

    // Настраиваем обработчики
    imageUploadInput.addEventListener('change', handleImagePreview);
    removeImageBtn.addEventListener('click', handleImageRemove);
    eventForm.addEventListener('submit', handleFormSubmit);
    deleteBtn.addEventListener('click', handleDeleteEvent);
}

// =================================================================
// ЗАГРУЗКА ДАННЫХ
// =================================================================
async function loadCategories() {
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) return;
    let html = '';
    (data || []).forEach(category => {
        html += `<div class="category-checkbox"><input type="checkbox" id="cat-${category.id}" name="categories" value="${category.id}"><label for="cat-${category.id}">${category.name}</label></div>`;
    });
    categoriesContainer.innerHTML = html;
}

async function loadOrganizations() {
    const { data, error } = await supabaseClient.from('organizations').select('*').order('name');
    if (error) return;
    (data || []).forEach(org => {
        const option = document.createElement('option');
        option.value = org.id;
        option.textContent = org.name;
        organizationSelect.appendChild(option);
    });
}

async function loadEventForEditing() {
    const { data: event, error } = await supabaseClient
        .from('events')
        .select('*, event_categories(category_id)')
        .eq('id', editingEventId)
        .single();
    
    if (error || !event) {
        document.querySelector('.edit-layout-container').innerHTML = '<h2>Событие не найдено</h2>';
        return;
    }

    if (event.created_by !== currentUser.id && !isAdmin) {
        document.querySelector('.edit-layout-container').innerHTML = '<h2>У вас нет прав для редактирования этого события</h2>';
        return;
    }

    // Заполняем форму
    titleInput.value = event.title || '';
    descriptionInput.value = event.description || '';
    cityInput.value = event.city || '';
    dateInput.value = event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : '';
    organizationSelect.value = event.organization_id || '';
    
    if (event.image_url) {
        imagePreview.src = event.image_url;
        removeImageBtn.style.display = 'block';
    }
    
    // Отмечаем категории
    initialCategoryIds = event.event_categories.map(ec => ec.category_id);
    initialCategoryIds.forEach(catId => {
        const checkbox = document.getElementById(`cat-${catId}`);
        if (checkbox) checkbox.checked = true;
    });
}


// =================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// =================================================================
function handleImagePreview() {
    const file = imageUploadInput.files[0];
    if (file) {
        imageChanged = true;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            removeImageBtn.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function handleImageRemove() {
    imageChanged = true;
    imagePreview.src = 'https://placehold.co/600x400/f0f2f5/ccc?text=Изображение';
    imageUploadInput.value = ''; // Сбрасываем выбор файла
    removeImageBtn.style.display = 'none';
}

async function handleDeleteEvent() {
    if (!editingEventId) return;
    if (confirm('Вы уверены, что хотите удалить это событие навсегда?')) {
        const { error } = await supabaseClient.from('events').delete().eq('id', editingEventId);
        if (error) {
            alert(`Ошибка удаления: ${error.message}`);
        } else {
            alert('Событие удалено.');
            window.location.href = '/';
        }
    }
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ - СОХРАНЕНИЕ ФОРМЫ
// =================================================================
async function handleFormSubmit(e) {
    e.preventDefault();
    submitBtn.disabled = true;
    formMessage.textContent = 'Сохранение...';

    try {
        const eventData = {
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            city: cityInput.value.trim(),
            event_date: dateInput.value || null,
            organization_id: organizationSelect.value || null
        };
        
        let eventId = editingEventId;
        let error, data;

        if (editingEventId) {
            // --- РЕЖИМ РЕДАКТИРОВАНИЯ ---
            ({ error } = await supabaseClient.from('events').update(eventData).eq('id', eventId));
        } else {
            // --- РЕЖИМ СОЗДАНИЯ ---
            eventData.created_by = currentUser.id;
            ({ data, error } = await supabaseClient.from('events').insert(eventData).select().single());
            if (data) eventId = data.id;
        }

        if (error) throw error;
        if (!eventId) throw new Error('Не удалось получить ID события');

        // --- Обработка изображения ---
        if (imageChanged) {
            const imageFile = imageUploadInput.files[0];
            let imageUrl = null;
            if (imageFile) {
                // Загружаем новое
                const filePath = `${currentUser.id}/${eventId}_${Date.now()}`;
                const { error: uploadError } = await supabaseClient.storage.from('event-images').upload(filePath, imageFile);
                if (uploadError) throw uploadError;
                imageUrl = supabaseClient.storage.from('event-images').getPublicUrl(filePath).data.publicUrl;
            }
            // Обновляем ссылку на картинку в базе
            await supabaseClient.from('events').update({ image_url: imageUrl }).eq('id', eventId);
        }

        // --- Обработка категорий ---
        const selectedCategoryIds = Array.from(document.querySelectorAll('#categories-container input:checked')).map(cb => Number(cb.value));
        const categoriesToAdd = selectedCategoryIds.filter(id => !initialCategoryIds.includes(id));
        const categoriesToRemove = initialCategoryIds.filter(id => !selectedCategoryIds.includes(id));
        
        if (categoriesToRemove.length > 0) {
            await supabaseClient.from('event_categories').delete().eq('event_id', eventId).in('category_id', categoriesToRemove);
        }
        if (categoriesToAdd.length > 0) {
            await supabaseClient.from('event_categories').insert(categoriesToAdd.map(catId => ({ event_id: eventId, category_id: catId })));
        }

        formMessage.textContent = '✅ Успешно сохранено!';
        setTimeout(() => { window.location.href = `/event.html?id=${eventId}`; }, 1500);

    } catch (error) {
        formMessage.textContent = `Ошибка: ${error.message}`;
        submitBtn.disabled = false;
    }
}


// =================================================================
// СТАНДАРТНАЯ ШАПКА
// =================================================================
function setupHeader() { /* ... код из предыдущих шагов ... */ }

main();
