console.log('[1] admin.js: Скрипт запущен. Пульс есть.');

try {
    // =================================================================
    // ПОДКЛЮЧЕНИЕ К SUPABASE
    // =================================================================
    const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
    const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[2] admin.js: Клиент Supabase создан.');

    // =================================================================
    // ЭЛЕМЕНТЫ СТРАНИЦЫ
    // =================================================================
    const unapprovedContainer = document.getElementById('unapproved-events');
    console.log('[3] admin.js: Переменные объявлены.');

    // =================================================================
    // АВТОРИЗАЦИЯ И ПРОВЕРКА РОЛИ
    // =================================================================
    window.logout = async function() {
        console.log('Выполняется logout...');
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    console.log('[4] admin.js: Устанавливаю обработчик onAuthStateChange...');
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        try {
            console.log('[5] admin.js: onAuthStateChange сработал. Событие:', event);
            const currentUser = session ? session.user : null;

            if (currentUser) {
                console.log('[6] admin.js: Пользователь найден:', currentUser.email);
                console.log('[7] admin.js: Запрашиваю профиль...');

                const { data: profiles, error } = await supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('id', currentUser.id);

                if (error) {
                    // Это важный блок, чтобы увидеть ошибку ЗАПРОСА
                    console.error('[!!! ОШИБКА ЗАПРОСА ПРОФИЛЯ !!!]', error);
                    showAccessDenied('Ошибка при проверке прав доступа.');
                    return;
                }
                
                console.log('[8] admin.js: Запрос профиля успешен. Получено:', profiles);

                const profile = profiles && profiles.length > 0 ? profiles[0] : null;

                if (profile && profile.role === 'admin') {
                    console.log('[9] admin.js: Роль "admin" подтверждена. Запускаю основную функцию.');
                    loadUnapprovedEvents();
                } else {
                    console.log('[9] admin.js: Роль НЕ "admin" или профиль не найден. Доступ запрещен.');
                    showAccessDenied();
                }

            } else {
                console.log('[6] admin.js: Пользователь НЕ найден. Доступ запрещен.');
                showAccessDenied();
            }
        } catch (e) {
            // Этот блок поймает ЛЮБУЮ другую ошибку внутри onAuthStateChange
            console.error('[!!! КРИТИЧЕСКАЯ ОШИБКА ВНУТРИ onAuthStateChange !!!]', e);
            alert('Критическая ошибка в логике авторизации! Проверь консоль.');
        }
    });

    function showAccessDenied(message = 'Эта страница доступна только для администраторов сайта.') {
        console.log('Вызвана функция showAccessDenied.');
        unapprovedContainer.innerHTML = `<h2>⛔ Доступ запрещен</h2><p>${message}</p><a href="/">Перейти на главную</a>`;
    }

    // =================================================================
    // ГЛАВНАЯ ФУНКЦИЯ (пока без изменений)
    // =================================================================
    async function loadUnapprovedEvents() {
        // ... тут пока оставим все как было, мы должны дойти досюда
        unapprovedContainer.innerHTML = '<p>🎉 Успех! Функция загрузки событий запущена. Если видишь это - мы победили.</p>';
        console.log('[10] admin.js: Ура! Мы дошли до loadUnapprovedEvents!');
    }

} catch (e) {
    // Этот блок поймает ЛЮБУЮ ошибку на верхнем уровне (если Supabase URL неправильный и т.д.)
    console.error('[!!! КРИТИЧЕСКАЯ ОШИБКА НА ВЕРХНЕМ УРОВНЕ !!!]', e);
    alert('Критическая ошибка в admin.js! Проверь консоль.');
}
