// =================================================================
// СКРИПТ ДЛЯ СТРАНИЦЫ ВХОДА - login.html (ВЕРСИЯ ДЛЯ СТАНДАРТНОЙ СТРАНИЦЫ)
// =================================================================

function initializeLoginPage() {
    const loginForm = document.getElementById('login-form');
    // Если мы не на странице логина, ничего не делаем
    if (!loginForm) return;

    // --- Проверка: если пользователь уже вошел, отправляем на главную ---
    if (currentUser) {
        window.location.href = '/';
        return;
    }
    
    // --- Получаем остальные элементы ---
    const registerForm = document.getElementById('register-form');
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');
    const toggleToRegisterBtn = document.getElementById('toggle-to-register-btn');
    const toggleToLoginBtn = document.getElementById('toggle-to-login-btn');
    const googleLoginBtnLogin = document.getElementById('google-login-btn-login');
    const googleLoginBtnRegister = document.getElementById('google-login-btn-register');

    // --- Обработчики событий ---

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

    const handleGoogleLogin = async () => {
        await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };
    googleLoginBtnLogin.addEventListener('click', handleGoogleLogin);
    googleLoginBtnRegister.addEventListener('click', handleGoogleLogin);

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
            if (data.user && data.user.identities.length === 0) {
                 registerMessage.textContent = '✅ Успешно! Проверьте вашу почту для подтверждения.';
                 registerMessage.style.color = 'var(--success-color)';
            } else {
                registerMessage.textContent = '✅ Успешно! Входим...';
                registerMessage.style.color = 'var(--success-color)';
                setTimeout(() => { window.location.href = '/'; }, 1500);
            }
        } catch (error) {
            registerMessage.textContent = `Ошибка: ${error.message}`;
            registerMessage.style.color = 'var(--error-color)';
        } finally {
            submitButton.disabled = false;
        }
    });

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
            loginMessage.textContent = `Ошибка: ${error.message}`;
            loginMessage.style.color = 'var(--error-color)';
        } finally {
            submitButton.disabled = false;
        }
    });
}

// Запускаемся только после того, как script.js подготовил шапку
document.addEventListener('headerLoaded', initializeLoginPage);
