// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ ВХОДА - login.html (login.js)
// =================================================================
// Важно: supabaseClient уже создан в script.js, мы его просто используем.

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Получаем все нужные элементы ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');
    const toggleToRegisterBtn = document.getElementById('toggle-to-register-btn');
    const toggleToLoginBtn = document.getElementById('toggle-to-login-btn');
    const googleLoginBtnLogin = document.getElementById('google-login-btn-login');
    const googleLoginBtnRegister = document.getElementById('google-login-btn-register');

    // --- 2. Проверяем, не залогинен ли пользователь уже ---
    // Если да, то ему нечего делать на этой странице - отправляем на главную.
    if (currentUser) {
        window.location.href = '/';
        return; // Прерываем выполнение скрипта
    }
    
    // --- 3. Обработчики событий ---

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

    // Обработчик для входа через Google
    const handleGoogleLogin = async () => {
        // Используем глобальный supabaseClient
        await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };
    googleLoginBtnLogin.addEventListener('click', handleGoogleLogin);
    googleLoginBtnRegister.addEventListener('click', handleGoogleLogin);

    // Обработчик формы регистрации
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
            // Если требуется подтверждение по почте
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                 registerMessage.textContent = '✅ Успешно! Проверьте вашу почту для подтверждения.';
                 registerMessage.style.color = '#2ecc71';
            } else {
                registerMessage.textContent = '✅ Успешно! Входим...';
                registerMessage.style.color = '#2ecc71';
                setTimeout(() => { window.location.href = '/'; }, 1500);
            }
        } catch (error) {
            registerMessage.textContent = `Ошибка: ${error.message}`;
            registerMessage.style.color = '#e74c3
