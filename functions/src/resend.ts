import * as logger from 'firebase-functions/logger';
import { FROM_ADDRESS } from './config';

/**
 * Wysyłka przez Resend HTTP API.
 *
 * Bez pakietu `resend` — jedno wywołanie fetch waży mniej niż zależność, którą
 * trzeba potem utrzymywać, a Node 22 ma fetch wbudowany.
 */

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html, text }),
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      /* Resend zwraca JSON, ale przy błędzie bramy potrafi oddać HTML. */
    }

    if (!res.ok) {
      const message = data?.message || data?.error || raw.slice(0, 200);
      return { ok: false, error: `Resend ${res.status}: ${message}` };
    }
    return { ok: true, id: data?.id };
  } catch (err: any) {
    // Sieć albo timeout. Świadomie nie rzucamy dalej: nieudane powiadomienie
    // nie może wywrócić funkcji ani wywołać ponowień, które wyślą duplikaty.
    logger.error('Resend: wywołanie nie doszło do skutku', err);
    return { ok: false, error: err?.message || String(err) };
  }
}
