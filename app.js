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
    // Более строгая версия для карточек, более мягкая для описаний будет на странице event.js
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
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
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('add-event-modal-btn').style.display = 'block';
        document.getElementById('profile-dropdown').style.display = 'block';

        // Получаем и отображаем имя
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        const userName = (profile && profile.full_name) ? profile.full_name : currentUser.email.split('@')[0];
        document.getElementById('user-name-display').textContent = userName;

        // Проверяем, админ ли, и показываем ссылку
        const { data: adminStatus } = await supabaseClient.rpc('is_admin');
        isAdmin = adminStatus;
        if (isAdmin) {
            document.getElementById('admin-link').style.display = 'block';
        }
    } else {
        // Пользователь - гость
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('add-event-modal-btn').style.display = 'none';
        document.getElementById('profile-dropdown').style.display = 'none';
    }

    // 4. Настройка обработчиков событий для шапки
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    const addEventBtn = document.getElementById('add-event-modal-btn');
    if(addEventBtn) {
        addEventBtn.onclick = () => {
            window.location.href = '/edit-event.html';
        };
    }

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
if (document.body.classList.contains('hide-search')) {
        document.querySelector('.search-container').style.display = 'none';
    }
}
