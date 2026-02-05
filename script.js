// =================================================================
// ГЛОБАЛЬНЫЙ СКРИПТ УПРАВЛЕНИЯ САЙТОМ (script.js) - ВЕРСИЯ С AUTH LISTENER
// =================================================================

const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// УБРАЛИ currentUser отсюда, он будет определяться динамически

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
        element.innerHTML = `<p style="text-align:center; color:red;">Ошибка загрузки</p>`;
    }
}

// ИЗМЕНЕНИЕ: Теперь функция принимает user как аргумент
function initializeHeader(user) {
    // Эта переменная теперь локальная для функции
    const currentUser = user; 
    
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const loginBtn = document.getElementById('loginBtn');
    const adminLink = document.getElementById('admin-link');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameDisplay = document.getElementById('user-name-display');
    const profileTrigger = document.getElementById('profile-trigger');
    const profileMenu = document.getElementById('profile-menu');
    const themeToggle = document.getElementById('theme-toggle');

    if (currentUser) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'flex';
        if (addEventBtn) addEventBtn.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.textContent = currentUser.user_metadata.name || 'Профиль';
        if (adminLink && currentUser.user_metadata.role === 'admin') {
            adminLink.style.display = 'block';
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabaseClient.auth.signOut();
                localStorage.removeItem('user'); // На всякий случай
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

document.addEventListener("DOMContentLoaded", async () => {
    // Мы больше не вызываем initializeHeader() здесь,
    // но продолжаем загружать компоненты
    await loadComponent('main-header', 'header.html');
    await loadComponent('main-footer', 'footer.html');
    
    // "Кричим", что HTML-каркас готов.
    // Это нужно, чтобы onAuthStateChange не сработал раньше, чем появится #main-header
    document.dispatchEvent(new CustomEvent('htmlComponentsLoaded'));
});

// НОВЫЙ ПОДХОД: Слушаем изменения состояния аутентификации
// Ждем, пока загрузятся HTML-компоненты
document.addEventListener('htmlComponentsLoaded', () => {
    // Теперь вешаем слушатель Supabase
    supabaseClient.auth.onAuthStateChange((event, session) => {
        const user = session ? session.user : null;
        
        // ВАЖНО: обновляем глобальную переменную для других скриптов
        window.currentUser = user; 
        
        if (user) {
          // Также сохраняем в localStorage, чтобы при F5 не было "мигания"
          localStorage.setItem('user', JSON.stringify(user));
        } else {
          localStorage.removeItem('user');
        }

        // Вызываем настройку шапки с актуальным пользователем
        initializeHeader(user);
    });
});


function sanitizeHTML(text) {
    const temp = document.createElement('div');
    if (text) { temp.textContent = text; }
    return temp.innerHTML;
}

function sanitizeForAttribute(text) {
    if (!text) return "";
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
