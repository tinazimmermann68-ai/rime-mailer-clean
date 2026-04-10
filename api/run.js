import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    // 🔹 Queue aus Base44 holen
    const queueRes = await fetch(process.env.BASE44_QUEUE_URL, {
      headers: {
        Authorization: `Bearer ${process.env.BASE44_API_KEY}`,
      },
    });

    const data = await queueRes.json();
    const queue = data?.items || [];

    let sent = 0;

    for (const mail of queue) {
      try {
        // 🔹 Mail senden
        await resend.emails.send({
          from: "onboarding@resend.dev",
          to: mail.empfaenger_email,
          subject: mail.betreff,
          html: mail.inhalt,
        });

        // 🔹 Status zurückmelden
        await fetch(process.env.BASE44_MARK_SENT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.BASE44_API_KEY}`,
          },
          body: JSON.stringify({
            id: mail.id,
            status: "gesendet",
          }),
        });

        sent++;
      } catch (err) {
        console.error("Fehler bei Mail:", err);
      }
    }

    return res.status(200).json({
      ok: true,
      processed: queue.length,
      sent,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
