import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

export type Mail = { to: string; subject: string; text: string; html?: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const config = env.mail;
  if (config.driver !== 'smtp') return null;
  if (!config.host) {
    console.error('MAIL_DRIVER=smtp but SMTP_HOST is not set; mail will not be sent.');
    return null;
  }
  transporter ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });
  return transporter;
}

/**
 * Sending must never fail a user-facing flow. A parent asking for a password
 * reset sees the same confirmation either way; a delivery problem is the
 * operator's to see in the logs.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.info(
      `[mail:console] to=${mail.to}\n  subject: ${mail.subject}\n  ${mail.text.replace(/\n/g, '\n  ')}`,
    );
    return;
  }
  try {
    await transport.sendMail({ from: env.mail.from, ...mail });
  } catch (error) {
    console.error(`Failed to send mail to ${mail.to}:`, error);
  }
}

export function passwordResetMail(to: string, url: string): Mail {
  const text = [
    'Hallo,',
    '',
    'Je vroeg een nieuw wachtwoord aan voor je profiel op de website van de Sint-Jorisschool.',
    'Klik op onderstaande link om een nieuw wachtwoord te kiezen. De link blijft 1 uur geldig.',
    '',
    url,
    '',
    'Heb je dit niet aangevraagd? Dan mag je deze email negeren. Je wachtwoord blijft ongewijzigd.',
    '',
    'Met vriendelijke groeten,',
    'Sint-Jorisschool Tielt-Winge',
  ].join('\n');

  return {
    to,
    subject: 'Nieuw wachtwoord voor je profiel',
    text,
    html: `<p>Hallo,</p>
<p>Je vroeg een nieuw wachtwoord aan voor je profiel op de website van de Sint-Jorisschool.
Klik op onderstaande link om een nieuw wachtwoord te kiezen. De link blijft 1 uur geldig.</p>
<p><a href="${url}">Kies een nieuw wachtwoord</a></p>
<p>Heb je dit niet aangevraagd? Dan mag je deze email negeren. Je wachtwoord blijft ongewijzigd.</p>
<p>Met vriendelijke groeten,<br>Sint-Jorisschool Tielt-Winge</p>`,
  };
}

export function welcomeMail(to: string): Mail {
  const text = [
    'Welkom op de website van de Sint-Jorisschool!',
    '',
    `Je profiel werd aangemaakt voor ${to}.`,
    'Voeg je kinderen toe in je profiel om drankkaarten, badmutsen, gym T-shirts en warme',
    'maaltijden te kunnen bestellen, en om de schoolkrant van hun klas te volgen.',
    '',
    'Met vriendelijke groeten,',
    'Sint-Jorisschool Tielt-Winge',
  ].join('\n');
  return { to, subject: 'Welkom bij de Sint-Jorisschool', text };
}
