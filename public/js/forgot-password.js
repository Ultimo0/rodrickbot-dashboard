const form = document.getElementById('forgotForm');
const errorEl = document.getElementById('formError');
const successEl = document.getElementById('formSuccess');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const email = document.getElementById('fEmail').value.trim();

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // Le serveur répond TOUJOURS ok:true, que l'email existe ou non
    // (voir src/routes/auth.js) — on affiche donc toujours ce même
    // message de succès, jamais une erreur liée à l'email lui-même.
    if (res.ok) {
      form.style.display = 'none';
      successEl.textContent = 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.';
      successEl.style.display = 'block';
      return;
    }

    const data = await res.json().catch(() => ({}));
    errorEl.textContent = data.error || 'Une erreur est survenue.';
    errorEl.style.display = 'block';
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
});
