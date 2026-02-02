console.log('[1] admin.js: Скрипт запущен. Версия с "Прямым звонком".');

try {
    // =================================================================
    // ПОДКЛЮЧЕНИЕ К SUPABASE
    // =================================================================
    const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
    // Убедись, что тут твой самый новый ключ
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
                console.log('[7] admin.js: ДЕЛАЮ ПРЯМОЙ ЗВОНОК функции is_admin()...');

                // ========== THE HOLY GRAIL FIX ==========
                // Мы не лезем в таблицу, а напрямую вызываем SQL-функцию
                const { data: isAdmin, error } = await supabaseClient.rpc('is_admin');
                // =======================================

                if (error) {
                    console.error('[!!! ОШИБКА ПРИ ВЫЗОВЕ is_admin !!!]', error);
                    showAccessDenied('Критическая ошибка при проверке прав.');
                    return;
                }
                
                console.log('[8] admin.js: "Прямой звонок" успешен. Результат:', isAdmin);

                if (isAdmin === true) {
                    console.log('[9] admin.js: Права "admin" подтверждены. Запускаю основную функцию.');
                    loadUnapprovedEvents();
                } else {
                    console.log('[9] admin.js: Права "admin" НЕ подтверждены. Доступ запрещен.');
                    showAccessDenied();
                }

            } else {
                console.log('[6] admin.js: Пользователь НЕ найден. Доступ запрещен.');
                showAccessDenied();
            }
        } catch (e) {
            console.error('[!!! КРИТИЧЕСКАЯ ОШИБКА ВНУТРИ onAuthStateChange !!!]', e);
        }
    });

    function showAccessDenied(message = 'Эта страница доступна только для администраторов сайта.') {
        console.log('Вызвана функция showAccessDenied.');
        unapprovedContainer.innerHTML = `<h2>⛔ Доступ запрещен</h2><p>${message}</p>`;
    }

    // =================================================================
    // ГЛАВНАЯ ФУНКЦИЯ
    // =================================================================
    async function loadUnapprovedEvents() {
        console.log('[10] admin.js: Ура! Мы дошли до loadUnapprovedEvents!');
        unapprovedContainer.innerHTML = '<p>Загрузка списка событий для модерации...</p>';
        const { data: events, error } = await supabaseClient.from('events').select('*').eq('is_approved', false).order('created_at', { ascending: true });
        if (error) {
            console.error('Ошибка загрузки событий:', error);
            unapprovedContainer.innerHTML = `<p>Ошибка: ${error.message}</p>`;
            return;
        }
        if (!events || events.length === 0) {
            unapprovedContainer.innerHTML = '<p>🎉 Все события одобрены! Новых на модерацию нет.</p>';
            return;
        }
        unapprovedContainer.innerHTML = '';
        // ... тут код отрисовки, он правильный
         events.forEach(event => {
            const eventCard = document.createElement('div');
            eventCard.className = 'admin-event-card';
            eventCard.style.cssText = 'border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;';
            eventCard.innerHTML = `<h4>${event.title}</h4><p><strong>Описание:</strong> ${event.description || 'Нет'}</p><button onclick="approveEvent(${event.id}, this)">Одобрить</button>`;
            unapprovedContainer.appendChild(eventCard);
        });
    }

} catch (e) {
    console.error('[!!! КРИТИЧЕСКАЯ ОШИБКА НА ВЕРХНЕМ УРОВНЕ !!!]', e);
}
