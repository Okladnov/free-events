// =================================================================
// ГЛОБАЛЬНЫЙ СКРИПТ УПРАВЛЕНИЯ САЙТОМ (script.js) - ЖЕЛЕЗОБЕТОННАЯ ВЕРСИЯ
// =================================================================

// --- 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ ВСЕГО САЙТА ---
// Создаем один клиент Supabase и делаем его доступным для всех (через window)
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.currentUser = null; // Пользователь будет определен позже

let appReadyFired = false; // Флаг, чтобы главный сигнал сработал только один раз

// --- 2. ГЛАВНАЯ ЛОГИКА ЗАПУСКА ---
document.addEventListener("DOMContentLoaded", async () => {
    // Проверка: Если это страница логина - этот скрипт не работает.
    if (document.body.classList.contains('login-page-body')) {
        return; 
    }

    // Загружаем HTML-каркас
    await loadComponent('main-header', 'header.html');
    await loadComponent('main-footer', 'footer.html');

    // Вешаем главный слушатель аутентификации
    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
        const user = session ? session.user : null;
        window.currentUser = user; // Обновляем глобальную переменную

        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
        
        // Настраиваем шапку с правильным пользователем
        initializeHeader(user);

        // "КРИЧИМ" ВСЕМУ САЙТУ: "ПРИЛОЖЕНИЕ ГОТОВО!"
        // Этот сигнал услышат app.js, profile.js и другие.
        if (!appReadyFired) {
            document.dispatchEvent(new CustomEvent('appReady'));
            appReadyFired = true;
        }
    });
});


// --- 3. Функция настройки шапки ---
function initializeHeader(user) {
    // Эта функция настраивает кнопки, меню и тему в шапке
    // ... (код этой функции не менялся, он работает правильно)
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const loginBtn = document.getElementById('loginBtn');
    const adminLink = document.getElementById('admin-link');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameDisplay = document.getElementById('user-name-display');
    const profileTrigger = document.getElementById('profile-trigger');
    const profileMenu = document.getElementById('profile-menu');
    const themeToggle = document.getElementById('theme-toggle');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'flex';
        if (addEventBtn) addEventBtn.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.textContent = user.user_metadata.name || 'Профиль';
        if (adminLink && user.user_metadata.role === 'admin') { adminLink.style.display = 'block'; }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await window.supabaseClient.auth.signOut();
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            });
        }
        if (profileTrigger && profileMenu) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                profileMenu.classList.toggle('active');
            });
        }
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (addEventBtn) addEventBtn.style.display = 'none';
    }
    document.addEventListener('click', (e) => {
        if (profileMenu && profileMenu.classList.contains('active') && !profileDropdown.contains(e.target)) {
            profileMenu.classList.remove('active');
        }
    });
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


// --- 4. Вспомогательные и глобальные функции ---
async function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Network response was not ok for ${filePath}`);
        const data = await response.text();
        element.innerHTML = data;
    } catch (error) {
        console.error(`Ошибка при загрузке компонента ${filePath}:`, error);
    }
}

function sanitizeHTML(text) {
    const temp = document.createElement('div');
    if (text) { temp.textContent = text; }
    return temp.innerHTML;
}

function sanitizeForAttribute(text) {
    if (!text) return "";
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
