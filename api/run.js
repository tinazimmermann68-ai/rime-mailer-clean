export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const nowIso = new Date().toISOString();

    const planned = await fetch(process.env.BASE44_EXPORT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BASE44_API_KEY}`,
      },
      body: JSON.stringify({ now: nowIso, limit: 25 }),
    }).then(r => r.json());

    const plans = Array.isArray(planned?.plans) ? planned.plans : [];
    let queuedCreated = 0;

    for (const p of plans) {
      const createRes = await fetch(process.env.BASE44_CREATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BASE44_API_KEY}`,
        },
        body: JSON.stringify({ plan_id: p.id, now: nowIso }),
      }).then(r => r.json());

      queuedCreated += createRes?.created || 0;
    }

    return res.status(200).json({ ok: true, created: queuedCreated });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
