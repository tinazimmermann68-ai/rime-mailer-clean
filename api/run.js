export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://ri-me-seminar-hub-316f32aa.base44.app/functions/consumeScheduledEmails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Key": process.env.WORKER_KEY,
        },
        body: JSON.stringify({}),
      }
    );

    const data = await response.json();

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error),
    });
  }
}
