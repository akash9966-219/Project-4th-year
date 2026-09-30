/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SimulationMetrics,
  SimulationConfig,
  Station,
  AIPredictionResult,
  AlternativePreventionMethod,
  CollisionRiskLevel,
  NormalcyHealthReport,
} from '../types/wlan';

export interface PredictionTelemetryPayload {
  collisionRatePct: number;
  throughputMbps: number;
  activeStationsCount: number;
  delayMs: number;
  jitterMs: number;
  congestionAlgorithm: string;
  trafficScheduler: string;
  aqmMode: string;
  rtsCtsEnabled: boolean;
  wifiStandard: string;
  topologyMode?: string;
  historySample: number[];
  bufferbloatDetected: boolean;
  hiddenNodesLikely: boolean;
}

/**
 * Perform AI Collision Prediction and generate Prevention Methods
 */
export async function predictCollisionsAndPreventMethods(
  metrics: SimulationMetrics,
  config: SimulationConfig,
  history: SimulationMetrics[],
  stations: Station[]
): Promise<AIPredictionResult> {
  const clientStations = stations.filter((s) => s.role === 'STATION');
  const n = clientStations.length;

  // Check if any pair of stations is > 35m apart (hidden node condition without RTS/CTS)
  let hiddenNodesLikely = false;
  if (!config.rtsCtsEnabled && n >= 2) {
    for (let i = 0; i < clientStations.length; i++) {
      for (let j = i + 1; j < clientStations.length; j++) {
        const d = Math.hypot(
          clientStations[i].x - clientStations[j].x,
          clientStations[i].y - clientStations[j].y
        );
        if (d > 35) {
          hiddenNodesLikely = true;
          break;
        }
      }
      if (hiddenNodesLikely) break;
    }
  }

  const bufferbloatDetected = metrics.averageDelayMs > 25 && config.aqmMode === 'FIFO_DROP_TAIL';
  const historySample = history.slice(-8).map((h) => h.collisionRatePct);

  const payload: PredictionTelemetryPayload = {
    collisionRatePct: metrics.collisionRatePct,
    throughputMbps: metrics.totalThroughputMbps,
    activeStationsCount: n,
    delayMs: metrics.averageDelayMs,
    jitterMs: metrics.jitterMs,
    congestionAlgorithm: config.congestionAlgorithm,
    trafficScheduler: config.trafficScheduler,
    aqmMode: config.aqmMode,
    rtsCtsEnabled: config.rtsCtsEnabled,
    wifiStandard: config.wifiStandard,
    topologyMode: config.topologyMode,
    historySample,
    bufferbloatDetected,
    hiddenNodesLikely,
  };

  // Attempt live Gemini AI proxy call via server
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('/api/ai-collision-predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: AIPredictionResult = await response.json();
      if (data && data.alternativeMethods && Array.isArray(data.alternativeMethods)) {
        return data;
      }
    }
  } catch {
    // Graceful fallback to client-side analytical AI prediction engine
  }

  return computeAnalyticalPrediction(payload);
}

/**
 * Deterministic IEEE 802.11 Analytical AI Prediction Engine (Bianchi Markov + Queue Dynamics)
 */
export function computeAnalyticalPrediction(payload: PredictionTelemetryPayload): AIPredictionResult {
  const {
    collisionRatePct,
    activeStationsCount,
    delayMs,
    congestionAlgorithm,
    trafficScheduler,
    aqmMode,
    rtsCtsEnabled,
    historySample,
    bufferbloatDetected,
    hiddenNodesLikely,
  } = payload;

  const n = Math.max(1, activeStationsCount);

  // 1. Calculate collision rate trajectory and slope
  let slope = 0;
  if (historySample.length >= 2) {
    const recent = historySample.slice(-3);
    const older = historySample.slice(0, Math.max(1, historySample.length - 3));
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    slope = avgRecent - avgOlder;
  }

  // 2. Bianchi theoretical baseline collision probability
  // Approximate transmission probability tau ~= 2 / (CWmin + 1)
  const cwMin = 15;
  const tau = 2 / (cwMin + 1);
  const bianchiCollProbPct = (1 - Math.pow(1 - tau, n - 1)) * 100;

  // 3. Composite Contention Risk Score (0-100%)
  let riskScore = 0;
  // Factor A: Current collision rate vs theoretical saturation
  riskScore += Math.min(45, (collisionRatePct / 35) * 45);
  // Factor B: Station density pressure (CSMA/CA degrades rapidly when n > 12)
  if (trafficScheduler !== 'OFDMA_MULTI_USER') {
    riskScore += Math.min(25, (n / 24) * 25);
  } else {
    riskScore += 4; // OFDMA heavily suppresses contention collisions
  }
  // Factor C: Contention trajectory slope
  if (slope > 0) {
    riskScore += Math.min(15, slope * 2.5);
  }
  // Factor D: Hidden nodes and bufferbloat risks
  if (hiddenNodesLikely && !rtsCtsEnabled) riskScore += 12;
  if (bufferbloatDetected) riskScore += 8;

  const predictedCollisionRiskPct = Math.max(4, Math.min(99, Math.round(riskScore)));

  // Risk Level Classification
  let riskLevel: CollisionRiskLevel = 'LOW';
  if (predictedCollisionRiskPct >= 75 || collisionRatePct > 28) {
    riskLevel = 'CRITICAL';
  } else if (predictedCollisionRiskPct >= 50 || collisionRatePct > 18) {
    riskLevel = 'HIGH';
  } else if (predictedCollisionRiskPct >= 28 || collisionRatePct > 9) {
    riskLevel = 'MODERATE';
  }

  // Projected Collision Rate in 5 seconds
  const projectedRateIn5sPct = Math.max(
    2,
    Math.min(98, Math.round(collisionRatePct + slope * 1.8 + (riskScore > 60 ? 4.5 : 0)))
  );

  // Time-to-Collapse Estimation
  let timeToCollapseSec: number | null = null;
  if (riskLevel === 'CRITICAL') {
    timeToCollapseSec = Math.max(1.2, Math.round((35 - Math.min(34, collisionRatePct)) / Math.max(0.8, slope) * 10) / 10);
  } else if (riskLevel === 'HIGH' && slope > 0.5) {
    timeToCollapseSec = Math.round(((35 - collisionRatePct) / slope) * 10) / 10;
  }

  // Contention Entropy (0 = orderly scheduled, 1 = chaotic collision avalanche)
  const contentionEntropy = Math.min(1.0, Math.round(((predictedCollisionRiskPct / 100) * 0.7 + (n / 30) * 0.3) * 100) / 100);

  // 4. Formulate Primary Root Cause Diagnosis
  let rootCauseDiagnosis = '';
  if (hiddenNodesLikely && !rtsCtsEnabled) {
    rootCauseDiagnosis = `Hidden Terminal Collisions Detected: Stations are spatially separated beyond carrier sensing range (35m), transmitting overlapping frames without RTS/CTS coordination.`;
  } else if (n >= 16 && trafficScheduler !== 'OFDMA_MULTI_USER') {
    rootCauseDiagnosis = `High BSS Contention Saturation: ${n} stations are simultaneously running CSMA/CA random backoffs, causing exponential backoff window collapse and high slot collision waste.`;
  } else if (bufferbloatDetected) {
    rootCauseDiagnosis = `Drop-Tail Bufferbloat & Head-of-Line Delay: High queuing delay (${delayMs.toFixed(1)}ms) is causing retry packet bursts and queuing backoff compounding.`;
  } else if (congestionAlgorithm === 'STANDARD_BEB' && collisionRatePct > 12) {
    rootCauseDiagnosis = `Standard Binary Exponential Backoff (BEB) Fluctuation: CW resets abruptly to CWmin (15) upon single frame successes, creating immediate subsequent collision spikes.`;
  } else {
    rootCauseDiagnosis = `Optimal Channel Operation: Contention windows and packet departure rates are balanced. Bianchi collision probability is steady at ~${bianchiCollProbPct.toFixed(1)}%.`;
  }

  // 5. Generate Ranked Alternative Prevention Methods
  const alternativeMethods: AlternativePreventionMethod[] = [];

  // Alternative Method 1: RTS/CTS Virtual Carrier Sense Handshake
  if (!rtsCtsEnabled) {
    alternativeMethods.push({
      id: 'method_rts_cts',
      title: 'Dynamic RTS/CTS Virtual Carrier Sense Handshake',
      category: 'HANDSHAKE',
      description: 'Exchange 20µs RTS/CTS control frames to reserve the RF medium prior to transmitting long 1500-byte data payloads.',
      technicalMechanism: 'Replaces expensive 1500-byte data collisions with brief 20-byte RTS collisions, immediately resolving hidden-node collisions and NAV channel clearing.',
      expectedCollisionReductionPct: hiddenNodesLikely ? 82 : 65,
      expectedThroughputGainPct: hiddenNodesLikely ? 48 : 28,
      actionConfig: {
        rtsCtsEnabled: true,
        rtsThresholdBytes: 500,
      },
      actionButtonText: 'Apply RTS/CTS Threshold (500B)',
    });
  }

  // Alternative Method 2: Wi-Fi 6 OFDMA Multi-User Scheduling
  if (trafficScheduler !== 'OFDMA_MULTI_USER') {
    alternativeMethods.push({
      id: 'method_ofdma',
      title: '802.11ax OFDMA Multi-User Trigger-Based Scheduling',
      category: 'PHY_OFDMA',
      description: 'Partition the 20MHz/40MHz channel into 26-tone Resource Units (RUs) allocated across up to 9 stations in parallel.',
      technicalMechanism: 'Completely eliminates random contention backoff collisions by having the AP coordinator schedule parallel uplink MU-MIMO transmissions via Trigger Frames.',
      expectedCollisionReductionPct: 92,
      expectedThroughputGainPct: 62,
      actionConfig: {
        wifiStandard: '802.11ax',
        trafficScheduler: 'OFDMA_MULTI_USER',
      },
      actionButtonText: 'Switch to Wi-Fi 6 OFDMA',
    });
  }

  // Alternative Method 3: Q-Learning RL or Idle Sense Backoff Control
  if (congestionAlgorithm === 'STANDARD_BEB') {
    alternativeMethods.push({
      id: 'method_q_learning',
      title: 'Q-Learning RL Contention Window Adaptation',
      category: 'MAC_BACKOFF',
      description: 'Reinforcement learning agent dynamically selects CW sizes based on channel idle-slot density rather than binary doubling.',
      technicalMechanism: 'Prevents the catastrophic CW collapse to CWmin after lucky deliveries, maintaining optimal transmission probability tau = 1/sqrt(2*N).',
      expectedCollisionReductionPct: 70,
      expectedThroughputGainPct: 38,
      actionConfig: {
        congestionAlgorithm: 'Q_LEARNING_RL',
      },
      actionButtonText: 'Activate Q-Learning Agent',
    });

    alternativeMethods.push({
      id: 'method_idle_sense',
      title: 'Idle Sense Non-Parametric Congestion Control',
      category: 'MAC_BACKOFF',
      description: 'Tracks the count of idle slots between consecutive frame transmissions to stabilize contention at Bianchi optimal efficiency.',
      technicalMechanism: 'Maintains target idle-slot count (5.6 slots) using additive-increase multiplicative-decrease (AIMD), achieving Pareto-optimal airtime fairness.',
      expectedCollisionReductionPct: 65,
      expectedThroughputGainPct: 34,
      actionConfig: {
        congestionAlgorithm: 'IDLE_SENSE',
      },
      actionButtonText: 'Activate Idle Sense',
    });
  }

  // Alternative Method 4: Active Queue Management (CoDel / FQ-CoDel)
  if (aqmMode === 'FIFO_DROP_TAIL' || delayMs > 20) {
    alternativeMethods.push({
      id: 'method_codel_aqm',
      title: 'CoDel Active Queue Management (Controlled Delay)',
      category: 'QUEUE_AQM',
      description: 'Monitors minimum packet sojourn time and preemptively drops stale backlog before buffers overflow.',
      technicalMechanism: 'Ensures packets experience no more than 5ms queuing latency, eliminating retry storms and bufferbloat-induced MAC retransmissions.',
      expectedCollisionReductionPct: 42,
      expectedThroughputGainPct: 25,
      actionConfig: {
        aqmMode: 'CODEL',
        codelTargetMs: 5,
        codelIntervalMs: 100,
      },
      actionButtonText: 'Deploy CoDel AQM',
    });
  }

  // Alternative Method 5: Topology Orientation Re-balancing
  if (hiddenNodesLikely || payload.topologyMode === 'HIDDEN_TERMINAL_PAIRS') {
    alternativeMethods.push({
      id: 'method_topology_reorient',
      title: 'Concentric RF Ring Spatial Re-orientation',
      category: 'TOPOLOGY',
      description: 'Evenly distributes contending stations across balanced concentric tiers (10m, 18.5m, 27m) to eliminate hidden node pockets.',
      technicalMechanism: 'Balances station carrier-sensing overlap and equalizes SNR path loss across all active BSS client links.',
      expectedCollisionReductionPct: 52,
      expectedThroughputGainPct: 32,
      actionConfig: {
        topologyMode: 'CONCENTRIC_TIERS',
      },
      triggerReorientMode: 'CONCENTRIC_TIERS',
      actionButtonText: 'Re-orient to Balanced Rings',
    });
  }

  return {
    timestampMs: Date.now(),
    predictedCollisionRiskPct,
    riskLevel,
    projectedRateIn5sPct,
    timeToCollapseSec,
    contentionEntropy,
    rootCauseDiagnosis,
    alternativeMethods,
    source: 'BIANCHI_NEURAL_HEURISTIC',
  };
}

/**
 * Evaluate the comprehensive multi-pillar system health and normalcy status
 */
export function evaluateNormalcyHealth(
  metrics: SimulationMetrics,
  config: SimulationConfig,
  stations: Station[]
): NormalcyHealthReport {
  const activeBottlenecks: string[] = [];

  // 1. Collision Health (0 to 100)
  // Target: <= 8% is 100 score, >= 35% is 0 score
  const colRate = metrics.collisionRatePct;
  let collisionHealth = Math.round(Math.max(0, Math.min(100, 100 - (colRate / 35) * 100)));
  if (colRate > 20) activeBottlenecks.push(`Severe packet collisions (${colRate.toFixed(1)}%)`);
  else if (colRate > 12) activeBottlenecks.push(`Elevated collision rate (${colRate.toFixed(1)}%)`);

  // 2. Throughput Efficiency Health (0 to 100)
  // Evaluates throughput vs expected theoretical capacity
  const tput = metrics.totalThroughputMbps;
  const targetTput = config.wifiStandard === '802.11ax' ? 24 : 18;
  const throughputHealth = Math.round(Math.max(10, Math.min(100, (tput / targetTput) * 100)));
  if (tput < 8 && stations.length > 4) activeBottlenecks.push(`Degraded aggregate throughput (${tput.toFixed(1)} Mbps)`);

  // 3. Queuing Delay & Latency Health (0 to 100)
  // Target: <= 8ms delay is 100 score, >= 35ms delay is 0 score
  const delay = metrics.averageDelayMs;
  let delayHealth = Math.round(Math.max(0, Math.min(100, 100 - (delay / 35) * 100)));
  if (delay > 25 && config.aqmMode === 'FIFO_DROP_TAIL') {
    activeBottlenecks.push(`Bufferbloat queuing delay (${delay.toFixed(1)}ms)`);
  }

  // 4. Airtime Fairness Health (0 to 100)
  const fairness = metrics.jainsFairnessIndex;
  const fairnessHealth = Math.round(Math.max(0, Math.min(100, fairness * 100)));
  if (fairness < 0.65) activeBottlenecks.push(`Airtime starvation imbalance (Jain's: ${fairness.toFixed(2)})`);

  // Check hidden nodes without RTS/CTS
  const clients = stations.filter((s) => s.role === 'STATION');
  let hasHiddenTerminals = false;
  if (!config.rtsCtsEnabled && clients.length >= 2) {
    for (let i = 0; i < clients.length; i++) {
      for (let j = i + 1; j < clients.length; j++) {
        if (Math.hypot(clients[i].x - clients[j].x, clients[i].y - clients[j].y) > 35) {
          hasHiddenTerminals = true;
          break;
        }
      }
      if (hasHiddenTerminals) break;
    }
  }
  if (hasHiddenTerminals) activeBottlenecks.push('Hidden nodes active without RTS/CTS carrier sensing');

  // Overall Health Score: Weighted blend
  const overallHealthScore = Math.round(
    collisionHealth * 0.35 +
    throughputHealth * 0.25 +
    delayHealth * 0.25 +
    fairnessHealth * 0.15
  );

  let status: NormalcyHealthReport['status'] = 'OPTIMAL';
  if (overallHealthScore < 35 || colRate > 28) status = 'COLLAPSE';
  else if (overallHealthScore < 65 || colRate > 18) status = 'HIGH_CONTENTION';
  else if (overallHealthScore < 85 || colRate > 10) status = 'ELEVATED';

  const isAtNormalcy = overallHealthScore >= 80 && colRate <= 12;

  return {
    overallHealthScore,
    status,
    collisionHealth,
    throughputHealth,
    delayHealth,
    fairnessHealth,
    isAtNormalcy,
    activeBottlenecks,
  };
}
