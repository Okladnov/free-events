// =================================================================
// ГЛОБАЛЬНЫЙ СКРИПТ УПРАВЛЕНИЯ САЙТОМ
// =================================================================

// Эта функция будет отвечать за всю логику, которая должна быть в хедере
function initializeHeader() {
    // --- Инициализация Supabase (если еще не сделана в app.js) ---
    // Этот код здесь на всякий случай, если app.js не подключен на какой-то странице
    if (!window.supabaseClient) {
        const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // <-- Вставь свой URL
        const SUPABASE_KEY = 'YOUR_SUPABASE_KEY'; // <-- Вставь свой ключ
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    window.currentUser = JSON.parse(localStorage.getItem('user'));


    // --- Логика авторизации и профиля в шапке ---
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const loginBtn = document.getElementById('loginBtn');
    const adminLink = document.getElementById('admin-link');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameDisplay = document.getElementById('user-name-display');

    if (currentUser) {
        // Пользователь вошел в систему
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'flex'; // 'flex' лучше для выравнивания
        if (addEventBtn) addEventBtn.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.textContent = currentUser.user_metadata.name || 'Профиль';

        // Показываем ссылку на админку
        if (adminLink && currentUser.user_metadata.role === 'admin') {
            adminLink.style.display = 'block';
        }

        // Кнопка выхода
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('user');
                // supabaseClient.auth.signOut(); // <-- Раскомментируй для полного выхода
                window.location.href = '/login.html';
            });
        }
        
        // Логика выпадающего меню профиля
        const profileTrigger = document.getElementById('profile-trigger');
        const profileMenu = document.getElementById('profile-menu');
        if (profileTrigger && profileMenu) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation(); // Остановка "всплытия" события
                profileMenu.classList.toggle('active');
            });
        }
    } else {
        // Пользователь не авторизован
        if (loginBtn) loginBtn.style.display = 'block';
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (addEventBtn) addEventBtn.style.display = 'none';
    }
    
    // Закрытие меню профиля при клике вне его
    document.addEventListener('click', (e) => {
        const profileMenu = document.getElementById('profile-menu');
        if (profileMenu && profileMenu.classList.contains('active') && !profileDropdown.contains(e.target)) {
            profileMenu.classList.remove('active');
        }
    });

    // --- Логика переключателя темы ---
    const themeToggle = document.getElementById('theme-toggle');
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

// Эта функция загружает HTML-код из файла в указанный элемент
async function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Не удалось загрузить ${filePath}`);
        const data = await response.text();
        element.innerHTML = data;
    } catch (error) {
        console.error(`Ошибка при загрузке компонента:`, error);
        element.innerHTML = `<p style="color: red;">Ошибка загрузки</p>`;
    }
}

// Главное событие, которое запускает всю магию
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Загружаем HTML для шапки
    await loadComponent('main-header', 'header.html');
    // 2. ЗАПУСКАЕМ всю логику, которая находится ВНУТРИ шапки
    initializeHeader();
    // 3. Загружаем HTML для подвала
    await loadComponent('main-footer', 'footer.html');
});

// Глобальные утилиты для безопасности (доступны везде)
function sanitizeHTML(text) {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

function sanitizeForAttribute(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
