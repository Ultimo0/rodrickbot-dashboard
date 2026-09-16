/**
 * profile.js
 * ------------------------------------------------------------------
 * Deux flux distincts, volontairement séparés :
 *
 *  1. Photo de profil : traitée et envoyée DÈS le choix du fichier (pas
 *     besoin d'appuyer sur "Enregistrer" en plus) — c'est le comportement
 *     attendu sur mobile (Instagram, WhatsApp...), et ça évite de garder
 *     un gros fichier image en attente dans le navigateur.
 *
 *  2. Nom + bio : modifiables librement, envoyés ensemble seulement au
 *     clic sur "Enregistrer les modifications" — pour laisser le temps
 *     de se relire avant que ça parte.
 *
 * L'upload de la photo se fait EN DEUX TEMPS : le navigateur envoie
 * directement le fichier à Cloudinary (jamais à notre serveur — voir
 * uploadAvatar()), puis seulement l'URL renvoyée par Cloudinary est
 * envoyée à notre API pour être enregistrée sur le compte. Notre serveur
 * ne voit donc jamais le poids de l'image elle-même.
 */

const notLoggedInEl = document.getElementById('notLoggedIn');
const profileCardEl = document.getElementById('profileCard');

const avatarImgEl = document.getElementById('avatarImg');
const avatarFallbackEl = document.getElementById('avatarFallback');
const avatarInputEl = document.getElementById('avatarInput');
const avatarStatusEl = document.getElementById('avatarStatus');

const nameInputEl = document.getElementById('nameInput');
const bioInputEl = document.getElementById('bioInput');
const bioCountEl = document.getElementById('bioCount');
const saveStatusEl = document.getElementById('saveStatus');

const AVATAR_SIZE = 512;       // pixels — taille finale carrée envoyée à Cloudinary
const MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024; // 8 Mo — au-delà, on refuse avant même de traiter l'image

function showStatus(el, message, kind) {
  el.textContent = message;
  el.className = `field-status field-status-${kind}`; // 'success' | 'error' | 'pending'
  el.style.display = 'block';
}

function renderAvatar(user) {
  if (user.avatarUrl) {
    avatarImgEl.src = user.avatarUrl;
    avatarImgEl.style.display = 'block';
    avatarFallbackEl.style.display = 'none';
  } else {
    avatarImgEl.style.display = 'none';
    avatarFallbackEl.style.display = 'flex';
    avatarFallbackEl.textContent = (user.name || user.email || '?').charAt(0).toUpperCase();
  }
}

async function load() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      notLoggedInEl.style.display = 'block';
      return;
    }

    const user = await res.json();
    profileCardEl.style.display = 'block';

    renderAvatar(user);
    nameInputEl.value = user.name || '';
    bioInputEl.value = user.bio || '';
    bioCountEl.textContent = bioInputEl.value.length;
    document.getElementById('pRole').textContent = user.role === 'admin' ? 'Administrateur' : 'Membre';
    document.getElementById('pEmail').textContent = user.email;
    document.getElementById('pSince').textContent = new Date(user.createdAt).toLocaleDateString('fr-FR');
  } catch {
    notLoggedInEl.style.display = 'block';
    notLoggedInEl.textContent = 'Impossible de contacter le serveur.';
  }
}

/**
 * Recadre l'image en carré (centré, comme un avatar) et la redimensionne
 * à AVATAR_SIZE — fait entièrement dans le navigateur via <canvas>, avant
 * même l'envoi à Cloudinary. Ça garde le fichier envoyé petit (quelques
 * dizaines de Ko en JPEG) quelle que soit la taille de la photo d'origine
 * (un iPhone récent produit facilement des photos de 5-10 Mo).
 */
function fileToSquareBlob(file, size = AVATAR_SIZE) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Fichier image invalide.'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);

        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Échec de la conversion de l\'image.'))),
          'image/jpeg',
          0.85
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Mise en cache : /api/config n'a besoin d'être appelé qu'une fois par
// visite, sa valeur ne change jamais pendant que la page est ouverte.
let cloudinaryConfigPromise = null;
function getCloudinaryConfig() {
  if (!cloudinaryConfigPromise) {
    cloudinaryConfigPromise = fetch('/api/config').then((r) => r.json());
  }
  return cloudinaryConfigPromise;
}

/** Upload "non signé" : va DIRECTEMENT à Cloudinary, jamais via notre serveur. */
async function uploadToCloudinary(blob) {
  const { cloudinaryCloudName, cloudinaryUploadPreset } = await getCloudinaryConfig();
  if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
    throw new Error("Photo de profil non configurée côté serveur — voir DEPLOY.md.");
  }

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', cloudinaryUploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error("L'envoi de la photo a échoué.");

  const data = await res.json();
  return data.secure_url;
}

document.getElementById('avatarEditBtn').addEventListener('click', () => avatarInputEl.click());

avatarInputEl.addEventListener('change', async () => {
  const file = avatarInputEl.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showStatus(avatarStatusEl, 'Ce fichier n\'est pas une image.', 'error');
    return;
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    showStatus(avatarStatusEl, 'Image trop lourde (8 Mo max).', 'error');
    return;
  }

  showStatus(avatarStatusEl, 'Envoi de la photo…', 'pending');

  try {
    const blob = await fileToSquareBlob(file);
    const avatarUrl = await uploadToCloudinary(blob);

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Échec de l\'enregistrement.');

    const { user } = await res.json();
    renderAvatar(user);
    showStatus(avatarStatusEl, 'Photo de profil mise à jour.', 'success');
  } catch (err) {
    showStatus(avatarStatusEl, err.message || 'Une erreur est survenue.', 'error');
  } finally {
    avatarInputEl.value = ''; // permet de resélectionner le même fichier plus tard si besoin
  }
});

bioInputEl.addEventListener('input', () => {
  bioCountEl.textContent = bioInputEl.value.length;
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const name = nameInputEl.value.trim();
  if (!name) {
    showStatus(saveStatusEl, 'Le nom ne peut pas être vide.', 'error');
    return;
  }

  showStatus(saveStatusEl, 'Enregistrement…', 'pending');

  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio: bioInputEl.value }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Échec de l\'enregistrement.');

    showStatus(saveStatusEl, 'Modifications enregistrées.', 'success');
  } catch (err) {
    showStatus(saveStatusEl, err.message || 'Une erreur est survenue.', 'error');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

load();
