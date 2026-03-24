import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateProcessDiagram(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Genera un diagrama de proceso en formato Markdown (texto descriptivo o pasos) basado en la siguiente descripción:\n\n${prompt}`,
  });
  return response.text || '';
}

export async function extractTextFromFile(base64Data: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        }
      },
      "Extrae todo el texto relevante de este documento para analizar un proceso."
    ]
  });
  return response.text || '';
}

export async function analyzeProcessFromText(text: string): Promise<any> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Analiza el siguiente texto de un proceso y extrae la información en formato JSON.\n\nTexto:\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nombre del proceso" },
          code: { type: Type.STRING, description: "Código del proceso (si existe)" },
          objective: { type: Type.STRING, description: "Objetivo del proceso" },
          bizagiBasics: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              version: { type: Type.STRING },
              author: { type: Type.STRING }
            }
          },
          bizagiExtended: {
            type: Type.OBJECT,
            properties: {
              objective: { type: Type.STRING },
              scope: { type: Type.STRING },
              processOwner: { type: Type.STRING }
            }
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                lane: { type: Type.STRING, description: "Rol o área responsable" },
                name: { type: Type.STRING, description: "Nombre de la actividad" },
                type: { type: Type.STRING, description: "Tipo (task, gateway, event)" },
                subType: { type: Type.STRING, description: "Subtipo (user, manual, service, send, receive, etc)" },
                description: { type: Type.STRING }
              }
            }
          },
          indicators: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                goal: { type: Type.STRING },
                frequency: { type: Type.STRING },
                source: { type: Type.STRING }
              }
            }
          },
          riskMatrix: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                risk: { type: Type.STRING },
                impact: { type: Type.STRING, description: "Alto, Medio o Bajo" },
                probability: { type: Type.STRING },
                mitigation: { type: Type.STRING }
              }
            }
          },
          sipocMatrix: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                supplier: { type: Type.STRING },
                input: { type: Type.STRING },
                process: { type: Type.STRING },
                output: { type: Type.STRING },
                customer: { type: Type.STRING }
              }
            }
          },
          raciMatrix: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                exec: { type: Type.STRING, description: "Actividad" },
                resp: { type: Type.STRING, description: "Responsible" },
                cons: { type: Type.STRING, description: "Consulted" },
                info: { type: Type.STRING, description: "Informed" }
              }
            }
          }
        }
      }
    }
  });
  
  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return {};
  }
}
