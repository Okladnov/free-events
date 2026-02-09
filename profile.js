// ===================================================================
// profile.js - ЕДИНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Ждем, пока app.js отработает и определит пользователя
    await initializeHeader();

    // Если пользователь не авторизован, отправляем на главную
    if (!currentUser) {
        alert("Пожалуйста, войдите, чтобы просмотреть свой профиль.");
        window.location.href = '/';
        return;
    }

    // Загружаем данные профиля
    await loadProfileData();

    // Загружаем события, созданные пользователем
    await loadUserEvents();
});

/**
 * Загружает и отображает данные профиля пользователя
 */
async function loadProfileData() {
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        document.getElementById('profile-name').textContent = profile.full_name || 'Ваш профиль';
        document.getElementById('profile-email').textContent = currentUser.email;

        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            profileAvatar.src = profile.avatar_url || 'https://placehold.co/100x100/f0f2f5/ccc?text=AV';
        }

    } catch (error) {
        console.error("Ошибка загрузки данных профиля:", error);
        alert("Произошла ошибка при загрузке данных профиля.");
    }
}

/**
 * Загружает и отображает события, созданные текущим пользователем
 */
async function loadUserEvents() {
    const userEventsContainer = document.getElementById('user-events');
    if (!userEventsContainer) return;

    try {
        const { data: events, error } = await supabaseClient
            .from('events_with_comment_count')
            .select(`*, organizations(name), categories!inner(id, name), profiles(full_name, avatar_url), favorites(user_id)`)
            .eq('created_by', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!events || events.length === 0) {
            userEventsContainer.innerHTML = '<p>Вы еще не создали ни одного события.</p>';
            return;
        }

        userEventsContainer.innerHTML = ""; // Очищаем "Загрузка событий..."
        const cardTemplate = document.getElementById('event-card-template'); // Используем общий шаблон
        if (!cardTemplate) {
            console.error("Шаблон event-card-template не найден!");
            return;
        }

        events.forEach(event => {
            const cardClone = cardTemplate.content.cloneNode(true);
            const cardRoot = cardClone.querySelector('.event-card-v3');

            cardRoot.dataset.eventId = event.id;
            const eventUrl = `/event.html?id=${event.id}`; // Путь к странице события
            cardClone.querySelectorAll('[data-action="go-to-event"]').forEach(el => el.href = eventUrl);
            
            cardClone.querySelector('.card-date').textContent = `Опубликовано ${new Date(event.created_at).toLocaleDateString()}`;
            cardClone.querySelector('.card-title').textContent = event.title;
            cardClone.querySelector('.card-description').textContent = `${(event.description || '').substring(0, 100)}...`;

            const image = cardClone.querySelector('.card-image');
            if (event.image_url) image.src = event.image_url;
            image.alt = event.title;

            const orgLink = cardClone.querySelector('.card-organization');
            const orgPlaceholder = cardClone.querySelector('.card-organization-placeholder');
            if (event.organizations) {
                orgLink.textContent = event.organizations.name;
                orgLink.href = `/?org=${event.organization_id}`;
                orgLink.classList.remove('hidden');
                if(orgPlaceholder) orgPlaceholder.classList.add('hidden');
            }

            const authorName = (event.profiles && event.profiles.full_name) ? event.profiles.full_name : 'Аноним';
            const authorAvatar = (event.profiles && event.profiles.avatar_url) ? event.profiles.avatar_url : 'https://placehold.co/24x24/f0f2f5/ccc';
            cardClone.querySelector('.card-author-name').textContent = authorName;
            cardClone.querySelector('.card-author-avatar').src = authorAvatar;

            cardClone.querySelector('.comment-count').textContent = event.comment_count;
            const isFavorited = currentUser ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
            if (isFavorited) {
                cardClone.querySelector('[data-action="toggle-favorite"]').classList.add('active');
            }

            // На странице профиля всегда показываем кнопки редактирования/удаления для СВОИХ событий
            // (даже если пользователь не админ, это его события)
            const editButton = cardClone.querySelector('[data-action="edit"]');
            const deleteButton = cardClone.querySelector('[data-action="delete"]');
            if (editButton) editButton.classList.remove('hidden');
            if (deleteButton) deleteButton.classList.remove('hidden');
            
            userEventsContainer.appendChild(cardClone);
        });

        // Добавляем обработчики для кнопок "Редактировать" и "Удалить"
        userEventsContainer.addEventListener('click', async (event) => {
            const target = event.target;
            const actionElement = target.closest('[data-action]');
            
            if (!actionElement) return;

            const action = actionElement.dataset.action;
            const card = target.closest('.event-card-v3');
            const eventId = card ? card.dataset.eventId : null;

            if (actionElement.tagName === 'BUTTON') {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!eventId) return;

            switch (action) {
                case 'edit':
                    window.location.href = `/edit-event.html?id=${eventId}`;
                    break;
                case 'delete':
                    // Здесь используем логику удаления из script.js, но можно перенести сюда
                    // Для упрощения, можно вызвать ту же функцию, если она будет глобальной
                    deleteEventHandler(eventId, card); // Эта функция пока из script.js
                    break;
            }
        });

    } catch (error) {
        console.error("Ошибка загрузки событий пользователя:", error);
        userEventsContainer.innerHTML = '<p>Произошла ошибка при загрузке ваших событий.</p>';
    }
}
