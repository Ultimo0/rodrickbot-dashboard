const notLoggedInEl = document.getElementById('notLoggedIn');
const profileCardEl = document.getElementById('profileCard');

async function load() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      notLoggedInEl.style.display = 'block';
      return;
    }

    const user = await res.json();
    profileCardEl.style.display = 'block';
    document.getElementById('pName').textContent = user.name || '—';
    document.getElementById('pEmail').textContent = user.email;
    document.getElementById('pRole').textContent = user.role === 'admin' ? 'Administrateur' : 'Membre';
    document.getElementById('pSince').textContent = new Date(user.createdAt).toLocaleDateString('fr-FR');
  } catch {
    notLoggedInEl.style.display = 'block';
    notLoggedInEl.textContent = 'Impossible de contacter le serveur.';
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

load();
