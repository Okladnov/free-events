// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ ВХОДА - login.html (ПОЛНОСТЬЮ АВТОНОМНАЯ ВЕРСИЯ)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Инициализация Supabase (ТОЛЬКО для этой страницы) ---
    const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
    const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
    // Используем 'supabase.createClient', так как 'supabase' - глобальный объект из CDN
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- 2. Элементы страницы ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const googleLoginBtnLogin = document.getElementById('google-login-btn-login');
    const googleLoginBtnRegister = document.getElementById('google-login-btn-register');
    const toggleToRegisterBtn = document.getElementById('toggle-to-register-btn');
    const toggleToLoginBtn = document.getElementById('toggle-to-login-btn');
    
    // --- 3. Проверка сессии ---
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.location.href = '/';
        }
    });
    
    // --- 4. Обработчик входа через Google ---
    async function signInWithGoogle() {
        await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
    }

    googleLoginBtnRegister.addEventListener('click', signInWithGoogle);
    googleLoginBtnLogin.addEventListener('click', signInWithGoogle);

    // --- 5. Остальные обработчики ---
    toggleToRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    toggleToLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const registerMessage = document.getElementById('register-message');
        const submitButton = registerForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        registerMessage.textContent = 'Создаем аккаунт...';
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: name } } });
            if (error) throw error;
            if (data.user && data.user.identities.length === 0) {
                 registerMessage.textContent = '✅ Успешно! Проверьте вашу почту для подтверждения.';
            } else {
                registerMessage.textContent = '✅ Успешно! Входим...';
                setTimeout(() => { window.location.href = '/'; }, 1500);
            }
        } catch (error) {
            registerMessage.textContent = `Ошибка: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loginMessage = document.getElementById('login-message');
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        loginMessage.textContent = 'Выполняем вход...';
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.href = '/';
        } catch (error) {
            loginMessage.textContent = `Ошибка: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });
});
