document.addEventListener('DOMContentLoaded', async () => {
    const user = localStorage.getItem('userConnected');
    if(!user) window.location.href = "/login";

    document.getElementById('userInfo').innerText = "Session de : " + user;

    const res = await fetch(`/api/favorites/${user}`);
    const favs = await res.json();
    
    const container = document.querySelector('.dashboard-container');
    const grid = document.createElement('div');
    grid.className = 'movies-grid';
    
    favs.forEach(f => {
        grid.innerHTML += `
            <div class="card">
                <img src="${f.image_url}">
                <h3>${f.title}</h3>
            </div>`;
    });
    container.appendChild(grid);

    document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('userConnected');
        window.location.href = "/";
    };
});