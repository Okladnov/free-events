// ===================================================================
// profile.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
// ===================================================================
// Вспомогательная функция для правильных окончаний (1 минута, 2 минуты, 5 минут)
function getNoun(number, one, two, five) {
    let n = Math.abs(number);
    n %= 100;
    if (n >= 5 && n <= 20) {
        return five;
    }
    n %= 10;
    if (n === 1) {
        return one;
    }
    if (n >= 2 && n <= 4) {
        return two;
    }
    return five;
}

// Главная функция для форматирования "Опубликовано ... назад"
function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    
    if (seconds < 60) {
        return "Опубликовано только что";
    }
    let interval = seconds / 31536000;
    if (interval > 1) {
        const years = Math.floor(interval);
        return `Опубликовано ${years} ${getNoun(years, 'год', 'года', 'лет')} назад`;
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        const months = Math.floor(interval);
        return `Опубликовано ${months} ${getNoun(months, 'месяц', 'месяца', 'месяцев')} назад`;
    }
    interval = seconds / 86400;
    if (interval > 1) {
        const days = Math.floor(interval);
        return `Опубликовано ${days} ${getNoun(days, 'день', 'дня', 'дней')} назад`;
    }
    interval = seconds / 3600;
    if (interval > 1) {
        const hours = Math.floor(interval);
        return `Опубликовано ${hours} ${getNoun(hours, 'час', 'часа', 'часов')} назад`;
    }
    interval = seconds / 60;
    if (interval > 1) {
        const minutes = Math.floor(interval);
        return `Опубликовано ${minutes} ${getNoun(minutes, 'минуту', 'минуты', 'минут')} назад`;
    }
    return `Опубликовано ${Math.floor(seconds)} ${getNoun(seconds, 'секунду', 'секунды', 'секунд')} назад`;
}
document.addEventListener('DOMContentLoaded', async () => {
    await initializeHeader();

    if (!currentUser) {
        // Имитируем клик по кнопке "Войти" из шапки, чтобы открыть модальное окно
        document.getElementById('loginBtn').click();
        
        // Заменяем контент страницы сообщением
        const mainContainer = document.querySelector('main.container');
        if (mainContainer) {
            mainContainer.innerHTML = '<h2>Для просмотра профиля необходимо войти</h2><p>Пожалуйста, войдите в свой аккаунт, чтобы увидеть эту страницу.</p>';
        }
        return;
    }

    await loadProfileData();
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
            .from('events_with_details')
            .select(`*, favorites(user_id)`)
            .eq('created_by', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!events || events.length === 0) {
            userEventsContainer.innerHTML = '<p>Вы еще не создали ни одного события.</p>';
            return;
        }

        userEventsContainer.innerHTML = "";
        
        const cardTemplate = document.getElementById('event-card-template');
        if (!cardTemplate) {
            console.error("Шаблон event-card-template не найден!");
            return;
        }

        events.forEach(event => {
            const cardClone = cardTemplate.content.cloneNode(true);
            const cardRoot = cardClone.querySelector('.event-card-v3');
            cardRoot.dataset.eventId = event.id;
            const eventUrl = `/event.html?id=${event.id}`;
            cardClone.querySelectorAll('[data-action="go-to-event"]').forEach(el => el.href = eventUrl);
            
            // Используем ту же логику, что и на главной
            const timeAgoText = timeAgo(event.created_at);
            cardClone.querySelector('.card-date').textContent = timeAgoText;
            
            cardClone.querySelector('.card-title').textContent = event.title;
            
            const descriptionEl = cardClone.querySelector('.card-description');
            if (event.event_date) {
                const startDate = new Date(event.event_date).toLocaleString('ru-RU', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
                descriptionEl.innerHTML = `<strong>Начало события:</strong> ${startDate}`;
            } else {
                descriptionEl.remove();
            }

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

            const authorWrapper = cardClone.querySelector('.card-author');
            const authorLink = document.createElement('a');
            authorLink.href = `/profile.html?id=${event.created_by}`;
            authorLink.classList.add('card-author-link');
            authorLink.innerHTML = `
                <img src="${event.avatar_url || 'https://placehold.co/24x24/f0f2f5/ccc'}" alt="${event.full_name || 'Аноним'}" class="card-author-avatar">
                <span class="card-author-name">${event.full_name || 'Аноним'}</span>
            `;
            authorWrapper.innerHTML = '';
            authorWrapper.appendChild(authorLink);
            
            cardClone.querySelector('.comment-count').textContent = event.comment_count || 0;

            const isFavorited = currentUser && event.favorites ? event.favorites.some(fav => fav.user_id === currentUser.id) : false;
            if (isFavorited) {
                cardClone.querySelector('[data-action="toggle-favorite"]').classList.add('active');
            }
            
            // На странице профиля всегда показываем кнопки
            const editButton = cardClone.querySelector('[data-action="edit"]');
            const deleteButton = cardClone.querySelector('[data-action="delete"]');
            if (editButton) editButton.classList.remove('hidden');
            if (deleteButton) deleteButton.classList.remove('hidden');
            
            userEventsContainer.appendChild(cardClone);
        });

        // Делегируем обработку кнопок
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
