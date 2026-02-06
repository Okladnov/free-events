// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ШАПКИ (САМАЯ ПОСЛЕДНЯЯ ВЕРСИЯ)
// =================================================================
async function initializeHeader() {
    const themeToggle = document.getElementById('theme-toggle');
    const loginBtn = document.getElementById('loginBtn');
    const addEventBtn = document.getElementById('add-event-modal-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const userNameDisplay = document.getElementById('user-name-display');
    const adminLink = document.getElementById('admin-link');
    const profileMenu = document.getElementById('profile-menu');
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
        if (loginBtn) loginBtn.style.display = 'none';
        if (addEventBtn) addEventBtn.style.display = 'block';
        if (profileDropdown) profileDropdown.style.display = 'block';

        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
        if (userNameDisplay) {
            const name = (profile && profile.full_name) ? profile.full_name : (currentUser.email ? currentUser.email.split('@')[0] : 'Профиль');
            userNameDisplay.textContent = name;
        }

        try {
            const { data: adminStatus } = await supabaseClient.rpc('is_admin');
            isAdmin = adminStatus;
            
            if (adminLink) adminLink.style.display = 'none';

            // === ГАРАНТИРОВАННО СОДЕРЖИТ "ИЗБРАННОЕ" ===
            let menuHtml = `
                <a href="/profile.html" class="profile-menu-item">
                    <svg class="icon-profile" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                    <span>Мой профиль</span>
                </a>
                <a href="/favorites.html" class="profile-menu-item">
                    <svg class="icon-favorites" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                    <span>Мои избранные</span>
                </a>
            `;

            if (isAdmin) {
                menuHtml += `
                    <a href="/admin.html" class="profile-menu-item">
                        <svg class="icon-admin" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>
                        <span>Админ панель</span>
                    </a>
                `;
            }
            
            menuHtml += `
                <div class="menu-separator"></div>
                <a href="#" class="profile-menu-item" id="logoutBtn">
                    <svg class="icon-logout" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path></svg>
                    <span>Выйти</span>
                </a>
            `;
            
            if(profileMenu) profileMenu.innerHTML = menuHtml;

        } catch (e) { isAdmin = false; }
        
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (addEventBtn) addEventBtn.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'none';
    }

    if (profileMenu) {
        profileMenu.addEventListener('click', async (event) => {
            if (event.target.closest('#logoutBtn')) {
                event.preventDefault();
                await supabaseClient.auth.signOut();
                window.location.reload();
            }
        });
    }
    
    if (addEventBtn) { addEventBtn.onclick = () => { window.location.href = '/edit-event.html'; }; }
    if (profileTrigger) {
        profileTrigger.onclick = (event) => {
            event.stopPropagation();
            if (profileDropdown) { profileDropdown.classList.toggle('open'); }
        };
    }
    
    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('open');
        }
    });
}
