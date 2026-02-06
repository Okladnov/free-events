// =================================================================
// app.js - ВЕРСИЯ С ИСПРАВЛЕНИЕМ ПЕРЕКЛЮЧАТЕЛЯ ТЕМЫ
// =================================================================

// =================================================================
// ГЛОБАЛЬНОЕ ПОДКЛЮЧЕНИЕ И НАСТРОЙКИ
// =================================================================

const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Глобальные переменные
let currentUser = null;
let isAdmin = false;

// =================================================================
// ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =================================================================

function sanitizeHTML(text) {
    if (!text) return '';
    try {
        return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'a', 'blockquote'] });
    } catch(e) {
        return text;
    }
}

// =================================================================
// ЛОГИКА РАБОТЫ МОДАЛЬНОГО ОКНА
// =================================================================

function setupLoginModal() {
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const loginBtn = document.getElementById('loginBtn');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('modal-error-message');

    if (!loginModalOverlay || !loginBtn || !closeModalBtn || !loginForm) {
        return;
    }

    loginBtn.addEventListener('click', () => loginModalOverlay.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => loginModalOverlay.classList.add('hidden'));
    loginModalOverlay.addEventListener('click', (event) => {
        if (event.target === loginModalOverlay) loginModalOverlay.classList.add('hidden');
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        errorMessage.style.display = 'none';

        try {
            const { error } = await supabaseClient.auth.signInWithOtp({
                email: email,
                options: { emailRedirectTo: window.location.origin },
            });

            if (error) throw error;
            
            loginForm.innerHTML = `<p>Отлично! Мы отправили ссылку для входа на <strong>${email}</strong>. Пожалуйста, проверьте вашу почту.</p>`;
        } catch (error) {
            console.error('Ошибка входа:', error.message);
            errorMessage.textContent = `Ошибка: ${error.message}`;
            errorMessage.style.display = 'block';
        }
    });
}

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ШАПКИ
// =================================================================

async function initializeHeader() {
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

    // 3. Настройка UI
    if (currentUser) {
        if (addEventBtn) addEventBtn.classList.remove('hidden');
        if (profileDropdown) profileDropdown.classList.remove('hidden');

        const [profileResponse, adminResponse] = await Promise.all([
            supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single(),
            supabaseClient.rpc('is_admin')
        ]);
        
        if (profileResponse.error) console.error('Ошибка получения профиля:', profileResponse.error.message);
        if (userNameDisplay) {
            const profile = profileResponse.data;
            const name = (profile && profile.full_name) ? profile.full_name : (currentUser.email ? currentUser.email.split('@')[0] : 'Профиль');
            userNameDisplay.textContent = name;
        }

        isAdmin = adminResponse.data;
        if (adminResponse.error) {
            console.error('Ошибка проверки админа:', adminResponse.error.message);
            isAdmin = false;
        }
        if (isAdmin && adminLink) adminLink.classList.remove('hidden');

    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
    }

    // 4. Настройка обработчиков
    if (logoutBtn) logoutBtn.onclick = async () => { await supabaseClient.auth.signOut(); window.location.reload(); };
    if (addEventBtn) addEventBtn.onclick = () => window.location.href = '/edit-event.html';
    if (profileTrigger) profileTrigger.onclick = (event) => { event.stopPropagation(); profileDropdown.classList.toggle('open'); };
    
    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target)) profileDropdown.classList.remove('open');
    });

    // 5. Инициализируем логику модального окна
    setupLoginModal();
}

// =================================================================
// ТОЧКА ВХОДА ДЛЯ APP.JS (ИСПРАВЛЕНИЕ)
// =================================================================
// Запускаем весь наш код только тогда, когда страница полностью загружена.
document.addEventListener('DOMContentLoaded', () => {
    initializeHeader();
});
