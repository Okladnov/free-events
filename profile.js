// ===================================================================
// profile.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
        // ИЗМЕНЕНО: Обращаемся к новому представлению 'events_with_details'
        const { data: events, error } = await supabaseClient
            .from('events_with_details')
            .select(`*, favorites(user_id)`) // Запрашиваем всё, что нужно
            .eq('created_by', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!events || events.length === 0) {
            userEventsContainer.innerHTML = '<p>Вы еще не создали ни одного события.</p>';
            return;
        }

        userEventsContainer.innerHTML = ""; // Очищаем "Загрузка событий..."
        
        // ШАБЛОН event-card-template должен быть на странице profile.html. 
        // Если его там нет, этот код не сработает.
        // Мы добавим его в HTML на следующем шаге.
        const cardTemplate = document.createElement('template');
        cardTemplate.innerHTML = `
            <div class="event-card-v3" data-event-id="">
                <div class="card-header"><span class="card-date"></span></div>
                <div class="card-body">
                    <a href="#" class="card-image-link" data-action="go-to-event"><img src="https://placehold.co/250x250/f0f2f5/ff6a00?text=Нет+фото" alt="" class="card-image"></a>
                    <div class="card-content">
                        <a href="#" class="card-organization hidden"></a>
                        <div class="card-organization-placeholder"></div>
                        <a href="#" class="card-title-link" data-action="go-to-event"><h3 class="card-title"></h3></a>
                        <p class="card-description"></p>
                        <div class="card-author">
                            <img src="https://placehold.co/24x24/f0f2f5/ccc" alt="avatar" class="card-author-avatar">
                            <span class="card-author-name"></span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="card-actions">
                        <button class="action-btn" data-action="toggle-favorite">
                            <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                            <span>Избранное</span>
                        </button>
                        <div class="action-btn">
                            <svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"></path></svg>
                            <span class="comment-count">0</span>
                        </div>
                        <button class="action-btn hidden" data-action="edit" title="Редактировать"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg></button>
                        <button class="action-btn hidden" data-action="delete" title="Удалить"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg></button>
                    </div>
                    <a href="#" class="card-main-link btn btn--primary" data-action="go-to-event">К событию</a>
                </div>
            </div>
        `;

        events.forEach(event => {
            const cardClone = cardTemplate.content.cloneNode(true);
            // ... (далее вся логика заполнения карточки, она идентична script.js)
            const cardRoot = cardClone.querySelector('.event-card-v3');
            cardRoot.dataset.eventId = event.id;
            const eventUrl = `/event.html?id=${event.id}`;
            cardClone.querySelectorAll('[data-action="go-to-event"]').forEach(el => el.href = eventUrl);
            
            cardClone.querySelector('.card-date').textContent = `Опубликовано ${new Date(event.created_at).toLocaleDateString()}`;
            cardClone.querySelector('.card-title').textContent = event.title;
            cardClone.querySelector('.card-description').textContent = `${(event.description || '').substring(0, 100)}...`;
            
            const image = cardClone.querySelector('.card-image');
            if (event.image_url) image.src = event.image_url;
            image.alt = event.title;

            const orgLink = cardClone.querySelector('.card-organization');
            const orgPlaceholder = cardClone.querySelector('.card-organization-placeholder');
            if (event.organization_name) {
                orgLink.textContent = event.organization_name;
                orgLink.href = `/?org=${event.organization_id}`;
                orgLink.classList.remove('hidden');
                if(orgPlaceholder) orgPlaceholder.classList.add('hidden');
            }

            const authorName = event.full_name || 'Аноним';
            const authorAvatar = event.avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc';
            cardClone.querySelector('.card-author-name').textContent = authorName;
            cardClone.querySelector('.card-author-avatar').src = authorAvatar;
            
            cardClone.querySelector('.comment-count').textContent = event.comment_count;

            const isFavorited = currentUser && event.favorites ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
            if (isFavorited) {
                cardClone.querySelector('[data-action="toggle-favorite"]').classList.add('active');
            }

            // На странице профиля всегда показываем кнопки редактирования/удаления
            const editButton = cardClone.querySelector('[data-action="edit"]');
            const deleteButton = cardClone.querySelector('[data-action="delete"]');
            if (editButton) editButton.classList.remove('hidden');
            if (deleteButton) deleteButton.classList.remove('hidden');
            
            userEventsContainer.appendChild(cardClone);
        });

        // Делегируем обработку кнопок на контейнер
        userEventsContainer.addEventListener('click', async (event) => {
            const actionElement = event.target.closest('[data-action]');
            if (!actionElement) return;

            const action = actionElement.dataset.action;
            const card = event.target.closest('.event-card-v3');
            const eventId = card ? card.dataset.eventId : null;

            if (action === 'edit' && eventId) {
                window.location.href = `/edit-event.html?id=${eventId}`;
            }
            if (action === 'delete' && eventId) {
                if (!confirm('Вы уверены, что хотите удалить это событие?')) return;
                card.style.opacity = '0.5';
                const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
                if (error) {
                    alert('Ошибка удаления.');
                    console.error('Ошибка удаления:', error.message);
                    card.style.opacity = '1';
                } else {
                    card.remove();
                }
            }
        });

    } catch (error) {
        console.error("Ошибка загрузки событий пользователя:", error);
        userEventsContainer.innerHTML = `<p>Произошла ошибка при загрузке ваших событий. ${error.message}</p>`;
    }
}
