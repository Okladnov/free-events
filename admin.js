// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const unapprovedContainer = document.getElementById('unapproved-events');
let currentUser = null; // Для проверки доступа

// =================================================================
// ФУНКЦИЯ БЕЗОПАСНОСТИ
// =================================================================
function sanitizeHTML(text) {
    if (!text) return '';
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li'] });
}

// =================================================================
// ГЛАВНАЯ ЛОГИКА - ОБНОВЛЕННАЯ
// =================================================================
async function main() {
    setupEventListeners(); // Сначала настраиваем всю шапку

    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Если пользователь не вошел, показываем ошибку и останавливаемся
        showAccessDenied();
        // Скрываем меню профиля и показываем кнопку входа
        document.getElementById('profile-dropdown').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'inline-block';
        return;
    }

    // Если пользователь вошел, настраиваем интерфейс
    currentUser = session.user;
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('profile-dropdown').style.display = 'block';

    const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
    const userName = (profile && profile.full_name) ? profile.full_name : currentUser.email.split('@')[0];
    document.getElementById('user-name-display').textContent = userName;
    
    // Проверяем, админ ли пользователь
    const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('is_admin');
    
    if (rpcError || !isAdmin) {
        showAccessDenied();
        return;
    }
    
    // Если все проверки пройдены, показываем контент админа
    document.getElementById('admin-link').style.display = 'block'; // Показываем ссылку на админку в меню
    loadUnapprovedEvents();
}

// =================================================================
// СТАНДАРТНАЯ ЛОГИКА ШАПКИ
// =================================================================
function setupEventListeners() {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if(themeToggle) themeToggle.checked = true;
    }
    if(themeToggle) {
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
        window.location.reload();
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
// СПЕЦИФИЧНАЯ ЛОГИКА АДМИНКИ (без изменений)
// =================================================================

function showAccessDenied() {
    unapprovedContainer.innerHTML = '<h2>⛔ Доступ запрещен</h2><p>Эта страница доступна только для администраторов. <a href="/">На главную</a></p>';
}

async function loadUnapprovedEvents() {
    unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
    
    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

    if (error) {
        unapprovedContainer.innerHTML = `<p style="color: red;">Ошибка загрузки: ${error.message}. <br>Это может быть из-за "холодного старта" базы данных. <b>Пожалуйста, обновите страницу через 15 секунд.</b></p>`;
        return;
    }
    
    if (!events || events.length === 0) {
        unapprovedContainer.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
        return;
    }
    
    unapprovedContainer.innerHTML = '';
    events.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = 'admin-event-card';
        
        eventCard.innerHTML = `
            <h4>${sanitizeHTML(event.title)}</h4>
            <p>${sanitizeHTML(event.description) || 'Нет описания.'}</p>
            <p><a href="event.html?id=${event.id}" target="_blank">Посмотреть на детальной странице →</a></p>
            <button onclick="approveEvent(${event.id}, this)">Одобрить</button>
        `;
        unapprovedContainer.appendChild(eventCard);
    });
}

window.approveEvent = async function(eventId, buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Одобряем...';
    const { error } = await supabaseClient.from('events').update({ is_approved: true }).eq('id', eventId);
    if (error) {
        alert('Не удалось одобрить событие.');
        buttonElement.disabled = false;
    } else {
        buttonElement.closest('.admin-event-card').remove();
        // Проверяем, не пуст ли контейнер после удаления
        if (unapprovedContainer.children.length === 0) {
            unapprovedContainer.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
        }
    }
};

// =================================================================
// ПЕРВЫЙ ЗАПУСК
// =================================================================
main();

