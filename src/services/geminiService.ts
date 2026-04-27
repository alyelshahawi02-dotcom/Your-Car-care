import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function findNearbyShops(location: string, carModel: string, specialty: string = "general maintenance") {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find verified car maintenance areas and service centers near ${location} for a ${carModel} that specialize in ${specialty}. 
      Return a list of shops with their specific focus/specialization, average prices for common services related to ${specialty}, and why they are privileged or better than others in this area.
      Format the response as a JSON array of objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              specialties: { type: Type.ARRAY, items: { type: Type.STRING } },
              priceInfo: { type: Type.STRING },
              advantage: { type: Type.STRING },
              verified: { type: Type.BOOLEAN }
            },
            required: ["name", "address", "specialties", "priceInfo", "advantage"]
          }
        },
        tools: [{ googleSearch: {} }],
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
}

export async function getCarUpgrades(carModel: string, location: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `For a ${carModel}, provide a comprehensive guide on performance and feature upgrades. 
      Include:
      1. Upgrades that enhance performance/features.
      2. Risks or upgrades that could damage the car (warranty issues, wear and tear).
      3. Recommended professionals or types of shops for these upgrades.
      4. Specific nearby locations near ${location} if they exist, or the nearest known hubs for these specific modifications if local options are scarce.
      Return the data in a structured JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            performanceUpgrades: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: {
                  name: { type: Type.STRING },
                  benefit: { type: Type.STRING },
                  risk: { type: Type.STRING }
                }
              } 
            },
            riskyUpgrades: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: {
                  name: { type: Type.STRING },
                  warning: { type: Type.STRING }
                }
              } 
            },
            professionals: { type: Type.STRING, description: "Advice on what kind of pros to seek" },
            locations: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: {
                  name: { type: Type.STRING },
                  address: { type: Type.STRING },
                  distance: { type: Type.STRING }
                }
              } 
            }
          }
        },
        tools: [{ googleSearch: {} }],
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Upgrade Advice Error:", error);
    return null;
  }
}
