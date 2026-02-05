// =================================================================
// ГЛОБАЛЬНОЕ ПОДКЛЮЧЕНИЕ И НАСТРОЙКИ
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Глобальные переменные, которые будут доступны на всех страницах
let currentUser = null;
let isAdmin = false;

// =================================================================
// ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================
function sanitizeHTML(text) {
    if (!text) return '';
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'a', 'blockquote'] });
}

function sanitizeForAttribute(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;');
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ШАПКИ (ВЫЗЫВАЕТСЯ НА КАЖДОЙ СТРАНИЦЕ)
// =================================================================
async function initializeHeader() {
    // 1. Настройка переключателя темы
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.checked = true;
    }
    if (themeToggle) {
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

    // 2. Проверка сессии пользователя
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    // 3. Настройка интерфейса в зависимости от того, вошел ли пользователь
    if (currentUser) {
        // Пользователь в системе
        const loginBtn = document.getElementById('loginBtn');
        const addEventBtn = document.getElementById('add-event-modal-btn');
        const profileDropdown = document.getElementById('profile-dropdown');
        if (loginBtn) loginBtn.style.display = 'none';
        if (addEventBtn) addEventBtn.style.display = 'block';
        if (profileDropdown) profileDropdown.style.display = 'block';

        // Получаем и отображаем имя
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        const userName = (profile && profile.full_name) ? profile.full_name : (currentUser.email ? currentUser.email.split('@')[0] : 'Профиль');
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay) userNameDisplay.textContent = userName;

        // Проверяем, админ ли, и показываем ссылку
        try {
            const { data: adminStatus } = await supabaseClient.rpc('is_admin');
            isAdmin = adminStatus;
            const adminLink = document.getElementById('admin-link');
            if (isAdmin && adminLink) {
                adminLink.style.display = 'block';
            }
        } catch (e) {
            isAdmin = false; // Если rpc не сработал, считаем что не админ
        }

    } else {
        // Пользователь - гость
        const loginBtn = document.getElementById('loginBtn');
        const addEventBtn = document.getElementById('add-event-modal-btn');
        const profileDropdown = document.getElementById('profile-dropdown');
        if (loginBtn) loginBtn.style.display = 'block';
        if (addEventBtn) addEventBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'none';
    }

    // 4. Настройка обработчиков событий для шапки
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    const addEventModalBtn = document.getElementById('add-event-modal-btn');
    if(addEventModalBtn) {
        addEventModalBtn.onclick = () => {
            window.location.href = '/edit-event.html';
        };
    }

    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
        const profileTrigger = document.getElementById('profile-trigger');
        if (profileTrigger) {
            profileTrigger.onclick = (event) => {
                event.stopPropagation();
                profileDropdown.classList.toggle('open');
            };
        }
    }
    document.addEventListener('click', (event) => {
        const profileDropdownEl = document.getElementById('profile-dropdown');
        if (profileDropdownEl && !profileDropdownEl.contains(event.target)) {
            profileDropdownEl.classList.remove('open');
        }
    });

    // 5. [ИСПРАВЛЕНИЕ] Скрываем поиск, если нужно
    if (document.body.classList.contains('hide-search')) {
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.style.display = 'none';
        }
    }
}
