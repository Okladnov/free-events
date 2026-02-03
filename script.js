// script.js - ВЕРСИЯ 2.0 (с профилем пользователя)

const SUPABASE_URL = 'https://wxauqfhxxvjfljqycpqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4YXVxZmh4eHZqZmxqcXljcHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5MjQ1NDYsImV4cCI6MjAyODUwMDU0Nn0.8Hhg3jLdJk4Y6i_1i2l2p24h3eo_l6a23VCl0-s4pzM';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const EVENTS_PER_PAGE = 10;
let currentPage = 1;
let currentSearchTerm = '';
let currentCategory = '';

document.addEventListener('DOMContentLoaded', () => {
    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const closeBtn = document.querySelector('.close-button');
    const loginLink = document.getElementById('login-link');
    const toTopBtn = document.getElementById('to-top-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value;
            currentPage = 1;
            loadEvents();
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            currentPage = 1;
            loadEvents();
        });
    }

    // --- ЛОГИКА АВТОРИЗАЦИИ ---
    supabase.auth.onAuthStateChange(async (_event, session) => {
        const user = session?.user;

        // [ГЛАВНОЕ ИЗМЕНЕНИЕ] Логика для меню пользователя
        if (user) {
            // Показываем меню пользователя и скрываем кнопку входа
            document.getElementById('user-menu').style.display = 'block';
            document.getElementById('login-link').style.display = 'none';

            // Находим выпадающее меню
            const userMenu = document.getElementById('user-menu');
            const dropdown = userMenu.querySelector('.dropdown');

            // Динамически создаем ссылки "Профиль" и "Выйти"
            if (dropdown) {
                dropdown.innerHTML = `
                    <li><a href="profile.html">Профиль</a></li>
                    <li><a href="#" id="logout-link">Выйти</a></li>
                `;
            }
            
            // Навешиваем событие на новую кнопку "Выйти"
            const logoutLink = document.getElementById('logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await supabase.auth.signOut();
                    window.location.reload(); // Перезагружаем страницу для обновления состояния
                });
            }
        } else {
            // Если пользователь не авторизован
            document.getElementById('user-menu').style.display = 'none';
            document.getElementById('login-link').style.display = 'block';
        }
        
        // Загружаем события после проверки статуса пользователя
        loadEvents(); 
    });

    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.style.display = 'block';
        });
    }

    if (closeBtn) {
        closeBtn.onclick = () => loginModal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target == loginModal) {
            loginModal.style.display = 'none';
        }
    };
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const { error } = await supabase.auth.signInWithOtp({ email });

            if (error) {
                alert('Error sending magic link: ' + error.message);
            } else {
                alert('Check your email for the magic link!');
                loginModal.style.display = 'none';
            }
        });
    }
    
    // --- КНОПКА "НАВЕРХ" ---
    window.onscroll = () => {
        if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
            toTopBtn.style.display = "block";
        } else {
            toTopBtn.style.display = "none";
        }
    };

    if(toTopBtn){
        toTopBtn.onclick = () => {
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        };
    }

    loadCategories();
});

// --- ЗАГРУЗКА ДАННЫХ ---
async function loadEvents() {
    let query = supabase
        .from('events')
        .select('*', { count: 'exact' })
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

    if (currentSearchTerm) {
        query = query.textSearch('title', `'${currentSearchTerm}'`);
    }

    if (currentCategory) {
        query = query.eq('category_id', currentCategory);
    }

    const from = (currentPage - 1) * EVENTS_PER_PAGE;
    const to = from + EVENTS_PER_PAGE - 1;
    query = query.range(from, to);

    const { data: events, error, count } = await query;
    
    const eventsContainer = document.getElementById('events-container');
    if (error || !eventsContainer) {
        console.error('Error fetching events:', error);
        return;
    }

    eventsContainer.innerHTML = '';
    if (events.length === 0) {
        eventsContainer.innerHTML = '<p>Событий по вашему запросу не найдено.</p>';
    } else {
        events.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.classList.add('event-card');
            const sanitizedTitle = DOMPurify.sanitize(event.title);
            const sanitizedDescription = DOMPurify.sanitize(event.description.substring(0, 100) + '...');
            const imageUrl = event.image_url ? supabase.storage.from('event-images').getPublicUrl(event.image_url).data.publicUrl : 'default-event.jpg';

            eventElement.innerHTML = `
                <img src="${imageUrl}" alt="${sanitizedTitle}">
                <h3>${sanitizedTitle}</h3>
                <p>${sanitizedDescription}</p>
                <a href="event.html?id=${event.id}">Подробнее</a>
            `;
            eventsContainer.appendChild(eventElement);
        });
    }
    
    setupPagination(count);
}

async function loadCategories() {
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) return;
    
    const { data, error } = await supabase.from('categories').select('*');
    if (error) {
        console.error('Error loading categories:', error);
        return;
    }
    data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = DOMPurify.sanitize(category.name);
        categoryFilter.appendChild(option);
    });
}

function setupPagination(totalEvents) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE);

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const pageLink = document.createElement('a');
        pageLink.href = '#';
        pageLink.textContent = i;
        if (i === currentPage) {
            pageLink.classList.add('active');
        }
        pageLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            loadEvents();
        });
        paginationContainer.appendChild(pageLink);
    }
}
