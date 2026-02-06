// =================================================================
// app.js - ЕДИНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
// =================================================================

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
    try {
        // Используем более разрешающую версию, чтобы форматирование в описаниях работало
        return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'a', 'blockquote'] });
    } catch(e) {
        // Если DOMPurify не загружен, просто возвращаем текст
        return text;
    }
}

function sanitizeForAttribute(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;');
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ШАПКИ
// =================================================================

async function initializeHeader() {
    // Безопасно получаем все элементы шапки в одном месте
    const themeToggle = document.getElementById('theme-toggle');
    const loginBtn = document.getElementById('loginBtn');
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const userNameDisplay = document.getElementById('user-name-display');
    const adminLink = document.getElementById('admin-link');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileTrigger = document.getElementById('profile-trigger');

    // 1. Настройка темы
    if (themeToggle) {
        const currentTheme = localStorage.getItem('theme');
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', function() {
            document.body.classList.toggle('dark-theme', this.checked);
            localStorage.setItem('theme', this.checked ? 'dark' : 'light');
        });
    }

    // 2. Проверка сессии пользователя
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    // 3. Настройка UI в зависимости от сессии (НОВАЯ ЛОГИКА)
    if (currentUser) {
        // Пользователь в системе: ПОКАЗЫВАЕМ нужные элементы, убирая класс hidden
        if (addEventBtn) addEventBtn.classList.remove('hidden');
        if (profileDropdown) profileDropdown.classList.remove('hidden');

        // Запускаем запросы на получение профиля и статуса админа ПАРАЛЛЕЛЬНО
        const [profileResponse, adminResponse] = await Promise.all([
            supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single(),
            supabaseClient.rpc('is_admin')
        ]);
        
        // Обрабатываем результат запроса профиля
        if (profileResponse.error) {
            console.error('Ошибка получения профиля:', profileResponse.error.message);
        }
        if (userNameDisplay) {
            const profile = profileResponse.data;
            const name = (profile && profile.full_name) ? profile.full_name : (currentUser.email ? currentUser.email.split('@')[0] : 'Профиль');
            userNameDisplay.textContent = name;
        }

        // Обрабатываем результат запроса на админа
        if (adminResponse.error) {
            console.error('Ошибка проверки админа:', adminResponse.error.message);
            isAdmin = false;
        } else {
            isAdmin = adminResponse.data;
        }
        
        if (isAdmin && adminLink) {
            adminLink.classList.remove('hidden');
        }

    } else {
        // Пользователь - гость: ПОКАЗЫВАЕМ только кнопку "Войти"
        if (loginBtn) loginBtn.classList.remove('hidden');
    }

    // 4. Настройка обработчиков событий для шапки
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabaseClient.auth.signOut();
            window.location.reload();
        };
    }
    
    if (addEventBtn) {
        addEventBtn.onclick = () => {
            window.location.href = '/edit-event.html';
        };
    }

    // Открытие/закрытие выпадающего меню профиля
    if (profileTrigger) {
        profileTrigger.onclick = (event) => {
            event.stopPropagation();
            if (profileDropdown) {
                profileDropdown.classList.toggle('open');
            }
        };
    }
    
    // Закрытие меню по клику вне его
    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('open');
        }
    });
}
