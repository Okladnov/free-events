// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// =================================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ОЧИСТКА HTML
// =================================================================
function sanitizeHTML(text) {
    return DOMPurify.sanitize(text, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'],
    });}

function sanitizeForAttribute(text) {
    if (!text) return '';
    // Эта функция заменяет кавычки на их безопасный HTML-эквивалент
    return text.toString().replace(/"/g, '&quot;');
}

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const editFormContainer = document.getElementById('edit-form-container');
const message = document.getElementById("message");
let currentUser = null;

// =================================================================
// АВТОРИЗАЦИЯ
// =================================================================
window.loginWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); };
window.logout = async function() { await supabaseClient.auth.signOut(); };

supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('user-info');

    loginBtn.style.display = session ? 'none' : 'block';
    logoutBtn.style.display = session ? 'block' : 'none';
    userInfo.textContent = session ? `Вы вошли как: ${session.user.email}` : '';

    if (currentUser) {
        loadEventForEdit();
    } else {
        editFormContainer.innerHTML = '<h2>Доступ запрещен</h2><p>Пожалуйста, <a href="#" onclick="loginWithGoogle(); return false;">войдите в свой аккаунт</a>, чтобы редактировать события.</p>';
    }
});

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: ЗАГРУЗКА И ОТОБРАЖЕНИЕ ФОРМЫ
// =================================================================
async function loadEventForEdit() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) {
        message.textContent = "Ошибка: ID события не найден.";
        return;
    }

    // Параллельно загружаем данные события и все категории
    const [
        { data: event, error: eventError },
        { data: allCategories, error: categoriesError }
    ] = await Promise.all([
        supabaseClient.from('events').select('*, event_categories(category_id)').eq('id', eventId).single(),
        supabaseClient.from('categories').select('*').order('name')
    ]);
    
    if (eventError || !event) {
        document.title = "Событие не найдено";
        message.innerHTML = `<p style="color: red;">Событие не найдено или произошла ошибка.</p>`;
        return;
    }

    if (categoriesError) {
        console.error("Ошибка загрузки категорий:", categoriesError);
    }
    
    // Проверяем, является ли текущий юзер автором события
    if (event.created_by !== currentUser.id) {
        document.title = "Доступ запрещен";
        editFormContainer.innerHTML = '<h2>Доступ запрещен</h2><p>Вы не можете редактировать это событие, так как не являетесь его автором.</p><a href="/">На главную</a>';
        return;
    }
    
    document.title = `Редактирование: ${event.title}`;
    
    // Получаем список ID текущих категорий события
    const currentCategoryIds = event.event_categories.map(ec => ec.category_id);

    // Генерируем чекбоксы для всех категорий
    let categoriesCheckboxesHtml = '<p>Выберите категорию:</p>';
    allCategories.forEach(category => {
        const isChecked = currentCategoryIds.includes(category.id) ? 'checked' : '';
        categoriesCheckboxesHtml += `
            <div class="category-checkbox">
                <input type="checkbox" id="cat-form-${category.id}" name="categories" value="${category.id}" ${isChecked}>
                <label for="cat-form-${category.id}">${category.name}</label>
            </div>`;
    });

    // Форматируем дату для input[type=date]
    const eventDate = event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : '';

    // Создаем HTML-код формы
    const formHtml = `
        <h2>✏️ Редактирование события</h2>
        <form id="edit-event-form">
            <input id="title" placeholder="Название события" required value="${event.title || ''}">
            <textarea id="description" placeholder="Описание">${event.description || ''}</textarea>
            <div class="form-row">
                <input id="city" placeholder="Город" value="${event.city || ''}">
                <input id="date" type="date" value="${eventDate}">
            </div>

            <div class="form-row file-input-row">
                <label for="image-input">Заменить изображение (постер, афиша):</label>
                <input id="image-input" type="file" accept="image/*">
            </div>
            ${event.image_url ? `<p>Текущее изображение:</p><img src="${event.image_url}" style="max-width: 200px; border-radius: 8px; margin-bottom: 15px;">` : ''}

            <div class="categories-container">${categoriesCheckboxesHtml}</div>
            
            <button type="submit">Сохранить изменения</button>
            <p id="message"></p>
        </form>
    `;

    editFormContainer.innerHTML = formHtml;
    
    // Навешиваем обработчик на отправку формы
    document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleUpdate(event.id, currentCategoryIds);
    });
}

// =================================================================
// ФУНКЦИЯ ОБНОВЛЕНИЯ ДАННЫХ
// =================================================================
async function handleUpdate(eventId, initialCategoryIds) {
    const submitButton = document.querySelector('#edit-event-form button[type="submit"]');
    const messageEl = document.getElementById("message");
    submitButton.disabled = true;
    messageEl.textContent = "Сохранение...";

    try {
        // 1. Обновляем основные данные события
        const updateData = {
            title: document.getElementById("title").value.trim(),
            description: document.getElementById("description").value.trim(),
            city: document.getElementById("city").value.trim(),
            event_date: document.getElementById("date").value || null,
        };
        const { error: updateError } = await supabaseClient.from('events').update(updateData).match({ id: eventId });
        if (updateError) throw updateError;
        
        // 2. Обновляем изображение, если выбрано новое
        const imageFile = document.getElementById('image-input').files[0];
        if (imageFile) {
            const fileName = `${currentUser.id}/${eventId}_${Date.now()}_${imageFile.name.replace(/\s/g, '-')}`;
            const { error: uploadError } = await supabaseClient.storage.from('event-images').upload(fileName, imageFile, { upsert: true });
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabaseClient.storage.from('event-images').getPublicUrl(fileName);
            const { error: updateImageError } = await supabaseClient.from('events').update({ image_url: publicUrl }).match({ id: eventId });
            if (updateImageError) throw updateImageError;
        }

        // 3. Обновляем категории
        const selectedCategoryIds = Array.from(document.querySelectorAll('#edit-form-container input:checked')).map(cb => Number(cb.value));
        const categoriesToAdd = selectedCategoryIds.filter(id => !initialCategoryIds.includes(id));
        const categoriesToRemove = initialCategoryIds.filter(id => !selectedCategoryIds.includes(id));
        
        if (categoriesToAdd.length > 0) {
            const linksToAdd = categoriesToAdd.map(catId => ({ event_id: eventId, category_id: catId }));
            const { error } = await supabaseClient.from('event_categories').insert(linksToAdd);
            if (error) throw { message: 'Ошибка при добавлении категорий: ' + error.message };
        }
        if (categoriesToRemove.length > 0) {
            const { error } = await supabaseClient.from('event_categories').delete().eq('event_id', eventId).in('category_id', categoriesToRemove);
            if (error) throw { message: 'Ошибка при удалении категорий: ' + error.message };
        }

        messageEl.textContent = "✅ Успешно сохранено! Перенаправляем...";
        setTimeout(() => { window.location.href = `event.html?id=${eventId}`; }, 1500);

    } catch (error) {
        console.error("Ошибка при обновлении:", error);
        messageEl.textContent = `Ошибка: ${error.message}`;
        submitButton.disabled = false;
    }
}
