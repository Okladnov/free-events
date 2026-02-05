// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ ВХОДА - login.html (САМОСТОЯТЕЛЬНАЯ ВЕРСИЯ)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Элементы страницы ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');
    const toggleToRegisterBtn = document.getElementById('toggle-to-register-btn');
    const toggleToLoginBtn = document.getElementById('toggle-to-login-btn');
    const googleLoginBtnLogin = document.getElementById('google-login-btn-login');
    const googleLoginBtnRegister = document.getElementById('google-login-btn-register');

    // --- 2. Инициализация Supabase (ТОЛЬКО для этой страницы) ---
    // Эта страница особенная, она не использует script.js
    const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
    const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- 3. Проверка сессии: если пользователь уже вошел, перенаправляем ---
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.location.href = '/'; // Отправляем на главную, если уже есть сессия
        }
    });
    
    // --- 4. Обработчики событий ---

    // Переключение между формами
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

    // Вход через Google
    const handleGoogleLogin = async () => {
        await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };
    googleLoginBtnLogin.addEventListener('click', handleGoogleLogin);
    googleLoginBtnRegister.addEventListener('click', handleGoogleLogin);

    // Регистрация
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = registerForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        registerMessage.textContent = 'Создаем аккаунт...';
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });
            if (error) throw error;
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                 registerMessage.textContent = '✅ Успешно! Пожалуйста, проверьте вашу почту для подтверждения регистрации.';
                 registerMessage.style.color = '#2ecc71';
            } else {
                registerMessage.textContent = '✅ Успешно! Перенаправляем на главную...';
                registerMessage.style.color = '#2ecc71';
                setTimeout(() => { window.location.href = '/'; }, 1500);
            }
        } catch (error) {
            // ИСПРАВЛЕНО: Убран лишний обратный слэш
            registerMessage.textContent = `Ошибка: ${error.message}`;
            registerMessage.style.color = '#e74c3c';
        } finally {
            submitButton.disabled = false;
        }
    });

    // Вход
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
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
            // ИСПРАВЛЕНО: Убран лишний обратный слэш
            loginMessage.textContent = `Ошибка: ${error.message}`;
            loginMessage.style.color = '#e74c3c';
        } finally {
            submitButton.disabled = false;
        }
    });
});
