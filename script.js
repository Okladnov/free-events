// =================================================================
// ГЛОБАЛЬНЫЙ СКРИПТ УПРАВЛЕНИЯ САЙТОМ (script.js)
// =================================================================

// --- 1. Глобальные переменные и инициализация Supabase ---
// Эти переменные будут доступны на всем сайте, потому что script.js
// подключается на каждой странице.

const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co"; // <-- ТВОЙ КЛЮЧ УЖЕ ЗДЕСЬ
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D"; // <-- ТВОЙ КЛЮЧ УЖЕ ЗДЕСЬ

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const currentUser = JSON.parse(localStorage.getItem('user'));


// --- 2. Функция загрузки компонентов (шапка/подвал) ---
// Она асинхронная, чтобы дожидаться загрузки HTML.
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
// Она запускается ПОСЛЕ того, как HTML шапки загружен в DOM.
function initializeHeader() {
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const loginBtn = document.getElementById('loginBtn');
    const adminLink = document.getElementById('admin-link');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameDisplay = document.getElementById('user-name-display');

    if (currentUser) {
        // --- Логика для АВТОРИЗОВАННОГО пользователя ---
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'flex'; // 'flex', чтобы иконка была по центру
        if (addEventBtn) addEventBtn.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.textContent = currentUser.user_metadata.name || 'Профиль';

        // Показываем ссылку на админку, если роль = admin
        if (adminLink && currentUser.user_metadata.role === 'admin') {
            adminLink.style.display = 'block';
        }

        // Вешаем событие на кнопку "Выйти"
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabaseClient.auth.signOut();
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            });
        }
        
        // Логика выпадающего меню профиля
        const profileTrigger = document.getElementById('profile-trigger');
        const profileMenu = document.getElementById('profile-menu');
        if (profileTrigger && profileMenu) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем закрытие меню сразу после открытия
                profileMenu.classList.toggle('active');
            });
        }
    } else {
        // --- Логика для НЕ авторизованного пользователя ---
        if (loginBtn) loginBtn.style.display = 'block';
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (addEventBtn) addEventBtn.style.display = 'none';
    }
    
    // --- Общая логика для всех ---
    // Закрытие меню профиля при клике в любом другом месте экрана
    document.addEventListener('click', (e) => {
        const profileMenu = document.getElementById('profile-menu');
        // Если меню активно и клик был НЕ внутри блока dropdown
        if (profileMenu && profileMenu.classList.contains('active') && !profileDropdown.contains(e.target)) {
            profileMenu.classList.remove('active');
        }
    });

    // Логика переключателя темы
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        // При загрузке страницы проверяем, какая тема была сохранена
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        }
        // Вешаем событие на переключатель
        themeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-theme');
            // Сохраняем выбор пользователя
            localStorage.setItem('theme', themeToggle.checked ? 'dark' : 'light');
        });
    }
}


// --- 4. Точка входа ---
// Этот код запускается, когда DOM-структура страницы готова.
document.addEventListener("DOMContentLoaded", async () => {
    // Шаг 1: Загружаем HTML для шапки
    await loadComponent('main-header', 'header.html');
    
    // Шаг 2: ЗАПУСКАЕМ всю логику, которая находится ВНУТРИ шапки (кнопки, меню и т.д.)
    initializeHeader();
    
    // Шаг 3: Загружаем HTML для подвала
    await loadComponent('main-footer', 'footer.html');
});


// --- 5. Глобальные утилиты (помощники) ---
// Эти функции можно будет вызывать из любого другого скрипта, если нужно
function sanitizeHTML(text) {
    const temp = document.createElement('div');
    if(text) {
      temp.textContent = text;
    }
    return temp.innerHTML;
}

function sanitizeForAttribute(text) {
    if(!text) return "";
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
