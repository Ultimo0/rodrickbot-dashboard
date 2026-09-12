const form = document.getElementById('loginForm');
const errorEl = document.getElementById('formError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';

  const email = document.getElementById('fEmail').value.trim();
  const password = document.getElementById('fPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Une erreur est survenue.';
      errorEl.style.display = 'block';
      return;
    }

    window.location.href = 'profile.html';
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
});
