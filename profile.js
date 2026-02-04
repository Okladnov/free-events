const SUPABASE_URL = "https://cjspkygnjnnhgrbjusmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_mv5fXvDXXOCjFe-DturfeQ_zsUPc77D";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const userAvatar = document.getElementById('user-avatar');
const welcomeMessage = document.getElementById('welcome-message');
const profileNameInput = document.getElementById('profile-name');
const profileEmailInput = document.getElementById('profile-email');
const avatarUploadInput = document.getElementById('avatar-upload');
const profileForm = document.getElementById('profile-form');
const profileMessage = document.getElementById('profile-message');
const logoutProfileBtn = document.getElementById('logout-profile-btn');

let currentUser = null;

async function main() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return;
    }
    currentUser = session.user;
    
    // Загрузка данных профиля
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', currentUser.id)
        .single();
    
    if (profile) {
        profileNameInput.value = profile.full_name || '';
        welcomeMessage.textContent = `Привет, ${profile.full_name || currentUser.email.split('@')[0]}!`;
        if (profile.avatar_url) {
            userAvatar.src = profile.avatar_url;
        }
    }
    profileEmailInput.value = currentUser.email;

    // Обновление превью аватарки
    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                userAvatar.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Сохранение профиля
    profileForm.addEventListener('submit', handleProfileUpdate);

    // Выход
    logoutProfileBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = '/';
    });
    
    // Темная тема
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') { document.body.classList.add('dark-theme'); }
    
    // Настраиваем стандартную шапку (логика взята из других файлов)
    setupHeader();
}

function setupHeader() {
    const themeToggle = document.getElementById('theme-toggle');
    if(themeToggle) {
        const currentTheme = localStorage.getItem('theme');
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // Здесь мы просто настраиваем отображение меню, без сложных проверок
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('profile-dropdown').style.display = 'block';
    
    // Отображаем имя в шапке
    const userNameDisplay = document.getElementById('user-name-display');
    if(userNameDisplay) {
      // Имя уже загружено в main, можем просто взять его из поля ввода
      userNameDisplay.textContent = profileNameInput.value || currentUser.email.split('@')[0];
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.href = '/';
    };

    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
        const profileTrigger = document.getElementById('profile-trigger');
        profileTrigger.onclick = (event) => {
            event.stopPropagation();
            profileDropdown.classList.toggle('open');
        };
    }
    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('open');
        }
    });
}


async function handleProfileUpdate(e) {
    e.preventDefault();
    const submitButton = profileForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    profileMessage.textContent = 'Сохранение...';
    profileMessage.style.color = 'var(--text-color)';
    
    // 1. Обновляем имя
    const newName = profileNameInput.value.trim();
    const { error: nameError } = await supabaseClient
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', currentUser.id);

    if (nameError) {
        profileMessage.textContent = `Ошибка обновления имени: ${nameError.message}`;
        submitButton.disabled = false;
        return;
    }

    // 2. Загружаем и обновляем аватар, если он выбран
    const avatarFile = avatarUploadInput.files[0];
    if (avatarFile) {
        const filePath = `${currentUser.id}/${Date.now()}_${avatarFile.name}`;
        
        // Сначала удаляем старый аватар, если он есть
        const { data: profile } = await supabaseClient.from('profiles').select('avatar_url').single();
        if (profile && profile.avatar_url) {
            const oldAvatarPath = profile.avatar_url.split('/').pop();
            await supabaseClient.storage.from('avatars').remove([`${currentUser.id}/${oldAvatarPath}`]);
        }

        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(filePath, avatarFile, { upsert: false }); // upsert: false чтобы не перезаписывать, а создавать новый

        if (uploadError) {
            profileMessage.textContent = `Ошибка загрузки аватара: ${uploadError.message}`;
            submitButton.disabled = false;
            return;
        }
        
        const { data: { publicUrl } } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
        
        const { error: avatarUrlError } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', currentUser.id);

        if (avatarUrlError) {
            profileMessage.textContent = `Ошибка сохранения аватара: ${avatarUrlError.message}`;
            submitButton.disabled = false;
            return;
        }
    }
    
    profileMessage.textContent = '✅ Профиль успешно сохранен!';
    profileMessage.style.color = '#2ecc71';
    
    // Обновляем имя в шапке
    welcomeMessage.textContent = `Привет, ${newName || currentUser.email.split('@')[0]}!`;
    const userNameDisplay = document.getElementById('user-name-display');
    if (userNameDisplay) userNameDisplay.textContent = newName || currentUser.email.split('@')[0];

    setTimeout(() => { 
        profileMessage.textContent = '';
    }, 3000);
    
    submitButton.disabled = false;
}

main();
