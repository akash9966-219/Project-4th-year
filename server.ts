/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { computeAnalyticalPrediction } from './src/services/aiPredictionService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // API Route for AI collision prediction & prevention advisor
  app.post('/api/ai-collision-predict', async (req, res) => {
    try {
      const {
        collisionRatePct,
        throughputMbps,
        activeStationsCount,
        delayMs,
        jitterMs,
        congestionAlgorithm,
        trafficScheduler,
        aqmMode,
        rtsCtsEnabled,
        wifiStandard,
        topologyMode,
        historySample,
        hiddenNodesLikely,
        bufferbloatDetected,
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `You are a world-class IEEE 802.11 MAC layer and wireless contention research engineer.
Analyze the following real-time 802.11 WLAN telemetry from our network simulation:
- Contending Client Stations (N): ${activeStationsCount}
- Live Collision Rate: ${Number(collisionRatePct).toFixed(1)}%
- Total Throughput: ${Number(throughputMbps).toFixed(2)} Mbps
- Average Queuing Delay: ${Number(delayMs).toFixed(1)} ms
- Jitter: ${Number(jitterMs).toFixed(1)} ms
- Current MAC Congestion Algorithm: ${congestionAlgorithm}
- Traffic Scheduler: ${trafficScheduler}
- AQM Mode: ${aqmMode}
- RTS/CTS Virtual Carrier Sense: ${rtsCtsEnabled ? 'Enabled' : 'Disabled'}
- Wi-Fi Standard: ${wifiStandard}
- Spatial Topology: ${topologyMode || 'CONCENTRIC_TIERS'}
- Hidden Node Vulnerability: ${hiddenNodesLikely ? 'YES (stations > 35m apart without RTS/CTS)' : 'NO'}
- Bufferbloat Condition: ${bufferbloatDetected ? 'YES (>25ms delay with DropTail)' : 'NO'}
- Recent collision history (%): ${Array.isArray(historySample) ? historySample.map((v: any) => Number(v).toFixed(1)).join(', ') : 'N/A'}

Predict the probability of contention collapse in the near future and recommend 3 to 5 concrete alternative prevention methods that the user can immediately apply into the simulation.
Respond with ONLY valid JSON strictly matching this schema:
{
  "predictedCollisionRiskPct": number,
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "projectedRateIn5sPct": number,
  "timeToCollapseSec": number | null,
  "contentionEntropy": number,
  "rootCauseDiagnosis": "Clear 1-2 sentence diagnosis explaining why collisions are occurring or if channel is stable",
  "alternativeMethods": [
    {
      "id": "method_id",
      "title": "Title of the alternative prevention strategy",
      "category": "HANDSHAKE" | "PHY_OFDMA" | "MAC_BACKOFF" | "QUEUE_AQM" | "TOPOLOGY",
      "description": "1-2 sentence overview of the preventive change",
      "technicalMechanism": "Precise mathematical/protocol explanation of why this prevents collisions",
      "expectedCollisionReductionPct": number,
      "expectedThroughputGainPct": number,
      "actionConfig": {
        "rtsCtsEnabled": boolean,
        "rtsThresholdBytes": number,
        "congestionAlgorithm": "STANDARD_BEB" | "AIMD_CW" | "IDLE_SENSE" | "Q_LEARNING_RL",
        "trafficScheduler": "ROUND_ROBIN" | "PROPORTIONAL_FAIR" | "DEFICIT_ROUND_ROBIN" | "EARLIEST_DEADLINE" | "OFDMA_MULTI_USER",
        "aqmMode": "FIFO_DROP_TAIL" | "RED" | "CODEL" | "FQ_CODEL",
        "wifiStandard": "802.11ax" | "802.11ac" | "802.11n"
      },
      "triggerReorientMode": "CONCENTRIC_TIERS" | "RADIAL_STAR" | "PERIMETER_RING" | "HIDDEN_TERMINAL_PAIRS" | null,
      "actionButtonText": "Concise button text to apply"
    }
  ]
}`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text);
            return res.json({
              ...parsed,
              source: 'GEMINI_AI',
              timestampMs: Date.now(),
            });
          }
        } catch (geminiErr) {
          console.warn('Gemini API call failed, falling back to analytical engine:', geminiErr);
        }
      }

      // Return high-fidelity analytical AI prediction
      const fallbackPrediction = computeAnalyticalPrediction(req.body);
      return res.json(fallbackPrediction);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
