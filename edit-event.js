// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ БЕЗОПАСНОСТИ
// =================================================================
function sanitizeForAttribute(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;');
}

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const editFormContainer = document.getElementById('edit-form-container');

// =================================================================
// ГЛАВНАЯ ЛОГИКА
// =================================================================
async function main() {
    // 1. Получаем текущего пользователя
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        showAccessDenied('Пожалуйста, войдите в свой аккаунт, чтобы редактировать события.');
        return;
    }
    const currentUser = session.user;
    
    // Показываем информацию о пользователе
    document.getElementById('user-info').textContent = `Вы вошли как: ${currentUser.email}`;
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('logoutBtn').onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    // 2. Загружаем и отображаем форму
    loadEventForEdit(currentUser);
}

function showAccessDenied(message) {
    editFormContainer.innerHTML = `<h2>Доступ запрещен</h2><p>${message}</p><a href="/">На главную</a>`;
}

// =================================================================
// ЗАГРУЗКА И ОТОБРАЖЕНИЕ ФОРМЫ
// =================================================================
async function loadEventForEdit(currentUser) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) {
        showAccessDenied("ID события не найден.");
        return;
    }

    // [УЛУЧШЕНИЕ 2] Сначала получаем только основную инфу о событии
    const { data: event, error: eventError } = await supabaseClient
        .from('events')
        .select('*, event_categories(category_id)')
        .eq('id', eventId)
        .single();
    
    if (eventError || !event) {
        showAccessDenied("Событие не найдено или произошла ошибка.");
        return;
    }

    // [УЛУЧШЕНИЕ 2] Проверяем авторство СРАЗУ
    const { data: { isAdmin } } = await supabaseClient.rpc('is_admin'); // Проверяем, админ ли
    if (event.created_by !== currentUser.id && !isAdmin) {
        showAccessDenied('Вы не можете редактировать это событие, так как не являетесь его автором.');
        return;
    }
    
    // Только если все проверки пройдены, грузим категории
    const { data: allCategories, error: categoriesError } = await supabaseClient.from('categories').select('*').order('name');
    if (categoriesError) console.error("Ошибка загрузки категорий:", categoriesError);

    document.title = `Редактирование: ${sanitizeForAttribute(event.title)}`;
    
    const currentCategoryIds = event.event_categories.map(ec => ec.category_id);
    let categoriesCheckboxesHtml = '<p>Выберите категорию:</p>';
    (allCategories || []).forEach(category => {
        const isChecked = currentCategoryIds.includes(category.id) ? 'checked' : '';
        categoriesCheckboxesHtml += `<div class="category-checkbox"><input type="checkbox" id="cat-form-${category.id}" name="categories" value="${category.id}" ${isChecked}><label for="cat-form-${category.id}">${category.name}</label></div>`;
    });

    const eventDate = event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : '';
    
    // [УЛУЧШЕНИЕ 1] Применяем sanitizeForAttribute к значениям в форме
    const formHtml = `
        <h2>✏️ Редактирование события</h2>
        <form id="edit-event-form">
            <input id="title" placeholder="Название события" required value="${sanitizeForAttribute(event.title || '')}">
            <textarea id="description" placeholder="Описание">${event.description || ''}</textarea>
            <div class="form-row">
                <input id="city" placeholder="Город" value="${sanitizeForAttribute(event.city || '')}">
                <input id="date" type="date" value="${eventDate}">
            </div>
            <div class="form-row file-input-row">
                <label for="image-input">Заменить изображение:</label>
                <input id="image-input" type="file" accept="image/*">
            </div>
            ${event.image_url ? `<p>Текущее изображение:</p><img src="${event.image_url}" style="max-width: 200px; border-radius: 8px; margin-bottom: 15px;">` : ''}
            <div class="categories-container">${categoriesCheckboxesHtml}</div>
            <button type="submit">Сохранить изменения</button>
            <p id="message"></p>
        </form>
    `;

    editFormContainer.innerHTML = formHtml;
    
    document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleUpdate(event.id, currentCategoryIds, currentUser);
    });
}

// =================================================================
// ФУНКЦИЯ ОБНОВЛЕНИЯ ДАННЫХ
// =================================================================
async function handleUpdate(eventId, initialCategoryIds, currentUser) {
    // ... (весь код внутри handleUpdate остается почти таким же, он хороший)
    const submitButton = document.querySelector('#edit-event-form button[type="submit"]');
    const messageEl = document.getElementById("message");
    submitButton.disabled = true;
    messageEl.textContent = "Сохранение...";

    try {
        const updateData = {
            title: document.getElementById("title").value.trim(),
            description: document.getElementById("description").value.trim(),
            city: document.getElementById("city").value.trim(),
            event_date: document.getElementById("date").value || null,
        };
        const { error: updateError } = await supabaseClient.from('events').update(updateData).match({ id: eventId });
        if (updateError) throw updateError;
        
        const imageFile = document.getElementById('image-input').files[0];
        if (imageFile) {
            const fileName = `${currentUser.id}/${eventId}_${Date.now()}_${imageFile.name.replace(/\s/g, '-')}`;
            const { error: uploadError } = await supabaseClient.storage.from('event-images').upload(fileName, imageFile, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabaseClient.storage.from('event-images').getPublicUrl(fileName);
            await supabaseClient.from('events').update({ image_url: publicUrl }).match({ id: eventId });
        }

        const selectedCategoryIds = Array.from(document.querySelectorAll('#edit-form-container input:checked')).map(cb => Number(cb.value));
        const categoriesToAdd = selectedCategoryIds.filter(id => !initialCategoryIds.includes(id));
        const categoriesToRemove = initialCategoryIds.filter(id => !selectedCategoryIds.includes(id));
        
        if (categoriesToAdd.length > 0) {
            const linksToAdd = categoriesToAdd.map(catId => ({ event_id: eventId, category_id: catId }));
            await supabaseClient.from('event_categories').insert(linksToAdd);
        }
        if (categoriesToRemove.length > 0) {
            await supabaseClient.from('event_categories').delete().eq('event_id', eventId).in('category_id', categoriesToRemove);
        }

        messageEl.textContent = "✅ Успешно сохранено! Перенаправляем...";
        setTimeout(() => { window.location.href = `event.html?id=${eventId}`; }, 1500);

    } catch (error) {
        console.error("Ошибка при обновлении:", error);
        messageEl.textContent = `Ошибка: ${error.message}`;
        submitButton.disabled = false;
    }
}

// ЗАПУСКАЕМ ВСЮ ЛОГИКУ
main();
