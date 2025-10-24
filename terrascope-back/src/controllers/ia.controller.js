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
Eres un experto en biología y taxonomía. Analiza cuidadosamente la siguiente imagen y determina la especie del ser vivo que aparece (animal o planta).

Devuelve **únicamente** un JSON **válido y sin texto adicional**, con el siguiente formato exacto:
{
  "nombre_cientifico": "Nombre científico de la especie",
  "nombre_comun": "Nombre común o popular en español",
  "nivel_confianza": "Alto | Medio | Bajo"
}

Reglas:
- Si hay más de un ser vivo en la imagen, identifica solo el más visible o central.
- Si no puedes identificar la especie con claridad, coloca:
  "nombre_cientifico": "Desconocido",
  "nombre_comun": "Desconocido",
  "nivel_confianza": "Bajo"
- No incluyas texto explicativo ni comentarios fuera del JSON.
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
