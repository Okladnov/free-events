// =================================================================
// app.js - ВЕРСИЯ С МОДАЛЬНЫМ ОКНОМ ВХОДА
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
// ЛОГИКА РАБОТЫ МОДАЛЬНОГО ОКНА (НОВЫЙ БЛОК)
// =================================================================

function setupLoginModal() {
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const loginBtn = document.getElementById('loginBtn');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('modal-error-message');

    if (!loginModalOverlay || !loginBtn || !closeModalBtn || !loginForm) {
        return; // Если каких-то элементов нет, ничего не делаем
    }

    // Открыть модальное окно
    loginBtn.addEventListener('click', () => {
        loginModalOverlay.classList.remove('hidden');
    });

    // Закрыть модальное окно (по крестику)
    closeModalBtn.addEventListener('click', () => {
        loginModalOverlay.classList.add('hidden');
    });

    // Закрыть модальное окно (по клику на темный фон)
    loginModalOverlay.addEventListener('click', (event) => {
        if (event.target === loginModalOverlay) {
            loginModalOverlay.classList.add('hidden');
        }
    });

    // Обработка отправки формы входа
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        errorMessage.style.display = 'none'; // Сначала прячем старую ошибку

        try {
            // Отправляем "магическую ссылку" для входа
            const { error } = await supabaseClient.auth.signInWithOtp({
                email: email,
                options: {
                  emailRedirectTo: window.location.origin, // Куда вернется пользователь после клика в письме
                },
            });

            if (error) {
                throw error; // Если Supabase вернул ошибку, пробрасываем ее в catch
            }

            // Успех!
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
    // Получаем элементы
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
        // ... (код темы не изменился)
    }

    // 2. Проверка сессии пользователя
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;

    // 3. Настройка UI
    if (currentUser) {
        if (addEventBtn) addEventBtn.classList.remove('hidden');
        if (profileDropdown) profileDropdown.classList.remove('hidden');

        // ... (код получения профиля и админа не изменился)

    } else {
        // Теперь мы просто показываем кнопку "Войти", которая откроет модальное окно
        if (loginBtn) loginBtn.classList.remove('hidden');
    }

    // 4. Настройка обработчиков
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabaseClient.auth.signOut();
            window.location.reload();
        };
    }
    if (addEventBtn) {
        addEventBtn.onclick = () => window.location.href = '/edit-event.html';
    }
    if (profileTrigger) {
        // ... (код выпадающего меню не изменился)
    }

    // 5. ВАЖНО: Инициализируем логику модального окна
    setupLoginModal();
}

// Запускаем инициализацию шапки при загрузке DOM
// (в script.js мы делаем это в событии DOMContentLoaded, здесь можно оставить так)
initializeHeader();
