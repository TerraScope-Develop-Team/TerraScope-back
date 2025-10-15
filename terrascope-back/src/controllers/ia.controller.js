import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const identificarEspecie = async (req, res) => {
  try {
    const { imagen } = req.body;

    if (!imagen) {
      return res.status(400).json({ message: "No se recibió ninguna imagen en base64" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


    const prompt = `
      Analiza la imagen y devuelve un JSON con esta estructura exacta:
      {
        "nombre_cientifico": "...",
        "nombre_comun": "...",
        "nivel_confianza": "..."
      }
      Si no reconoces la especie, coloca "Desconocido".
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imagen, 
        },
      },
    ]);

    const respuesta = result.response.text();

    let parsed;
    try {
      const cleanText = respuesta
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(cleanText);
    } catch (err) {
      console.error("Error parseando JSON:", respuesta);
      parsed = {
        nombre_comun: "Desconocido",
        nombre_cientifico: "Desconocido",
        nivel_confianza: "Bajo",
      };
    }


    res.status(200).json(parsed);
  } catch (error) {
    console.error("Error IA:", error);
    res.status(500).json({
      message: "Error al identificar especie",
      error: error.message,
    });
  }
};
