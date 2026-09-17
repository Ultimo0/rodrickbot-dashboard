const form = document.getElementById('resetForm');
const errorEl = document.getElementById('formError');
const invalidTokenEl = document.getElementById('invalidToken');

// Le jeton voyage dans l'URL (voir le lien construit dans src/email.js) —
// on le lit une fois au chargement, jamais modifiable par la personne.
const token = new URLSearchParams(window.location.search).get('token');

if (!token) {
  form.style.display = 'none';
  invalidTokenEl.style.display = 'block';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';

  const password = document.getElementById('fPassword').value;

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Un jeton invalide/expiré a sa propre présentation (lien vers une
      // nouvelle demande) plutôt qu'un message d'erreur générique dans
      // le formulaire — plus utile pour quelqu'un qui vient de cliquer un
      // vieux lien depuis ses emails.
      if (res.status === 400 && /invalide|expir/i.test(data.error || '')) {
        form.style.display = 'none';
        invalidTokenEl.style.display = 'block';
        return;
      }
      errorEl.textContent = data.error || 'Une erreur est survenue.';
      errorEl.style.display = 'block';
      return;
    }

    window.location.href = 'login.html';
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
});
