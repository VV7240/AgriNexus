import { GoogleGenAI, Type } from '@google/genai';
import { EnrichedBatch, Language, MarketPrice, User } from '../src/types';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const POST_HARVEST_KNOWLEDGE_BASE = `
ICAR-CIPHET Post-Harvest Best Practices:
1. Tomatoes: Optimal cold storage is 10–12°C (chilling injury occurs below 8°C). Pre-cool within 4 hours of harvest. High ethylene sensitivity; avoid storing with ripe bananas.
2. Onions: Cure for 5–7 days in shaded ventilated racks before storage. Optimal storage is 0–4°C at 65–70% RH or ventilated ambient structures.
3. Okra (Bhindi): Highly perishable; deteriorates rapidly above 25°C. Optimal cold storage 7–10°C at 90% RH. Dispatch or process within 24–36 hours if ambient >28°C.
4. Potatoes: Store at 4°C for table use (10–12°C for processing chips to avoid cold-induced sweetening).
5. Mangoes: Optimal storage 12–13°C. Avoid bruising during crating; hot-water dip reduces anthracnose.
6. Cluster Pooling: Grouping nearby farmers in a 24–48h harvest window reduces per-kg transport freight by 28–42% and unlocks terminal mandi arbitrage (e.g. Vashi APMC / Azadpur).
`;

export interface AssistResponsePayload {
  reply: string;
  uncertain: boolean;
  escalateHelpdesk: boolean;
}

export async function generateAgriNexusAssistReply(params: {
  question: string;
  language: Language;
  user: User;
  selectedBatch?: EnrichedBatch;
  allBatches: EnrichedBatch[];
  marketPrices: MarketPrice[];
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<AssistResponsePayload> {
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Configure it in Settings > Secrets.'
    );
  }

  const batchContext = params.selectedBatch
    ? {
        id: params.selectedBatch.id,
        crop: params.selectedBatch.crop,
        quantityKg: params.selectedBatch.quantityKg,
        locality: params.selectedBatch.locality,
        ambientTempC: params.selectedBatch.ambientTempC,
        storageMode: params.selectedBatch.storageMode,
        status: params.selectedBatch.status,
        digitalTwin: {
          qualityScore: params.selectedBatch.digitalTwin.qualityScore,
          spoilageRisk: params.selectedBatch.digitalTwin.spoilageRisk,
          remainingShelfLifeHours: params.selectedBatch.digitalTwin.remainingShelfLifeHours,
          hoursElapsed: params.selectedBatch.digitalTwin.hoursElapsed,
          riskLevel: params.selectedBatch.digitalTwin.riskLevel,
        },
        recommendation: params.selectedBatch.recommendation,
      }
    : params.allBatches.slice(0, 5).map((b) => ({
        id: b.id,
        crop: b.crop,
        quantityKg: b.quantityKg,
        qualityScore: b.digitalTwin.qualityScore,
        spoilageRisk: b.digitalTwin.spoilageRisk,
        recommendedAction: b.recommendation.recommendedAction,
        expectedValueInr: b.recommendation.expectedValue,
      }));

  const relevantPrices = params.marketPrices
    .filter(
      (p) =>
        !params.selectedBatch ||
        p.crop.toLowerCase() === params.selectedBatch.crop.toLowerCase()
    )
    .slice(0, 6);

  const systemInstruction = `You are AgriNexus Assist, an agricultural post-harvest decision intelligence assistant for Indian farmers and FPOs.
STRICT GROUNDING RULES:
1. Answer ONLY using the LIVE DATA CONTEXT and POST-HARVEST KNOWLEDGE BASE below. Never invent prices, batch figures, weather forecasts, or external facts not present in the context.
2. Language: Respond fluently and clearly in ${params.language === 'hi' ? 'Hindi (हिन्दी, Devanagari script with simple everyday agricultural terms)' : 'English (plain, clear, farmer-friendly language)'}.
3. Uncertainty Guardrail (FR-9.4): If the user asks about anything outside post-harvest batch quality, mandi prices, cluster pooling, or the provided agronomy guidelines (or asks for data not in the context), set uncertain=true and escalateHelpdesk=true, and explicitly state what you do not know instead of guessing.
4. Keep answers concise (3–5 sentences), citing exact ₹ values, kg quantities, quality %, and remaining shelf-life hours from the live context.

USER PROFILE:
Name: ${params.user.name} | Role: ${params.user.role} | Locality: ${params.user.locality} | FPO: ${params.user.fpoName}

LIVE BATCH & DECISION CONTEXT:
${JSON.stringify(batchContext, null, 2)}

LIVE MANDI PRICES (Agmarknet / eNAM):
${JSON.stringify(relevantPrices, null, 2)}

${POST_HARVEST_KNOWLEDGE_BASE}`;

  const recentHistory = params.history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Farmer/User' : 'AgriNexus Assist'}: ${m.text}`)
    .join('\n');

  const prompt = `${recentHistory ? `CONVERSATION HISTORY:\n${recentHistory}\n\n` : ''}USER QUESTION: ${params.question}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Clear, grounded response in the requested language.',
          },
          uncertain: {
            type: Type.BOOLEAN,
            description: 'True if the question could not be answered from live context or agronomy guidelines.',
          },
          escalateHelpdesk: {
            type: Type.BOOLEAN,
            description: 'True if the user should be offered the Contact FPO Helpdesk escalation option.',
          },
        },
        required: ['reply', 'uncertain', 'escalateHelpdesk'],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Empty response received from Gemini API.');
  }
  const parsed = JSON.parse(rawText) as AssistResponsePayload;
  return parsed;
}
