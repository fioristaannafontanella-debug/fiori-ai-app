import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ✅ Windows-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ static files
app.use(express.static(path.join(__dirname, "public")));

// ✅ OpenAI client (una volta sola)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// ✅ generate (testo + immagine)
app.post("/api/generate", async (req, res) => {
  try {
    const { occasion, palette, style, budget, size } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: "Errore generazione AI",
        details: "Manca OPENAI_API_KEY nel file .env",
      });
    }

    if (!style || budget === undefined || budget === null) {
      return res.status(400).json({
        error: "Errore generazione AI",
        details: "Dati mancanti: servono almeno style e budget",
      });
    }

    const safeBudget = Math.max(35, Number(budget || 35));

    const text = `
Bouquet ${String(style).toLowerCase()}.
Occasione: ${occasion || "—"}
Palette: ${palette || "—"}
Dimensione: ${size || "—"}
Budget: ${safeBudget}€.

Una composizione armoniosa, elegante e pensata per emozionare.
    `.trim();

    const prompt = `
Ultra realistic professional florist photograph of a ${String(style).toLowerCase()} bouquet.
Occasion: ${occasion || "gift"}.
Color palette: ${palette || "powder pink and sage"}.
Bouquet size: ${size || "medium"}.
Visual richness consistent with a ${safeBudget} EUR bouquet.
Natural seasonal flowers, premium wrap, soft daylight, neutral background.
Luxury floral photography, shallow depth of field, ultra realistic.
    `.trim();

    const imgResp = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const b64 = imgResp?.data?.[0]?.b64_json;

    if (!b64) {
      return res.status(500).json({
        error: "Errore generazione AI",
        details: "OpenAI ha risposto ma non ha fornito b64_json (risposta inattesa).",
      });
    }

    const dataUrl = `data:image/png;base64,${b64}`;
const upload = await cloudinary.uploader.upload(dataUrl, { folder: "bouquet-quiz" });
const image_url = upload.secure_url;

return res.json({ text, image_base64: b64, image_url });
  } catch (err) {
    // ✅ log vero in console
    console.error("❌ ERRORE OPENAI:", err);

    // ✅ prova a estrarre un messaggio utile
    const details =
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      err?.message ||
      String(err);

    return res.status(500).json({
      error: "Errore generazione AI",
      details,
    });
  }
});

// server
const PORT = 8790;
app.listen(PORT, () => console.log(`✅ Server su http://localhost:${PORT}`));
