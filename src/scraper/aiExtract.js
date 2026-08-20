import 'dotenv/config';
import { Type } from '@google/genai';
import { generateJSON } from '../gemini.js';

const EQUIPMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    equipment: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:           { type: Type.STRING },
          specifications: { type: Type.STRING },
          location:       { type: Type.STRING },
          status:         { type: Type.STRING },
        },
        required: ['name', 'specifications', 'location', 'status'],
      },
    },
  },
  required: ['equipment'],
};

/**
 * Layer 2 / historical extraction: pull structured equipment from ANY page content,
 * regardless of HTML layout. `content` is markdown or text from Bright Data.
 */
export async function extractByAI(content) {
  const prompt = [
    'You are extracting scientific lab equipment from a facility web page.',
    'Return ONLY equipment/instruments (microscopes, spectrometers, diffractometers, etc.).',
    'For each item, fill name, specifications, location, and status.',
    'If a field is unknown, use an empty string. Do not invent equipment that is not present.',
    '',
    'PAGE CONTENT:',
    content.slice(0, 100000),
  ].join('\n');

  const text = await generateJSON({ contents: prompt, responseSchema: EQUIPMENT_SCHEMA });

  const parsed = JSON.parse(text);
  return Array.isArray(parsed.equipment) ? parsed.equipment : [];
}
