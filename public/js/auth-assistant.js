(() => {
  const stage = document.querySelector('.auth-stage');
  if (!stage) return;

  const mode = stage.dataset.authMode;
  const form = stage.querySelector('form');
  const message = document.getElementById('assistantMessage');
  const password = document.getElementById('fPassword');
  const email = document.getElementById('fEmail');
  const name = document.getElementById('fName');
  const strength = document.getElementById('passwordStrength');

  const copy = {
    welcome: mode === 'register'
      ? 'Bienvenue. Créons un espace qui te ressemble.'
      : 'Bienvenue. Je sécurise ton accès à Rodrick Hub.',
    name: 'Enchanté. Ton espace portera bien ton nom.',
    email: 'Adresse repérée. Je prépare ton accès sécurisé.',
    password: 'Ton mot de passe reste entre nous.',
    visiblePassword: 'Je détourne le regard. Vérifie tranquillement.',
    ready: mode === 'register' ? 'Tout est prêt. Nous pouvons créer ton compte.' : 'Tout est prêt. Tu peux te connecter.',
    error: 'Je n’ai pas pu valider cette étape. Vérifie les champs indiqués.',
    loading: mode === 'register' ? 'Je crée ton accès sécurisé…' : 'Je vérifie ton accès sécurisé…',
    success: mode === 'register' ? 'Compte créé. Bienvenue dans le Hub !' : 'Connexion réussie. Bienvenue de retour !',
  };

  function speak(key, customMessage) {
    const value = customMessage || copy[key] || copy.welcome;
    if (message) message.textContent = value;
    stage.dataset.robotMood = key;
  }

  function fieldIsValid(input) {
    if (!input.value) return null;
    return input.checkValidity();
  }

  function updateField(input) {
    const field = input.closest('.field');
    if (!field) return;
    const valid = fieldIsValid(input);
    field.classList.toggle('is-valid', valid === true);
    field.classList.toggle('is-invalid', valid === false);
    input.setAttribute('aria-invalid', String(valid === false));
  }

  function passwordScore(value) {
    if (!value) return 0;
    let score = value.length >= 8 ? 1 : 0;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value) || value.length >= 14) score += 1;
    return score;
  }

  function updateStrength() {
    if (!strength || !password) return;
    const score = passwordScore(password.value);
    const labels = [
      'Choisis au moins 8 caractères.',
      'Encore un peu court.',
      'Correct. Ajoute des chiffres ou symboles.',
      'Bon mot de passe.',
      'Mot de passe robuste.',
    ];
    strength.dataset.score = String(score);
    strength.querySelector('.strength-label').textContent = labels[score];
  }

  [name, email, password].filter(Boolean).forEach((input) => {
    input.addEventListener('focus', () => {
      if (input === email) speak('email');
      else if (input === password) speak('password');
      else speak('name');
    });
    input.addEventListener('input', () => {
      updateField(input);
      if (input === email && input.value) speak('email');
      if (input === password) updateStrength();
      if (form && [...form.querySelectorAll('input')].every((field) => fieldIsValid(field) === true)) speak('ready');
    });
    input.addEventListener('blur', () => updateField(input));
    input.addEventListener('invalid', () => {
      updateField(input);
      speak('error');
    });
  });

  document.addEventListener('auth:password-visibility', (event) => {
    stage.classList.toggle('is-password-visible', Boolean(event.detail?.visible));
    speak(event.detail?.visible ? 'visiblePassword' : 'password');
  });

  form?.addEventListener('submit', () => {
    if (!form.checkValidity()) {
      speak('error');
      return;
    }
    stage.classList.add('is-submitting');
    speak('loading');
  }, true);

  document.querySelectorAll('[data-auth-transition]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      stage.classList.add('is-leaving');
      window.setTimeout(() => { window.location.href = link.href; }, 180);
    });
  });

  window.authAssistant = {
    error(text) {
      stage.classList.remove('is-submitting');
      speak('error', text || copy.error);
    },
    success(text) {
      speak('success', text || copy.success);
    },
  };
})();
