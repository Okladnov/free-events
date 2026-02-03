// =================================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// =================================================================
const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =================================================================
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const googleLoginBtnRegister = document.getElementById('google-login-btn-register');
const googleLoginBtnLogin = document.getElementById('google-login-btn-login');

const registerMessage = document.getElementById('register-message');
const loginMessage = document.getElementById('login-message');

const toggleToLogin = document.getElementById('toggle-to-login');
const toggleToRegister = document.getElementById('toggle-to-register');

// =================================================================
// ОСНОВНАЯ ЛОГИКА
// =================================================================

// Проверяем, не залогинен ли пользователь уже. Если да - кидаем на главную.
supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        window.location.href = '/';
    }
});

// Переключатель на форму входа
toggleToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    toggleToLogin.style.display = 'none';
    toggleToRegister.style.display = 'block';
});

// Переключатель на форму регистрации
toggleToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    toggleToRegister.style.display = 'none';
    toggleToLogin.style.display = 'block';
});

// Обработчик формы РЕГИСТРАЦИИ
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    registerMessage.textContent = 'Создаем аккаунт...';
    registerMessage.style.color = 'var(--text-color)';

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: name // Передаем имя для профиля
            }
        }
    });

    if (error) {
        registerMessage.textContent = `Ошибка: ${error.message}`;
        registerMessage.style.color = '#e74c3c';
    } else if (data.user) {
        // Если требуется подтверждение по почте, data.user.identities будет пустым
        if (data.user.identities && data.user.identities.length === 0) {
            registerMessage.textContent = 'Аккаунт создан! Пожалуйста, проверьте вашу почту и подтвердите регистрацию.';
            registerMessage.style.color = '#2ecc71';
        } else {
             // Если авто-подтверждение включено
            registerMessage.textContent = 'Успешно! Перенаправляем...';
            registerMessage.style.color = '#2ecc71';
            setTimeout(() => { window.location.href = '/'; }, 1500);
        }
    }
});

// Обработчик формы ВХОДА
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    loginMessage.textContent = 'Выполняем вход...';
    loginMessage.style.color = 'var(--text-color)';

    const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        loginMessage.textContent = `Ошибка: ${error.message}`;
        loginMessage.style.color = '#e74c3c';
    } else {
        loginMessage.textContent = 'Успешно! Перенаправляем...';
        loginMessage.style.color = '#2ecc71';
        setTimeout(() => { window.location.href = '/'; }, 1000);
    }
});

// Обработчик входа через Google
async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin // Адрес, куда вернуться после входа
        }
    });
}
googleLoginBtnRegister.addEventListener('click', signInWithGoogle);
googleLoginBtnLogin.addEventListener('click', signInWithGoogle);


// =================================================================
// ЛОГИКА ТЕМНОЙ ТЕМЫ (чтобы страница соответствовала сайту)
// =================================================================
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
}
