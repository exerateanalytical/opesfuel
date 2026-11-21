import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const AI_MODEL = 'gemini-4-hydrogen';

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('Server AI key (GEMINI_API_KEY) is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'opesfuel-web-server' });
  });

  app.post('/api/ai/analyze', async (req, res) => {
    try {
      const { aiActive, stationScope, metrics } = req.body ?? {};
      if (!aiActive) {
        res.status(402).json({
          error: 'OpesFuel AI Copilot requires an active paid AI subscription (25 000 FCFA/month or Network Enterprise).',
        });
        return;
      }

      const ai = createAiClient();
      const prompt = [
        'You are the OpesFuel Petroleum Operations & SYSCOHADA Financial AI Copilot.',
        'Analyze the real-time petrol station network metrics provided below (currency is FCFA, fuel volumes are Litres).',
        'Predict tank stockout horizons based on book volume vs sales run-rate, highlight cash/dipstick variances or margin risks, and suggest concrete actions.',
        `Station scope: ${JSON.stringify(stationScope ?? 'ALL')}`,
        `Operational metrics JSON: ${JSON.stringify(metrics ?? {})}`,
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'Be concise, quantitative, and practical for station owners in West and Central Africa using FCFA and Litres. Ground every number in the supplied payload.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              healthScore: { type: Type.INTEGER },
              revenueForecast30dFcfa: { type: Type.INTEGER },
              stockoutPredictions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tankId: { type: Type.STRING },
                    tankName: { type: Type.STRING },
                    grade: { type: Type.STRING },
                    daysRemaining: { type: Type.NUMBER },
                    recommendedOrderLitres: { type: Type.INTEGER },
                    urgency: { type: Type.STRING },
                  },
                  required: [
                    'tankId',
                    'tankName',
                    'grade',
                    'daysRemaining',
                    'recommendedOrderLitres',
                    'urgency',
                  ],
                },
              },
              marginSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    impactFcfa: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                  },
                  required: ['title', 'impactFcfa', 'recommendation'],
                },
              },
              anomalyAlerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING },
                    module: { type: Type.STRING },
                    detail: { type: Type.STRING },
                  },
                  required: ['severity', 'module', 'detail'],
                },
              },
              prioritizedActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING },
                    targetSection: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['action', 'targetSection', 'rationale'],
                },
              },
            },
            required: [
              'executiveSummary',
              'healthScore',
              'revenueForecast30dFcfa',
              'stockoutPredictions',
              'marginSuggestions',
              'anomalyAlerts',
              'prioritizedActions',
            ],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'AI service returned an empty analysis payload.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ...parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete AI operational analysis.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { aiActive, question, metrics, history } = req.body ?? {};
      if (!aiActive) {
        res.status(402).json({
          error: 'OpesFuel AI Copilot requires an active paid AI subscription.',
        });
        return;
      }
      if (!question || typeof question !== 'string' || !question.trim()) {
        res.status(400).json({ error: 'Question cannot be empty.' });
        return;
      }

      const ai = createAiClient();
      const conversationContext = Array.isArray(history)
        ? history
            .slice(-6)
            .map((m: { role?: string; content?: string }) => `${m.role === 'user' ? 'Operator' : 'OpesFuel AI'}: ${m.content ?? ''}`)
            .join('\n')
        : '';

      const prompt = [
        'Context — Live Station Telemetry & Ledger Summary (FCFA & Litres):',
        JSON.stringify(metrics ?? {}),
        conversationContext ? `Recent conversation:\n${conversationContext}` : '',
        `Operator question: ${question.trim()}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are the OpesFuel AI Operations Advisor for petrol station owners, managers, and accountants. Answer concisely in clear plain text/bullets using exact FCFA and Litre figures from the station snapshot provided.',
        },
      });

      const answer = response.text;
      if (!answer) {
        res.status(502).json({ error: 'AI service returned an empty response.' });
        return;
      }

      res.json({
        answer,
        answeredAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate AI advisor response.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production bundle not built.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpesFuel server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start OpesFuel server:', err);
  process.exit(1);
});
