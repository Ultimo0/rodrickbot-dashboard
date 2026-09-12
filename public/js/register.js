const form = document.getElementById('registerForm');
const errorEl = document.getElementById('formError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';

  const name = document.getElementById('fName').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const password = document.getElementById('fPassword').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Une erreur est survenue.';
      errorEl.style.display = 'block';
      return;
    }

    // Inscription réussie = déjà connecté (voir src/routes/auth.js) —
    // direction le profil directement.
    window.location.href = 'profile.html';
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
});
