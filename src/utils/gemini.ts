import { GoogleGenAI } from '@google/genai';
import { TrackingSettings } from '../types';

export interface GeminiRecommendation {
  name: string;
  description: string;
  settings: Partial<TrackingSettings>;
}

export interface GeminiResponse {
  analysis: string;
  optionA: GeminiRecommendation;
  optionB: GeminiRecommendation;
}

/**
 * Sanitizes API keys by trimming whitespace and stripping enclosing quotes.
 */
function sanitizeApiKey(key: string): string {
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

/**
 * Initializes the GoogleGenAI client using the provided key,
 * local storage fallback, or environment variables.
 */
export function getGeminiClient(userApiKey?: string) {
  const rawKey =
    userApiKey ||
    localStorage.getItem('gemini_api_key') ||
    (import.meta.env.VITE_GEMINI_API_KEY as string) ||
    (import.meta.env.GEMINI_API_KEY as string) ||
    '';

  const apiKey = sanitizeApiKey(rawKey);

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  try {
    return new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error('Failed to initialize GoogleGenAI client:', error);
    return null;
  }
}

/**
 * Sends a captured frame (dataUrl) to Gemini for analysis
 * and returns recommended settings based on the scene.
 */
export async function analyzeScene(dataUrl: string, userApiKey?: string): Promise<GeminiResponse> {
  const rawKey =
    userApiKey ||
    localStorage.getItem('gemini_api_key') ||
    (import.meta.env.VITE_GEMINI_API_KEY as string) ||
    (import.meta.env.GEMINI_API_KEY as string) ||
    '';

  const apiKey = sanitizeApiKey(rawKey);

  const ai = getGeminiClient(apiKey);
  if (!ai || !apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  // Extract base64 image data
  const base64Data = dataUrl.split(',')[1];
  const mimeType = dataUrl.split(';')[0].split(':')[1];

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };

  const promptText = `You are an expert AI assistant for a Juggling Trail Camera application. Your job is to analyze the provided camera frame snapshot and recommend two highly customized tracking and visual effect presets.

First, perform a detailed analysis of the scene in the image:
1. Detect lighting conditions: Is it a dark/dim room, normally lit indoor room, bright outdoor sunlight, or high contrast spotlight?
2. Detect background clutter: Is the background simple and clean (e.g., plain wall), or is it cluttered (e.g., furniture, trees, moving objects, noise)?
3. Detect juggling props: Are there visible props? If so, what type and color (e.g. green clubs, white balls, glowing LED balls)?

Second, recommend two distinct configurations tailored specifically to your scene analysis:

- **Option A (Optimal Technical Tracking)**:
  Focuses on getting the cleanest, most accurate tracking of moving props with minimal noise or false trails, tailored to the scene's lighting and clutter.
  - If the room is dark or dim and props are bright/glowing, configure high-contrast LED tracking by setting:
    - enableLightTracking: true
    - lightThreshold: a high value (160 to 220) to filter out background details
    - motionThreshold: 45 to 65
    - bgLearningRate: 0.05 to 0.1
  - If the room has normal or bright lighting and standard props, configure motion-based tracking:
    - enableLightTracking: false
    - motionThreshold: 35 to 55 (lower if clean background, higher if cluttered/noisy to avoid false trails)
    - bgLearningRate: 0.03 to 0.08
  - Give it a highly descriptive, technical name based on your observations, e.g., "High-Contrast LED Tracer", "Daylight Silhouette Tracker", "Cluttered Room Motion Filter", "Outdoor High-Speed Capture".
  - Write a description explaining why these specific CV values (sensitivity, light tracking, etc.) were chosen for their background and lighting.

- **Option B (Artistic / Creative Preset)**:
  Focuses on generating a visually stunning, premium-looking creative effect that matches the vibe of the environment.
  - Choose one of the following creative concepts based on the scene:
    1. **"Neon Cyberpunk Glow"** (Best for dim rooms or glowing props): Set blurAmount: 6 to 12 (glow), colorCycleSpeed: 3 to 6 (slow rainbow cycle), echoFadeRate: 0.02 to 0.04 (medium-long trails), feedbackZoom: 1.01 (expanding trails).
    2. **"Spectral Smoke / Ghosting"** (Best for clean backgrounds): Set verticalDrift: -2 to -4 (trails rise up like smoke), horizontalDrift: 1 to 2, echoFadeRate: 0.01 to 0.03 (very long persistent trails), blurAmount: 4 to 8, compositeMode: "lighter" or "screen".
    3. **"Stroboscopic Matrix"** (Best for complex patterns or cluttered rooms where trails smear too much): Set strobeRate: 0.15 to 0.35 (captures discrete snapshot frames), strobeMode: "freeze", echoFadeRate: 0.08 to 0.15 (medium length freeze frames), lineSmoothness: 2 to 5.
    4. **"Retro Trails"** (Best for bright/active rooms): Set colorCycleSpeed: 0, hueRotate: 180 to 270 (shifts prop color to a cool complementary color), echoFadeRate: 0.04 to 0.07, motionBlur: 0.2 to 0.4.
  - Give it a highly descriptive, evocative, artistic name, e.g., "Psychedelic Rainbow Flow", "Ethereal Smoke Tracer", "Chronophotography Strobe Matrix", "Retro Neon Shift".
  - Write a description explaining the aesthetic style, how the trails will look, and why it fits their environment.

Return your response in JSON format matching this schema:
{
  "analysis": "A detailed 2-3 sentence analysis of the environment (lighting, background clutter, and props detected). Make it specific to what you see.",
  "optionA": {
    "name": "Evocative technical name",
    "description": "Short explanation of why these settings were chosen for their environment and how they improve tracking accuracy.",
    "settings": {
      // tracking settings...
    }
  },
  "optionB": {
    "name": "Evocative artistic name",
    "description": "Short explanation of the creative concept, visual effect, and why it fits the vibe.",
    "settings": {
      // tracking settings...
    }
  }
}

Here are the details and valid ranges of settings you can recommend:
1. enableTrails (boolean): Whether motion trails are rendered.
2. motionThreshold (integer, 15 to 120): CV motion detection sensitivity. Default is 50. Lower is more sensitive. Use higher value (e.g., 60-80) for noisy backgrounds to prevent noise trails. Use lower (e.g. 30-45) for clean setups.
3. enableLightTracking (boolean): If true, filters by brightness. Set to true if props are significantly brighter than the background (e.g. glowing LED balls in a dim room).
4. lightThreshold (integer, 0 to 255): Minimum brightness required for tracking. Use higher values (e.g. 180-230) for glowing LED props in dark rooms, or lower for general tracking.
5. echoFadeRate (number, 0.01 to 1.0): Speed at which trails fade. Lower means longer trails. E.g., 0.02 for long flowy trails, 0.2 for short trails.
6. bgLearningRate (number, 0.001 to 1.0): Speed at which background adapts. Use higher values (e.g., 0.1) if the camera moves or lighting fluctuates. Use lower values (e.g., 0.02) to prevent slow-moving props from fading into the background.
7. blurAmount (integer, 0 to 20): Trail glow/blur in pixels. 0 is sharp, higher is glowing.
8. hueRotate (integer, 0 to 360): Hue shift in degrees.
9. colorCycleSpeed (number, 0 to 20): Speed at which hue cycles. E.g. 2 for slow cycle, 10 for rapid rainbow cycles.
10. strobeRate (number, 0 to 2.0): Strobe snapshot interval in seconds. 0 is continuous trails. e.g., 0.2 to capture distinct freeze-frames.
11. strobeMode (string): "freeze" (keeps frames on screen) or "flash" (flashes frames briefly).
12. feedbackZoom (number, 0.95 to 1.10): Feedback zoom scaling. > 1.0 creates outward trailing tunnels. < 1.0 creates inward tunnels. 1.0 is flat.
13. verticalDrift (number, -10 to 10): Pixels the trail moves vertically per frame. E.g., -2 for trails drifting upwards (like smoke).
14. horizontalDrift (number, -10 to 10): Pixels the trail moves horizontally per frame.
15. motionBlur (number, 0 to 1.0): Frame blend percentage for motion blur.
16. lineSmoothness (integer, 0 to 20): Blur applied to the mask for smoother anti-aliased trails.
`;

  try {
    console.log(`Analyzing scene using Gemini 3.5 Flash...`);
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta'
      }
    });

    console.time('Gemini API Request Duration');
    let response: any;
    try {
      const apiCall = ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [imagePart, promptText],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              analysis: {
                type: 'STRING',
                description: 'Short summary of the environment analysis (lighting, background, props detected).',
              },
              optionA: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  description: { type: 'STRING' },
                  settings: {
                    type: 'OBJECT',
                    properties: {
                      enableTrails: { type: 'BOOLEAN' },
                      motionThreshold: { type: 'INTEGER' },
                      enableLightTracking: { type: 'BOOLEAN' },
                      lightThreshold: { type: 'INTEGER' },
                      echoFadeRate: { type: 'NUMBER' },
                      bgLearningRate: { type: 'NUMBER' },
                      blurAmount: { type: 'INTEGER' },
                      hueRotate: { type: 'INTEGER' },
                      colorCycleSpeed: { type: 'NUMBER' },
                      strobeRate: { type: 'NUMBER' },
                      strobeMode: { type: 'STRING', enum: ['freeze', 'flash'] },
                      feedbackZoom: { type: 'NUMBER' },
                      verticalDrift: { type: 'NUMBER' },
                      horizontalDrift: { type: 'NUMBER' },
                      motionBlur: { type: 'NUMBER' },
                      lineSmoothness: { type: 'INTEGER' },
                    },
                  },
                },
                required: ['name', 'description', 'settings'],
              },
              optionB: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  description: { type: 'STRING' },
                  settings: {
                    type: 'OBJECT',
                    properties: {
                      enableTrails: { type: 'BOOLEAN' },
                      motionThreshold: { type: 'INTEGER' },
                      enableLightTracking: { type: 'BOOLEAN' },
                      lightThreshold: { type: 'INTEGER' },
                      echoFadeRate: { type: 'NUMBER' },
                      bgLearningRate: { type: 'NUMBER' },
                      blurAmount: { type: 'INTEGER' },
                      hueRotate: { type: 'INTEGER' },
                      colorCycleSpeed: { type: 'NUMBER' },
                      strobeRate: { type: 'NUMBER' },
                      strobeMode: { type: 'STRING', enum: ['freeze', 'flash'] },
                      feedbackZoom: { type: 'NUMBER' },
                      verticalDrift: { type: 'NUMBER' },
                      horizontalDrift: { type: 'NUMBER' },
                      motionBlur: { type: 'NUMBER' },
                      lineSmoothness: { type: 'INTEGER' },
                    },
                  },
                },
                required: ['name', 'description', 'settings'],
              },
            },
            required: ['analysis', 'optionA', 'optionB'],
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Google API server is taking too long to respond.')), 20000)
      );

      response = await Promise.race([apiCall, timeoutPromise]);
      console.timeEnd('Gemini API Request Duration');
    } catch (apiErr) {
      console.timeEnd('Gemini API Request Duration');
      throw apiErr;
    }

    if (response && response.text) {
      return JSON.parse(response.text) as GeminiResponse;
    }
    throw new Error('Received empty response from Gemini.');
  } catch (error: any) {
    console.error('Gemini analysis failed:', error);
    
    const status = error.status || '';
    const message = error.message || '';
    const code = error.code || 0;
    const rawMsg = message + ' ' + status + ' ' + JSON.stringify(error);

    let friendlyMessage = `Gemini API Error: ${message}`;
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
      friendlyMessage = `Gemini is temporarily experiencing high demand (503 Service Unavailable). Please wait a few seconds and try again.`;
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('quota')) {
      friendlyMessage = `Gemini API quota or rate limit exceeded (429). Please wait a minute before retrying.`;
    } else if (rawMsg.includes('not found') || rawMsg.includes('NOT_FOUND') || rawMsg.includes('404')) {
      friendlyMessage = `Gemini model not found (404). Please ensure you created a standard API key from Google AI Studio (https://aistudio.google.com/) and that the key starts with 'AQ.Ab8R'.`;
    } else if (rawMsg.includes('API key not valid') || rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('forbidden')) {
      friendlyMessage = `Invalid API Key (403/Forbidden). Please verify your key at Google AI Studio (https://aistudio.google.com/).`;
    }
    throw new Error(friendlyMessage);
  }
}
