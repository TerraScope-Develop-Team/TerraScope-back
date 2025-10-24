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


export const validarRegistroFaunaFlora = async (req, res) => {
  try {
    const {
      nombre_comun,
      nombre_cientifico,
      especie,
      descripcion,
      tipo,
      comportamiento,
      estado_extincion,
      habitat,
    } = req.body;

    // 🔹 Validar que los datos básicos existan
    if (
      !nombre_comun ||
      !nombre_cientifico ||
      !especie ||
      !descripcion ||
      !habitat?.nombre_habitat
    ) {
      return res.status(400).json({
        message: "Faltan campos obligatorios para la validación contextual.",
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 🔹 Prompt con contexto biológico
    const prompt = `
Eres un experto en biología y validación de datos ecológicos.
Analiza si la información proporcionada sobre un registro de fauna o flora es **coherente y realista**.

Datos recibidos:
- Nombre común: ${nombre_comun}
- Nombre científico: ${nombre_cientifico}
- Tipo: ${tipo} (debe ser únicamente "fauna" o "flora")
- Especie: ${especie} (indica la categoría biológica: mamífero, ave, reptil, anfibio, pez, insecto, planta, hongo, etc.)
- Descripción: ${descripcion}
- Comportamiento: ${comportamiento}
- Estado de extinción: ${estado_extincion}
- Hábitat: ${habitat.nombre_habitat}
- Descripción del hábitat: ${habitat.descripcion_habitat || "No especificada"}

Devuelve **únicamente un JSON válido y sin texto adicional** con el siguiente formato exacto:
{
  "es_coherente": true | false,
  "errores_detectados": ["lista de inconsistencias encontradas"],
  "sugerencia": "Texto breve que indique cómo mejorar los datos si es necesario"
}

Criterios de validación:
1. El campo "tipo" debe ser exactamente "fauna" o "flora". Marca error si es otro valor.
2. La "especie" debe corresponder a una categoría biológica válida para el tipo indicado.
3. La especie debe vivir realmente en el hábitat proporcionado.
4. La descripción y el comportamiento deben coincidir con el tipo y categoría biológica.
5. El estado de extinción debe ser plausible según la especie. - Considera las categorías estándar de la UICN (Preocupación menor, Vulnerable, En peligro, En peligro critico, Extinta).
6. Si todo es coherente, marca "es_coherente": true y deja "errores_detectados": [], y en "sugerencia" coloca:
   "Todos los datos son correctos, no se detectaron errores.".
`;


    const result = await model.generateContent([prompt]);
    const respuesta = result.response.text();

    // 🔹 Limpieza y parseo del JSON
    let parsed;
    try {
      const cleanText = respuesta.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (err) {
      console.error("Error parseando respuesta de IA:", respuesta);
      parsed = {
        es_coherente: false,
        errores_detectados: ["Error al interpretar la respuesta del modelo."],
        sugerencia: "Verifica los datos ingresados e intenta nuevamente.",
      };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Error en validación IA:", error);
    res.status(500).json({
      message: "Error interno al validar con IA",
      error: error.message,
    });
  }
};