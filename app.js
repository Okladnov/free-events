// =================================================================
// app.js - ФИНАЛЬНАЯ, ИСПРАВЛЕННАЯ ВЕРСИЯ С ПРАВИЛЬНЫМ КЛЮЧОМ
// =================================================================

// =================================================================
// ГЛОБАЛЬНОЕ ПОДКЛЮЧЕНИЕ И НАСТРОЙКИ
// =================================================================

const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
// ИСПРАВЛЕНО: Возвращен оригинальный, правильный API ключ
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
    const overlay = document.getElementById('login-modal-overlay');
    const openBtn = document.getElementById('loginBtn');
    const closeBtn = document.getElementById('modal-close-btn');
    
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const showSignupBtn = document.getElementById('show-signup-view-btn');
    const showLoginBtn = document.getElementById('show-login-view-btn');

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const googleLoginBtn = document.getElementById('google-login-btn');
    
    const loginErrorMsg = document.getElementById('login-error-message');
    const signupErrorMsg = document.getElementById('signup-error-message');

    if (!overlay || !openBtn || !closeBtn || !showSignupBtn || !showLoginBtn) return;

    openBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });

    showSignupBtn.addEventListener('click', () => {
        loginView.classList.add('hidden');
        signupView.classList.remove('hidden');
    });
    showLoginBtn.addEventListener('click', () => {
        signupView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    googleLoginBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        loginErrorMsg.style.display = 'none';
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user) window.location.reload();
        } catch (error) {
            loginErrorMsg.textContent = 'Неверный email или пароль.';
            loginErrorMsg.style.display = 'block';
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const name = e.target.name.value;
        const password = e.target.password.value;
        const passwordRepeat = e.target['password-repeat'].value;
        signupErrorMsg.style.display = 'none';
        
        if (password !== passwordRepeat) {
            signupErrorMsg.textContent = 'Пароли не совпадают.';
            signupErrorMsg.style.display = 'block';
            return;
        }

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { 
                        full_name: name 
                    }
                }
            });

            if (error) throw error;

            signupView.innerHTML = `<div class="login-modal-form-side"><p>Отлично! Мы отправили ссылку для подтверждения на <strong>${email}</strong>. Перейдите по ней, чтобы активировать аккаунт.</p></div>`;
        } catch (error) {
            signupErrorMsg.textContent = `Ошибка регистрации: ${error.message}`;
            signupErrorMsg.style.display = 'block';
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

    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

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

    if (logoutBtn) logoutBtn.onclick = async () => { await supabaseClient.auth.signOut(); window.location.reload(); };
    if (addEventBtn) addEventBtn.onclick = () => window.location.href = '/edit-event.html';
    
    if (profileTrigger) {
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

    setupLoginModal();
}

// =================================================================
// ТОЧКА ВХОДА
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    initializeHeader();
});
