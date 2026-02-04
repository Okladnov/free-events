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
let imageChanged = false;

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
    await Promise.all([ loadCategories(), loadOrganizations() ]);
    const urlParams = new URLSearchParams(window.location.search);
    editingEventId = urlParams.get('id');
    if (editingEventId) {
        pageTitle.textContent = 'Редактирование события';
        submitBtn.textContent = 'Сохранить изменения';
        deleteBtn.style.display = 'block';
        await loadEventForEditing();
    } else {
        pageTitle.textContent = 'Добавление нового события';
        submitBtn.textContent = 'Опубликовать';
    }
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
    if (error) { categoriesContainer.innerHTML = '<p>Ошибка загрузки категорий</p>'; return; }
    let html = '';
    (data || []).forEach(category => {
        html += `<button type="button" class="category-pill" data-id="${category.id}">${category.name}</button>`;
    });
    categoriesContainer.innerHTML = html;
    document.querySelectorAll('.categories-container-edit .category-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            pill.classList.toggle('active');
        });
    });
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
    const { data: event, error } = await supabaseClient.from('events').select('*, event_categories(category_id)').eq('id', editingEventId).single();
    if (error || !event) { document.querySelector('.edit-layout-container').innerHTML = '<h2>Событие не найдено</h2>'; return; }
    if (event.created_by !== currentUser.id && !isAdmin) { document.querySelector('.edit-layout-container').innerHTML = '<h2>У вас нет прав для редактирования этого события</h2>'; return; }
    titleInput.value = event.title || '';
    descriptionInput.value = event.description || '';
    cityInput.value = event.city || '';
    dateInput.value = event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : '';
    organizationSelect.value = event.organization_id || '';
    if (event.image_url) {
        imagePreview.src = event.image_url;
        removeImageBtn.style.display = 'block';
    }
    initialCategoryIds = event.event_categories.map(ec => ec.category_id);
    document.querySelectorAll('.categories-container-edit .category-pill').forEach(pill => {
        const pillId = parseInt(pill.dataset.id, 10);
        if (initialCategoryIds.includes(pillId)) {
            pill.classList.add('active');
        }
    });
}

// =================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// =================================================================
function handleImagePreview() { const file = imageUploadInput.files[0]; if (file) { imageChanged = true; const reader = new FileReader(); reader.onload = (e) => { imagePreview.src = e.target.result; removeImageBtn.style.display = 'block'; }; reader.readAsDataURL(file); } }
function handleImageRemove() { imageChanged = true; imagePreview.src = 'https://placehold.co/600x400/f0f2f5/ccc?text=Изображение'; imageUploadInput.value = ''; removeImageBtn.style.display = 'none'; }
async function handleDeleteEvent() { if (!editingEventId) return; if (confirm('Вы уверены, что хотите удалить это событие навсегда?')) { const { error } = await supabaseClient.from('events').delete().eq('id', editingEventId); if (error) { alert(`Ошибка удаления: ${error.message}`); } else { alert('Событие удалено.'); window.location.href = '/'; } } }

// =================================================================
// СОХРАНЕНИЕ ФОРМЫ
// =================================================================
async function handleFormSubmit(e) {
    e.preventDefault();
    submitBtn.disabled = true;
    formMessage.textContent = 'Сохранение...';
    try {
        const eventData = { title: titleInput.value.trim(), description: descriptionInput.value.trim(), city: cityInput.value.trim(), event_date: dateInput.value || null, organization_id: organizationSelect.value || null };
        let eventId = editingEventId;
        let error, data;
        if (editingEventId) {
            ({ error } = await supabaseClient.from('events').update(eventData).eq('id', eventId));
        } else {
            eventData.created_by = currentUser.id;
            ({ data, error } = await supabaseClient.from('events').insert(eventData).select().single());
            if (data) eventId = data.id;
        }
        if (error) throw error;
        if (!eventId) throw new Error('Не удалось получить ID события');
        if (imageChanged) {
            const imageFile = imageUploadInput.files[0];
            let imageUrl = null;
            if (imageFile) {
                const filePath = `${currentUser.id}/${eventId}_${Date.now()}`;
                const { error: uploadError } = await supabaseClient.storage.from('event-images').upload(filePath, imageFile);
                if (uploadError) throw uploadError;
                imageUrl = supabaseClient.storage.from('event-images').getPublicUrl(filePath).data.publicUrl;
            }
            await supabaseClient.from('events').update({ image_url: imageUrl }).eq('id', eventId);
        }
        const selectedPills = document.querySelectorAll('.categories-container-edit .category-pill.active');
        const selectedCategoryIds = Array.from(selectedPills).map(pill => Number(pill.dataset.id));
        const categoriesToAdd = selectedCategoryIds.filter(id => !initialCategoryIds.includes(id));
        const categoriesToRemove = initialCategoryIds.filter(id => !initialCategoryIds.includes(id));
        if (categoriesToRemove.length > 0) { await supabaseClient.from('event_categories').delete().eq('event_id', eventId).in('category_id', categoriesToRemove); }
        if (categoriesToAdd.length > 0) { await supabaseClient.from('event_categories').insert(categoriesToAdd.map(catId => ({ event_id: eventId, category_id: catId }))); }
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
function setupHeader() {
    const themeToggle = document.getElementById('theme-toggle');
    if(themeToggle) {
        const currentTheme = localStorage.getItem('theme');
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.href = '/';
    };

    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
        const profileTrigger = document.getElementById('profile-trigger');
        profileTrigger.onclick = (event) => {
            event.stopPropagation();
            profileDropdown.classList.toggle('open');
        };
    }
    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('open');
        }
    });
}

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
main();
