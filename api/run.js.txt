export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const nowIso = new Date().toISOString();
// alte sending Einträge zurücksetzen
await fetch(process.env.BASE44_RESET_STUCK_URL, {
  method: "POST",
  headers: base44Headers(),
});

    const planned = await fetchJson(process.env.BASE44_EXPORT_DUE_PLANS_URL, {
      method: "POST",
      headers: base44Headers(),
      body: JSON.stringify({ now: nowIso, limit: 25 }),
    });

    const plans = Array.isArray(planned?.plans) ? planned.plans : [];
    let queuedCreated = 0;

    for (const p of plans) {
      const createRes = await fetchJson(process.env.BASE44_CREATE_QUEUE_FROM_PLAN_URL, {
        method: "POST",
        headers: base44Headers(),
        body: JSON.stringify({ plan_id: p.id, now: nowIso }),
      });
      queuedCreated += Number(createRes?.created || 0);
    }

    const due = await fetchJson(process.env.BASE44_EXPORT_URL, {
      method: "POST",
      headers: base44Headers(),
      body: JSON.stringify({ limit: 50 }),
    });

    const emails = Array.isArray(due?.emails) ? due.emails : [];

// Sicherheitsfilter: nur queued Mails senden
const filteredEmails = emails.filter(e => e.status === "queued" || !e.status);

    let sent = 0, failed = 0, skipped = 0;

for (const e of filteredEmails) {
      if (!e?.id || !e?.to || !e?.subject || (!e?.html && !e?.text)) {
        skipped++;
        continue;
      }

      const lockRes = await fetch(process.env.BASE44_LOCK_URL, {
        method: "POST",
        headers: base44Headers(),
        body: JSON.stringify({ email_id: e.id }),
      });

      if (lockRes.status === 409) { skipped++; continue; }
      if (!lockRes.ok) {
        failed++;
        await markFailed(e.id, `lock failed ${lockRes.status}: ${await lockRes.text()}`);
        continue;
      }

      const sendResult = await resendSend(e);

      if (!sendResult.ok) {
        failed++;
        await markFailed(e.id, sendResult.error);
        continue;
      }

      await fetch(process.env.BASE44_MARK_SENT_URL, {
  method: "POST",
  headers: base44Headers(),
  body: JSON.stringify({
    id: e.id,
    status: "gesendet",
    sent_at: new Date().toISOString(),
  }),
});

console.log("MARK SENT OK:", e.id);
    }

    return res.status(200).json({ ok: true, plans: plans.length, queuedCreated, count: emails.length, sent, failed, skipped });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

function base44Headers() {
  return {
    "Content-Type": "application/json",
    "api_key": process.env.BASE44_API_KEY,
  };
}

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t}`);
  return JSON.parse(t);
}

async function markFailed(emailId, error) {
  await fetch(process.env.BASE44_MARK_FAILED_URL, {
    method: "POST",
    headers: base44Headers(),
    body: JSON.stringify({
      email_id: emailId,
      last_error: String(error || "unknown"),
    }),
  });
}

async function resendSend(e) {
  const body = {
    from: process.env.RESEND_FROM,
    to: [e.to],
    subject: e.subject,
    html: e.html || undefined,
    text: e.text || undefined,
    reply_to: process.env.RESEND_REPLY_TO,
    headers: {
      "X-RIME-SENT-VIA": "resend",
      "X-RIME-MAIL-TYPE": e.type || "unknown",
      "X-RIME-EMAIL-ID": String(e.id),
    },
  };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const t = await r.text();
  if (!r.ok) return { ok: false, error: `${r.status} ${t}` };

  const j = JSON.parse(t);
  return { ok: true, messageId: j.id || null };
}