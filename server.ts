import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Initialize the Google GenAI SDK
// Access API key from server environment
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Server-side route to execute text/ideation requests
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model, systemInstruction, config } = req.body;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets.',
      });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const selectedModel = model || 'gemini-3.5-flash';

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: config?.temperature ?? 0.7,
        topP: config?.topP ?? 0.95,
        topK: config?.topK ?? 64,
        maxOutputTokens: config?.maxOutputTokens,
      },
    });

    res.json({
      text: response.text || '',
      success: true,
    });
  } catch (error: any) {
    console.error('Gemini API Integration Error:', error);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred during content generation.',
    });
  }
});

// Server-side route for generating structure/JSON (e.g. mindmap, card lists, structured outlines)
app.post('/api/generate-structured', async (req, res) => {
  try {
    const { prompt, schema, systemInstruction, model } = req.body;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets.',
      });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const selectedModel = model || 'gemini-3.5-flash';

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    res.json({
      text: response.text || '',
      success: true,
    });
  } catch (error: any) {
    console.error('Gemini API Structured Integration Error:', error);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred during structured generation.',
    });
  }
});

// Configure Vite or Static Asset Serving
const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  // Developer container flow: mount Vite in development mode
  console.log('Starting server in DEVELOPMENT mode with Vite middleware...');
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Production flow: serve statically compiled React app
  console.log('Starting server in PRODUCTION mode with static assets...');
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Studio workspace server online at http://0.0.0.0:${PORT}`);
});
