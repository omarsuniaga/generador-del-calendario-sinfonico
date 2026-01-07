
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function parseNaturalLanguageActivity(input: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analiza esta actividad musical y conviértela a JSON: "${input}". 
               Año actual: ${new Date().getFullYear()}. 
               Es para un calendario sinfónico profesional. 
               Campos: title, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), color (hex), program (Orquesta, Coro, o General).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          color: { type: Type.STRING },
          program: { type: Type.STRING },
        },
        required: ["title", "startDate", "endDate", "color", "program"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return null;
  }
}

export async function analyzeCalendarConflicts(activities: any[]) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analiza estos eventos musicales en busca de conflictos logísticos o sobrecarga de programas: ${JSON.stringify(activities)}. 
               Identifica si hay ensayos el mismo día para diferentes programas que podrían requerir los mismos espacios o músicos.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING, description: "Mensaje de advertencia o sugerencia" },
            severity: { type: Type.STRING, enum: ["info", "warning"] }
          }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return [];
  }
}

export async function getMusicalSuggestions(program: string, count: number = 3) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Sugiere ${count} obras musicales y compositores para un programa de ${program}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            composer: { type: Type.STRING },
          }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return [];
  }
}

export async function generateInstitutionalPlan(activities: any[], institution: string, month: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Actúa como el Director Académico de la institución "${institution}". 
               Redacta un Plan Operativo Mensual formal para el mes de ${month}.
               Usa estas actividades como base: ${JSON.stringify(activities)}.
               
               El documento debe estar estructurado en JSON con las siguientes secciones:
               - introduccion: Un párrafo formal sobre el propósito del mes.
               - objetivos: Una lista de 3 objetivos estratégicos.
               - justificacion: Por qué estas actividades son importantes para la formación musical.
               - resumenActividades: Una descripción narrativa de los hitos más importantes.
               - conclusiones: Un párrafo de cierre institucional.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          introduccion: { type: Type.STRING },
          objetivos: { type: Type.ARRAY, items: { type: Type.STRING } },
          justificacion: { type: Type.STRING },
          resumenActividades: { type: Type.STRING },
          conclusiones: { type: Type.STRING }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return null;
  }
}
