// =================================================================
// app.js - ПОЛНАЯ, ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
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
        // Используем DOMPurify, если он доступен
        return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'a', 'blockquote'] });
    } catch(e) {
        // Если DOMPurify не загружен, просто возвращаем текст (фолбэк)
        return text;
    }
}

function sanitizeForAttribute(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;');
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ШАПКИ (ПРОСТАЯ ВЕРСИЯ)
// =================================================================
async function initializeHeader() {
    const themeToggle = document.getElementById('theme-toggle');
    const loginBtn = document.getElementById('loginBtn');
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const userNameDisplay = document.getElementById('user-name-display');
    const profileMenu = document.getElementById('profile-menu');
    const profileTrigger = document.getElementById('profile-trigger');

    // Настройка темы (остается без изменений)
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

    // Проверка сессии
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    if (currentUser) {
        // Настраиваем UI для залогиненного пользователя
        if (loginBtn) loginBtn.style.display = 'none';
        if (addEventBtn) addEventBtn.style.display = 'block';
        if (profileDropdown) profileDropdown.style.display = 'block';

        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        if (userNameDisplay) {
            const name = (profile && profile.full_name) ? profile.full_name : (currentUser.email ? currentUser.email.split('@')[0] : 'Профиль');
            userNameDisplay.textContent = name;
        }

        // === ПРОСТОЕ МЕНЮ ИЗ 3-Х ПУНКТОВ ===
        // (Проверка на админа остается на будущее, но ссылка не добавляется)
        try {
            const { data: adminStatus } = await supabaseClient.rpc('is_admin');
            isAdmin = adminStatus;
        } catch (e) {
             isAdmin = false;
        }

        const menuHtml = `
            <a href="/profile.html" class="profile-menu-item">Профиль</a>
            <a href="/favorites.html" class="profile-menu-item">Избранное</a>
            <div class="menu-separator"></div>
            <a href="#" class="profile-menu-item" id="logoutBtn">Выйти</a>
        `;
        
        if(profileMenu) profileMenu.innerHTML = menuHtml;
        
    } else {
        // Настраиваем UI для гостя
        if (loginBtn) loginBtn.style.display = 'block';
        if (addEventBtn) addEventBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'none';
    }

    // Обработчики событий
    if (profileMenu) {
        profileMenu.addEventListener('click', async (event) => {
            if (event.target.closest('#logoutBtn')) {
                event.preventDefault();
                await supabaseClient.auth.signOut();
                window.location.reload();
            }
        });
    }
    
    if (addEventBtn) { addEventBtn.onclick = () => { window.location.href = '/edit-event.html'; }; }
    if (profileTrigger) {
        profileTrigger.onclick = (event) => {
            event.stopPropagation();
            if (profileDropdown) { profileDropdown.classList.toggle('open'); }
        };
    }
    
    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('open');
        }
    });
}
