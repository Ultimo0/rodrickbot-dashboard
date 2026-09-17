import { Resend } from 'resend';
import { RESEND_API_KEY, RESEND_FROM_EMAIL, APP_URL } from './config.js';

// Un seul client, réutilisé pour chaque envoi — inutile d'en recréer un
// par appel, il ne garde aucun état propre à une requête particulière.
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Envoie l'email de réinitialisation de mot de passe. Ne lève jamais
 * d'exception vers l'appelant si Resend n'est pas configuré — on log
 * l'anomalie côté serveur et on avance quand même, pour ne jamais faire
 * planter la route qui l'appelle (voir src/routes/auth.js : la réponse
 * envoyée au navigateur est identique que l'email existe ou non, donc un
 * échec d'envoi ne doit pas non plus se distinguer de ce point de vue).
 */
export async function sendPasswordResetEmail(toEmail, token) {
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY manquant — email de réinitialisation non envoyé (voir DEPLOY.md).');
    return;
  }

  const resetUrl = `${APP_URL}/reset-password.html?token=${token}`;

  try {
    await resend.emails.send({
      from: `Rodrick Hub <${RESEND_FROM_EMAIL}>`,
      to: toEmail,
      subject: 'Réinitialise ton mot de passe — Rodrick Hub',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Réinitialisation de mot de passe</h2>
          <p>Tu as demandé à réinitialiser ton mot de passe sur Rodrick Hub.</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#2dd4bf;color:#090c16;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Choisir un nouveau mot de passe</a></p>
          <p style="color:#888;font-size:0.85rem;">Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore simplement cet email — ton mot de passe actuel reste inchangé.</p>
        </div>
      `,
    });
  } catch (err) {
    // Idem : on log pour pouvoir diagnostiquer depuis les logs Render,
    // mais on ne fait jamais remonter l'échec jusqu'à la réponse HTTP.
    console.error('Échec de l\'envoi de l\'email de réinitialisation :', err);
  }
}
