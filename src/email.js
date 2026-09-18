import { BREVO_API_KEY, BREVO_FROM_EMAIL, APP_URL } from './config.js';

/**
 * Appel direct à l'API REST de Brevo via fetch (natif depuis Node 18) —
 * pas besoin d'installer leur SDK pour un seul type d'email envoyé à un
 * seul endroit du projet. Même logique que l'upload Cloudinary : un appel
 * HTTP simple plutôt qu'une dépendance de plus à maintenir.
 *
 * Ne lève jamais d'exception vers l'appelant si Brevo n'est pas configuré
 * ou si l'envoi échoue — on log l'anomalie côté serveur et on avance quand
 * même, pour ne jamais faire planter la route qui l'appelle (voir
 * src/routes/auth.js : la réponse envoyée au navigateur est identique que
 * l'email existe ou non, donc un échec d'envoi ne doit pas non plus se
 * distinguer de ce point de vue).
 */
export async function sendPasswordResetEmail(toEmail, token) {
  if (!BREVO_API_KEY || !BREVO_FROM_EMAIL) {
    console.warn('⚠️  BREVO_API_KEY / BREVO_FROM_EMAIL manquant(s) — email de réinitialisation non envoyé (voir DEPLOY.md).');
    return;
  }

  const resetUrl = `${APP_URL}/reset-password.html?token=${token}`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Rodrick Hub', email: BREVO_FROM_EMAIL },
        to: [{ email: toEmail }],
        subject: 'Réinitialise ton mot de passe — Rodrick Hub',
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Réinitialisation de mot de passe</h2>
            <p>Tu as demandé à réinitialiser ton mot de passe sur Rodrick Hub.</p>
            <p><a href="${resetUrl}" style="display:inline-block;background:#2dd4bf;color:#090c16;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Choisir un nouveau mot de passe</a></p>
            <p style="color:#888;font-size:0.85rem;">Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore simplement cet email — ton mot de passe actuel reste inchangé.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Échec de l'envoi Brevo (HTTP ${res.status}) :`, body);
    }
  } catch (err) {
    console.error("Échec de l'envoi de l'email de réinitialisation :", err);
  }
}
