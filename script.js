// =================================================================
// ГЛОБАЛЬНЫЙ СКРИПТ УПРАВЛЕНИЯ САЙТОМ (script.js) - ИСПРАВЛЕННЫЙ
// =================================================================

// --- 1. Глобальные переменные и инициализация Supabase ---
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const currentUser = JSON.parse(localStorage.getItem('user'));

// --- 2. Функция загрузки компонентов (шапка/подвал) ---
async function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);
    if (!element) return; // Если на странице нет такого блока, выходим
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Network response was not ok for ${filePath}`);
        const data = await response.text();
        element.innerHTML = data;
    } catch (error) {
        console.error(`Ошибка при загрузке компонента ${filePath}:`, error);
        element.innerHTML = `<p style="text-align:center; color:red;">Ошибка загрузки блока</p>`;
    }
}

// --- 3. Главная функция для настройки шапки ---
function initializeHeader() {
    // Получаем все элементы шапки
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const loginBtn = document.getElementById('loginBtn');
    const adminLink = document.getElementById('admin-link');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameDisplay = document.getElementById('user-name-display');
    const profileTrigger = document.getElementById('profile-trigger');
    const profileMenu = document.getElementById('profile-menu');
    const themeToggle = document.getElementById('theme-toggle');

    // Настраиваем UI в зависимости от авторизации
    if (currentUser) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'flex';
        if (addEventBtn) addEventBtn.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.textContent = currentUser.user_metadata.name || 'Профиль';

        // Показываем админку, если есть роль
        if (adminLink && currentUser.user_metadata.role === 'admin') {
            adminLink.style.display = 'block';
        }

        // Кнопка "Выйти"
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabaseClient.auth.signOut();
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            });
        }
        
        // Выпадающее меню профиля
        if (profileTrigger && profileMenu) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                profileMenu.classList.toggle('active');
            });
        }
    } else {
        // Если пользователь не авторизован
        if (loginBtn) loginBtn.style.display = 'block';
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (addEventBtn) addEventBtn.style.display = 'none';
    }

    // Закрытие меню при клике вне его (для всех)
    document.addEventListener('click', (e) => {
        if (profileMenu && profileMenu.classList.contains('active') && !profileDropdown.contains(e.target)) {
            profileMenu.classList.remove('active');
        }
    });

    // Переключатель темы (для всех)
    if (themeToggle) {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-theme');
            localStorage.setItem('theme', themeToggle.checked ? 'dark' : 'light');
        });
    }
}

// --- 4. Точка входа ---
document.addEventListener("DOMContentLoaded", async () => {
    // Шаг 1: Загружаем HTML шапки
    await loadComponent('main-header', 'header.html');
    
    // Шаг 2: Настраиваем всю логику внутри шапки
    initializeHeader();
    
    // Шаг 3: Загружаем HTML подвала
    await loadComponent('main-footer', 'footer.html');
    
    // Шаг 4: "КРИЧИМ", ЧТО ВСЕ ГОТОВО!
    // Это событие услышат app.js, profile.js и другие скрипты.
    document.dispatchEvent(new CustomEvent('headerLoaded'));
});


// --- 5. Глобальные утилиты (помощники) ---
function sanitizeHTML(text) {
    const temp = document.createElement('div');
    if (text) {
      temp.textContent = text;
    }
    return temp.innerHTML;
}

function sanitizeForAttribute(text) {
    if (!text) return "";
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
