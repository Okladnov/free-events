const SUPABASE_URL = 'https://wxauqfhxxvjfljqycpqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4YXVxZmh4eHZqZmxqcXljcHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5MjQ1NDYsImV4cCI6MjAyODUwMDU0Nn0.8Hhg3jLdJk4Y6i_1i2l2p24h3eo_l6a23VCl0-s4pzM';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const user = await supabase.auth.getUser();

    if (user.data.user) {
        document.getElementById('user-menu').style.display = 'block';
        document.getElementById('login-link').style.display = 'none';
        loadUserProfile(user.data.user);
        loadUserEvents(user.data.user.id);
    } else {
        window.location.href = 'index.html'; // Redirect if not logged in
    }

    const logoutLink = document.getElementById('logout-link');
    if(logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }
});

async function loadUserProfile(user) {
    const profileInfo = document.getElementById('profile-info');
    const sanitizedEmail = DOMPurify.sanitize(user.email);
    profileInfo.innerHTML = `<p><strong>Email:</strong> ${sanitizedEmail}</p>`;
    // We can add more profile info here later
}

async function loadUserEvents(userId) {
    const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user events:', error);
        return;
    }

    const eventsContainer = document.getElementById('my-events-container');
    eventsContainer.innerHTML = ''; // Clear existing events

    if (events.length === 0) {
        eventsContainer.innerHTML = '<p>You have not created any events yet.</p>';
        return;
    }

    events.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.classList.add('event-card');
        const sanitizedTitle = DOMPurify.sanitize(event.title);
        const sanitizedDescription = DOMPurify.sanitize(event.description);
        const imageUrl = event.image_url ? supabase.storage.from('event-images').getPublicUrl(event.image_url).data.publicUrl : 'default-event.jpg';


        eventElement.innerHTML = `
            <img src="${imageUrl}" alt="${sanitizedTitle}">
            <h3>${sanitizedTitle}</h3>
            <p>${sanitizedDescription}</p>
            <a href="event.html?id=${event.id}">View Details</a>
        `;
        eventsContainer.appendChild(eventElement);
    });
}
