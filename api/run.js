import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    // TEST: erstmal nur prüfen ob Funktion läuft
    return res.status(200).json({
      ok: true,
      message: "API läuft – nächster Schritt: Queue anbinden"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
