/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AccessCategory,
  AQMType,
  ChannelState,
  CongestionControlAlgorithm,
  EDCAQueueState,
  Packet,
  QLearningAgentState,
  SimulationConfig,
  SimulationMetrics,
  Station,
  TimelineSlotEvent,
  TrafficPattern,
  TrafficSchedulerAlgorithm,
} from '../types/wlan';
import { DEFAULT_80211_CONSTANTS, EDCA_DEFAULTS, OFDMA_RU_CONFIGS, STATION_PALETTE } from './constants';

export class WirelessSimulationEngine {
  public config: SimulationConfig;
  public stations: Station[] = [];
  public apStation!: Station;
  public channel: ChannelState;
  public currentTimeUs: number = 0;
  public timelineEvents: TimelineSlotEvent[] = [];
  public metricsHistory: SimulationMetrics[] = [];
  public currentMetrics!: SimulationMetrics;
  public qAgent: QLearningAgentState;

  // Running tracking counters
  private consecutiveIdleSlots: number = 0;
  private totalChannelSlots: number = 0;
  private collisionSlots: number = 0;
  private successfulBitsLastInterval: number = 0;
  private packetsDeliveredLastInterval: number = 0;
  private packetsCollidedLastInterval: number = 0;
  private lastMetricsUpdateTimeUs: number = 0;
  private drrDeficitCounters: Map<string, number> = new Map();
  private roundRobinIndex: number = 0;
  private averageThroughputHistory: Map<string, number> = new Map();

  // CoDel tracking
  private codelDropNextUs: Map<string, number> = new Map();
  private codelDroppingState: Map<string, boolean> = new Map();

  constructor(customConfig?: Partial<SimulationConfig>) {
    this.config = {
      wifiStandard: '802.11ax',
      channelBandwidthMhz: 20,
      congestionAlgorithm: 'STANDARD_BEB',
      trafficScheduler: 'PROPORTIONAL_FAIR',
      aqmMode: 'FIFO_DROP_TAIL',
      stationCount: 12,
      rtsCtsEnabled: false,
      rtsThresholdBytes: 2347,
      maxQueueCapacity: 64,
      codelTargetMs: 5,
      codelIntervalMs: 100,
      slotTimeUs: DEFAULT_80211_CONSTANTS.SLOT_TIME_US,
      sifsUs: DEFAULT_80211_CONSTANTS.SIFS_US,
      difsUs: DEFAULT_80211_CONSTANTS.DIFS_US,
      simSpeedMultiplier: 1.0,
      enableNoiseChannelError: false,
      channelPerPct: 2.0,
      ...customConfig,
    };

    this.channel = {
      status: 'IDLE',
      activeTransmitters: [],
      txEndUs: 0,
      slotDurationUs: this.config.slotTimeUs,
      totalIdleSlots: 0,
      totalBusySlots: 0,
      totalCollisionSlots: 0,
    };

    this.qAgent = {
      qTable: {},
      alpha: 0.15,
      gamma: 0.85,
      epsilon: 0.1,
      lastStateKey: 'low_low',
      lastAction: 1,
      lastReward: 0,
      totalRewardAccumulated: 0,
      actionsTakenCount: 0,
    };

    this.resetSimulation();
  }

  public resetSimulation() {
    this.currentTimeUs = 0;
    this.timelineEvents = [];
    this.metricsHistory = [];
    this.consecutiveIdleSlots = 0;
    this.totalChannelSlots = 0;
    this.collisionSlots = 0;
    this.successfulBitsLastInterval = 0;
    this.packetsDeliveredLastInterval = 0;
    this.packetsCollidedLastInterval = 0;
    this.lastMetricsUpdateTimeUs = 0;
    this.drrDeficitCounters.clear();
    this.roundRobinIndex = 0;
    this.averageThroughputHistory.clear();
    this.codelDropNextUs.clear();
    this.codelDroppingState.clear();

    this.initStations();
    this.initMetrics();
  }

  private createDefaultEDCAQueues(): Record<AccessCategory, EDCAQueueState> {
    const categories: AccessCategory[] = ['AC_VO', 'AC_VI', 'AC_BE', 'AC_BK'];
    const queues: Partial<Record<AccessCategory, EDCAQueueState>> = {};

    for (const cat of categories) {
      const def = EDCA_DEFAULTS[cat];
      queues[cat] = {
        category: cat,
        aifsn: def.aifsn,
        cw: def.cwMin,
        cwMin: def.cwMin,
        cwMax: def.cwMax,
        txopUs: def.txopUs,
        backoffCounter: Math.floor(Math.random() * (def.cwMin + 1)),
        packets: [],
        totalEnqueued: 0,
        totalDelivered: 0,
        totalDropped: 0,
        totalCollisions: 0,
      };
    }

    return queues as Record<AccessCategory, EDCAQueueState>;
  }

  private initStations() {
    this.stations = [];

    // Central Access Point
    this.apStation = {
      id: 'AP-01',
      name: 'Access Point (Coordinator)',
      role: 'AP',
      x: 0,
      y: 0,
      distanceToAp: 0,
      snrDb: 40,
      phyRateMbps: 144.4,
      trafficPattern: 'MIXED_MULTIMEDIA',
      packetRatePps: 800,
      queues: this.createDefaultEDCAQueues(),
      macState: 'IDLE',
      activeCategory: 'AC_BE',
      currentBackoff: 4,
      currentCw: 15,
      deferSlotsRemaining: 2,
      currentTxEndTimeUs: 0,
      isTransmitting: false,
      bytesTransmitted: 0,
      packetsTransmitted: 0,
      packetsLost: 0,
      collisionCount: 0,
      averageDelayMs: 0,
      lastDelaySamples: [],
      color: '#38bdf8',
    };
    this.stations.push(this.apStation);

    // Populate client wireless stations arranged radially around AP
    const n = this.config.stationCount;
    const trafficPatterns: TrafficPattern[] = [
      'VOICE',
      'VIDEO_STREAM',
      'BEST_EFFORT',
      'BACKGROUND_BULK',
      'MIXED_MULTIMEDIA',
    ];

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n + (Math.random() * 0.2 - 0.1);
      // Realistic distances from 4 meters to 35 meters
      const radius = 6 + Math.random() * 24;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const dist = Math.sqrt(x * x + y * y);

      // Path loss model: Free-space path loss PL(d) = 20 log10(d) + 40 dB at 5GHz
      // Approximate SNR in dB from 35 dB (close) down to 14 dB (edge)
      const snrDb = Math.max(12, Math.min(38, 42 - 0.9 * dist + (Math.random() * 2 - 1)));

      // Approximate 802.11 rate based on SNR
      let phyRateMbps = 54;
      if (this.config.wifiStandard === '802.11ax') {
        if (snrDb >= 32) phyRateMbps = 143.4;      // MCS 11
        else if (snrDb >= 26) phyRateMbps = 114.7; // MCS 9
        else if (snrDb >= 20) phyRateMbps = 86.0;  // MCS 7
        else if (snrDb >= 15) phyRateMbps = 57.4;  // MCS 5
        else phyRateMbps = 28.7;                  // MCS 3
      } else {
        if (snrDb >= 28) phyRateMbps = 54;
        else if (snrDb >= 22) phyRateMbps = 48;
        else if (snrDb >= 18) phyRateMbps = 36;
        else if (snrDb >= 14) phyRateMbps = 24;
        else phyRateMbps = 12;
      }

      const pattern = trafficPatterns[i % trafficPatterns.length];
      let pps = 150;
      if (pattern === 'VOICE') pps = 80;
      else if (pattern === 'VIDEO_STREAM') pps = 450;
      else if (pattern === 'BACKGROUND_BULK') pps = 300;
      else if (pattern === 'BEST_EFFORT') pps = 200;

      const station: Station = {
        id: `STA-${(i + 1).toString().padStart(2, '0')}`,
        name: `Station ${i + 1}`,
        role: 'STATION',
        x,
        y,
        distanceToAp: dist,
        snrDb: Math.round(snrDb * 10) / 10,
        phyRateMbps,
        trafficPattern: pattern,
        packetRatePps: pps,
        queues: this.createDefaultEDCAQueues(),
        macState: 'IDLE',
        activeCategory: (pattern === 'VOICE' ? 'AC_VO' : pattern === 'VIDEO_STREAM' ? 'AC_VI' : 'AC_BE'),
        currentBackoff: Math.floor(Math.random() * 16),
        currentCw: 15,
        deferSlotsRemaining: 2,
        currentTxEndTimeUs: 0,
        isTransmitting: false,
        bytesTransmitted: 0,
        packetsTransmitted: 0,
        packetsLost: 0,
        collisionCount: 0,
        averageDelayMs: 0,
        lastDelaySamples: [],
        color: STATION_PALETTE[i % STATION_PALETTE.length],
      };

      this.averageThroughputHistory.set(station.id, 1.0);
      this.drrDeficitCounters.set(station.id, 0);
      this.stations.push(station);
    }

    // Seed initial packets in queues
    for (const sta of this.stations) {
      this.generatePacketsForStation(sta, 3);
    }
  }

  private initMetrics() {
    this.currentMetrics = {
      timestampUs: 0,
      totalThroughputMbps: 0,
      channelUtilizationPct: 0,
      collisionRatePct: 0,
      averageDelayMs: 0,
      jitterMs: 0,
      jainsFairnessIndex: 1.0,
      activeStationsCount: this.stations.length - 1,
      totalPacketsSent: 0,
      totalPacketsDropped: 0,
      perCategoryThroughputMbps: { AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
      perCategoryDelayMs: { AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
    };
    this.metricsHistory.push({ ...this.currentMetrics });
  }

  /**
   * Packet generation matching traffic profiles (Poisson arrivals & bursts)
   */
  private generatePacketsForStation(station: Station, initialCount: number = 1) {
    for (let c = 0; c < initialCount; c++) {
      let cat: AccessCategory = 'AC_BE';
      let size = 1500;
      let deadlineOffsetMs = 200;

      if (station.trafficPattern === 'VOICE') {
        cat = 'AC_VO';
        size = 160; // G.711 / Opus voice packet
        deadlineOffsetMs = 40; // Strict latency deadline
      } else if (station.trafficPattern === 'VIDEO_STREAM') {
        cat = 'AC_VI';
        size = 1420; // H.264/H.265 frame slice
        deadlineOffsetMs = 80;
      } else if (station.trafficPattern === 'BACKGROUND_BULK') {
        cat = 'AC_BK';
        size = 1500;
        deadlineOffsetMs = 1000;
      } else if (station.trafficPattern === 'MIXED_MULTIMEDIA') {
        const rand = Math.random();
        if (rand < 0.2) {
          cat = 'AC_VO';
          size = 160;
          deadlineOffsetMs = 40;
        } else if (rand < 0.5) {
          cat = 'AC_VI';
          size = 1400;
          deadlineOffsetMs = 90;
        } else {
          cat = 'AC_BE';
          size = 1500;
          deadlineOffsetMs = 300;
        }
      }

      const q = station.queues[cat];

      // AQM check: FIFO vs CoDel vs FQ-CoDel
      const shouldDrop = this.evaluateAQM(station, q);
      if (shouldDrop) {
        q.totalDropped++;
        continue;
      }

      const packet: Packet = {
        id: `pkt-${station.id}-${q.totalEnqueued++}`,
        sourceId: station.id,
        destId: station.role === 'AP' ? this.stations[1].id : this.apStation.id,
        category: cat,
        sizeBytes: size,
        creationTimeUs: this.currentTimeUs,
        deadlineUs: this.currentTimeUs + deadlineOffsetMs * 1000,
        enqueueTimeUs: this.currentTimeUs,
        retries: 0,
      };

      if (q.packets.length < this.config.maxQueueCapacity) {
        q.packets.push(packet);
      } else {
        q.totalDropped++; // Queue overflow drop
      }
    }
  }

  /**
   * Active Queue Management evaluation (CoDel / FQ-CoDel)
   */
  private evaluateAQM(station: Station, q: EDCAQueueState): boolean {
    if (this.config.aqmMode === 'FIFO_DROP_TAIL') {
      return q.packets.length >= this.config.maxQueueCapacity;
    }

    if (q.packets.length === 0) return false;

    // CoDel algorithm implementation:
    // Monitor head-of-line packet queuing delay (sojourn time)
    const holPacket = q.packets[0];
    const sojournTimeMs = (this.currentTimeUs - holPacket.enqueueTimeUs) / 1000;
    const targetMs = this.config.codelTargetMs;
    const intervalUs = this.config.codelIntervalMs * 1000;

    const stateKey = `${station.id}-${q.category}`;
    let isDropping = this.codelDroppingState.get(stateKey) || false;
    let dropNextUs = this.codelDropNextUs.get(stateKey) || 0;

    if (sojournTimeMs > targetMs) {
      if (!isDropping) {
        this.codelDroppingState.set(stateKey, true);
        this.codelDropNextUs.set(stateKey, this.currentTimeUs + intervalUs);
      } else if (this.currentTimeUs >= dropNextUs) {
        // Drop packet to signal TCP/congestion
        this.codelDropNextUs.set(stateKey, this.currentTimeUs + Math.floor(intervalUs / Math.sqrt(q.totalDropped + 1)));
        return true;
      }
    } else {
      this.codelDroppingState.set(stateKey, false);
    }

    return false;
  }

  /**
   * Main discrete simulation step.
   * Can step by a slot (9 µs) or jump to the next channel boundary.
   */
  public step(timeAdvanceUs: number = DEFAULT_80211_CONSTANTS.SLOT_TIME_US): void {
    const targetTimeUs = this.currentTimeUs + timeAdvanceUs;

    while (this.currentTimeUs < targetTimeUs) {
      const slotDelta = Math.min(DEFAULT_80211_CONSTANTS.SLOT_TIME_US, targetTimeUs - this.currentTimeUs);
      this.currentTimeUs += slotDelta;
      this.totalChannelSlots++;

      // 1. Stochastic traffic arrivals across all stations
      for (const sta of this.stations) {
        const arrivalProb = (sta.packetRatePps * slotDelta) / 1_000_000;
        if (Math.random() < arrivalProb) {
          this.generatePacketsForStation(sta, 1);
        }
      }

      // 2. Channel State Machine update
      if (this.channel.status === 'BUSY_TX' || this.channel.status === 'COLLISION') {
        if (this.currentTimeUs >= this.channel.txEndUs) {
          // Transmission period finished!
          this.handleTransmissionCompletion();
        } else {
          // Channel is still occupied by ongoing airtime transmission
          this.channel.totalBusySlots++;
          continue;
        }
      }

      // If channel is free (IDLE):
      if (this.channel.status === 'IDLE') {
        this.channel.totalIdleSlots++;
        this.consecutiveIdleSlots++;

        // 3. Process OFDMA Multi-User Scheduling if enabled at AP
        if (this.config.trafficScheduler === 'OFDMA_MULTI_USER' && this.shouldTriggerOFDMA()) {
          this.executeOFDMATransmission();
          continue;
        }

        // 4. Standard Contention & Backoff Countdown across all stations
        const contendingStations = this.updateBackoffsAndCollectTransmitters();

        if (contendingStations.length === 1) {
          // Single transmitter wins channel contention!
          this.initiateTransmission([contendingStations[0]]);
        } else if (contendingStations.length > 1) {
          // Multiple stations expired backoff in the exact same slot -> COLLISION!
          this.initiateTransmission(contendingStations);
        }
      }
    }

    // Periodically update metrics & Q-learning agent
    if (this.currentTimeUs - this.lastMetricsUpdateTimeUs >= 50_000) { // Every 50ms sim time
      this.updateMetrics();
      this.updateQLearningAgent();
      this.lastMetricsUpdateTimeUs = this.currentTimeUs;
    }
  }

  /**
   * Internal Contention & Distributed Backoff Resolution
   */
  private updateBackoffsAndCollectTransmitters(): Station[] {
    const readyToTransmit: Station[] = [];

    for (const sta of this.stations) {
      // Find highest priority queue with pending frames (Internal Contention)
      let selectedCat: AccessCategory | null = null;
      const categories: AccessCategory[] = ['AC_VO', 'AC_VI', 'AC_BE', 'AC_BK'];

      for (const cat of categories) {
        const q = sta.queues[cat];
        if (q.packets.length > 0) {
          selectedCat = cat;
          break;
        }
      }

      if (!selectedCat) {
        sta.macState = 'IDLE';
        sta.isTransmitting = false;
        continue;
      }

      const activeQueue = sta.queues[selectedCat];
      sta.activeCategory = selectedCat;

      // Handle AIFS Deferral
      if (sta.macState === 'IDLE' || sta.macState === 'COLLIDED') {
        sta.macState = 'DEFERRING_AIFS';
        sta.deferSlotsRemaining = activeQueue.aifsn;
      }

      if (sta.macState === 'DEFERRING_AIFS') {
        sta.deferSlotsRemaining--;
        if (sta.deferSlotsRemaining <= 0) {
          sta.macState = 'BACKING_OFF';
        }
        continue;
      }

      if (sta.macState === 'BACKING_OFF') {
        if (activeQueue.backoffCounter > 0) {
          activeQueue.backoffCounter--;
          sta.currentBackoff = activeQueue.backoffCounter;
        }

        if (activeQueue.backoffCounter === 0) {
          readyToTransmit.push(sta);
        }
      }
    }

    return readyToTransmit;
  }

  /**
   * Initiate Transmission over the Air interface
   */
  private initiateTransmission(transmitters: Station[]) {
    const isCollision = transmitters.length > 1;

    // Calculate maximum airtime duration of the concurrent frames
    let maxTxTimeUs = 0;
    for (const tx of transmitters) {
      const q = tx.queues[tx.activeCategory];
      const packet = q.packets[0];
      const packetBits = (packet ? packet.sizeBytes : 1500) * 8;
      const duration = DEFAULT_80211_CONSTANTS.PREAMBLE_HEADER_US +
                       Math.ceil(packetBits / tx.phyRateMbps) +
                       DEFAULT_80211_CONSTANTS.SIFS_US +
                       DEFAULT_80211_CONSTANTS.ACK_DURATION_US;
      if (duration > maxTxTimeUs) maxTxTimeUs = duration;

      tx.macState = 'TRANSMITTING';
      tx.isTransmitting = true;
    }

    this.channel.status = isCollision ? 'COLLISION' : 'BUSY_TX';
    this.channel.activeTransmitters = transmitters.map(t => t.id);
    this.channel.txEndUs = this.currentTimeUs + maxTxTimeUs;

    // Log timeline event for Gantt chart
    this.timelineEvents.push({
      startUs: this.currentTimeUs,
      durationUs: maxTxTimeUs,
      type: isCollision ? 'COLLISION' : 'DATA_TX',
      transmitters: transmitters.map(t => t.id),
      category: transmitters[0].activeCategory,
      packetId: transmitters[0].queues[transmitters[0].activeCategory].packets[0]?.id,
      success: !isCollision,
    });

    if (this.timelineEvents.length > 120) {
      this.timelineEvents.shift();
    }
  }

  /**
   * Called when transmission duration completes
   */
  private handleTransmissionCompletion() {
    const isCollision = this.channel.status === 'COLLISION';
    const txStations = this.stations.filter(s => this.channel.activeTransmitters.includes(s.id));

    if (isCollision) {
      this.channel.totalCollisionSlots++;
      this.collisionSlots++;
      this.packetsCollidedLastInterval += txStations.length;

      for (const sta of txStations) {
        sta.collisionCount++;
        sta.macState = 'COLLIDED';
        sta.isTransmitting = false;

        const q = sta.queues[sta.activeCategory];
        q.totalCollisions++;

        if (q.packets.length > 0) {
          const pkt = q.packets[0];
          pkt.retries++;

          if (pkt.retries >= DEFAULT_80211_CONSTANTS.MAX_RETRY_LIMIT) {
            // Drop packet after max retries exceeded
            q.packets.shift();
            q.totalDropped++;
            sta.packetsLost++;
          }
        }

        // Apply Congestion Control algorithm upon collision
        this.applyCongestionBackoffOnCollision(sta, q);
      }
    } else {
      // Successful Transmission!
      for (const sta of txStations) {
        sta.macState = 'IDLE';
        sta.isTransmitting = false;

        const q = sta.queues[sta.activeCategory];
        if (q.packets.length > 0) {
          const pkt = q.packets.shift()!;
          const delayMs = (this.currentTimeUs - pkt.creationTimeUs) / 1000;

          q.totalDelivered++;
          sta.packetsTransmitted++;
          sta.bytesTransmitted += pkt.sizeBytes;
          sta.lastDelaySamples.push(delayMs);
          if (sta.lastDelaySamples.length > 20) sta.lastDelaySamples.shift();

          const sum = sta.lastDelaySamples.reduce((a, b) => a + b, 0);
          sta.averageDelayMs = sum / sta.lastDelaySamples.length;

          this.successfulBitsLastInterval += pkt.sizeBytes * 8;
          this.packetsDeliveredLastInterval++;

          // Update exponential moving average throughput for Proportional Fair scheduler
          const prevTput = this.averageThroughputHistory.get(sta.id) || 1.0;
          this.averageThroughputHistory.set(sta.id, 0.95 * prevTput + 0.05 * (pkt.sizeBytes * 8 / 1e6));
        }

        // Apply Congestion Control algorithm on successful transmission
        this.applyCongestionResetOnSuccess(sta, q);
      }
    }

    // Reset channel to IDLE and reset consecutive idle slot counter
    this.channel.status = 'IDLE';
    this.channel.activeTransmitters = [];
    this.consecutiveIdleSlots = 0;
  }

  /**
   * Contention Window adaptation on Collision
   */
  private applyCongestionBackoffOnCollision(sta: Station, q: EDCAQueueState) {
    switch (this.config.congestionAlgorithm) {
      case 'STANDARD_BEB':
        // Binary Exponential Backoff: CW = min(2 * (CW + 1) - 1, CWmax)
        q.cw = Math.min(q.cwMax, (q.cw + 1) * 2 - 1);
        break;

      case 'IDLE_SENSE': {
        // Idle Sense: Tracks target idle slots (optimal n_target approx 5.68)
        // If consecutive idle slots were low -> Congestion detected -> Additive Increase CW
        const nTarget = 5.68;
        if (this.consecutiveIdleSlots < nTarget) {
          q.cw = Math.min(q.cwMax, q.cw + 16);
        } else {
          q.cw = Math.min(q.cwMax, Math.round(q.cw * 1.5));
        }
        break;
      }

      case 'AIMD_CW':
        // Additive increase CW on collision
        q.cw = Math.min(q.cwMax, q.cw + 24);
        break;

      case 'Q_LEARNING_RL': {
        // RL Agent: choose action based on Q-table
        const action = this.selectRLAction();
        this.executeRLAction(q, action);
        break;
      }
    }

    sta.currentCw = q.cw;
    q.backoffCounter = Math.floor(Math.random() * (q.cw + 1));
    sta.currentBackoff = q.backoffCounter;
  }

  /**
   * Contention Window adaptation on Success
   */
  private applyCongestionResetOnSuccess(sta: Station, q: EDCAQueueState) {
    switch (this.config.congestionAlgorithm) {
      case 'STANDARD_BEB':
        // BEB resets immediately to CWmin
        q.cw = q.cwMin;
        break;

      case 'IDLE_SENSE': {
        // Idle Sense gently reduces CW multiplicatively
        const nTarget = 5.68;
        if (this.consecutiveIdleSlots > nTarget) {
          q.cw = Math.max(q.cwMin, Math.round(q.cw * 0.82));
        }
        break;
      }

      case 'AIMD_CW':
        // Multiplicative decrease CW on success
        q.cw = Math.max(q.cwMin, Math.round(q.cw * 0.88));
        break;

      case 'Q_LEARNING_RL': {
        const action = this.selectRLAction();
        this.executeRLAction(q, action);
        break;
      }
    }

    sta.currentCw = q.cw;
    q.backoffCounter = Math.floor(Math.random() * (q.cw + 1));
    sta.currentBackoff = q.backoffCounter;
  }

  /**
   * Q-Learning State Selection and Action Execution
   */
  private getRLStateKey(): string {
    const colRate = this.currentMetrics?.collisionRatePct || 0;
    const backlog = this.stations.reduce((acc, s) => acc + s.queues[s.activeCategory].packets.length, 0);

    const colBin = colRate > 25 ? 'high' : colRate > 10 ? 'med' : 'low';
    const backlogBin = backlog > 30 ? 'high' : backlog > 10 ? 'med' : 'low';
    return `${colBin}_${backlogBin}`;
  }

  private selectRLAction(): number {
    const stateKey = this.getRLStateKey();
    if (!this.qAgent.qTable[stateKey]) {
      this.qAgent.qTable[stateKey] = [0, 0, 0, 0];
    }

    // Epsilon-greedy exploration
    if (Math.random() < this.qAgent.epsilon) {
      return Math.floor(Math.random() * 4);
    }

    const qVals = this.qAgent.qTable[stateKey];
    let bestAction = 0;
    let maxQ = -Infinity;
    for (let a = 0; a < qVals.length; a++) {
      if (qVals[a] > maxQ) {
        maxQ = qVals[a];
        bestAction = a;
      }
    }
    return bestAction;
  }

  private executeRLAction(q: EDCAQueueState, action: number) {
    switch (action) {
      case 0: // Aggressive: decrease CW
        q.cw = Math.max(q.cwMin, Math.round(q.cw * 0.75));
        break;
      case 1: // Hold: keep CW
        break;
      case 2: // Moderate Increase: CW * 1.5
        q.cw = Math.min(q.cwMax, Math.round(q.cw * 1.5));
        break;
      case 3: // High Backoff: CW * 2.5
        q.cw = Math.min(q.cwMax, Math.round(q.cw * 2.5));
        break;
    }
    this.qAgent.lastAction = action;
    this.qAgent.actionsTakenCount++;
  }

  private updateQLearningAgent() {
    const prevStateKey = this.qAgent.lastStateKey;
    const prevAction = this.qAgent.lastAction;
    const nextStateKey = this.getRLStateKey();

    if (!this.qAgent.qTable[prevStateKey]) this.qAgent.qTable[prevStateKey] = [0, 0, 0, 0];
    if (!this.qAgent.qTable[nextStateKey]) this.qAgent.qTable[nextStateKey] = [0, 0, 0, 0];

    // Reward function: High throughput bonus, strong collision penalty, delay penalty
    const tputNorm = Math.min(1.0, (this.currentMetrics.totalThroughputMbps / 50));
    const colPenalty = (this.currentMetrics.collisionRatePct / 100) * 2.5;
    const delayPenalty = Math.min(1.0, this.currentMetrics.averageDelayMs / 50) * 0.5;

    const reward = tputNorm - colPenalty - delayPenalty;
    this.qAgent.lastReward = reward;
    this.qAgent.totalRewardAccumulated += reward;

    const maxNextQ = Math.max(...this.qAgent.qTable[nextStateKey]);
    const currentQ = this.qAgent.qTable[prevStateKey][prevAction];

    // TD Learning update rule: Q(s,a) = Q(s,a) + alpha * [r + gamma * max Q(s',a') - Q(s,a)]
    this.qAgent.qTable[prevStateKey][prevAction] =
      currentQ + this.qAgent.alpha * (reward + this.qAgent.gamma * maxNextQ - currentQ);

    this.qAgent.lastStateKey = nextStateKey;
  }

  /**
   * 802.11ax OFDMA Multi-User Scheduling Trigger
   */
  private shouldTriggerOFDMA(): boolean {
    // AP initiates Trigger Frame if there are multiple stations with queued uplink data
    let activeClientCount = 0;
    for (const sta of this.stations) {
      if (sta.role === 'STATION' && sta.queues[sta.activeCategory].packets.length > 0) {
        activeClientCount++;
      }
    }
    return activeClientCount >= 2;
  }

  private executeOFDMATransmission() {
    // Select up to 9 stations for 26-tone RUs in a 20MHz channel
    const clientStations = this.stations.filter(s => s.role === 'STATION' && s.queues[s.activeCategory].packets.length > 0);
    const scheduled = clientStations.slice(0, 9);
    if (scheduled.length === 0) return;

    const ruConfig = OFDMA_RU_CONFIGS[0]; // 26-tone RU
    scheduled.forEach((sta, idx) => {
      sta.assignedRuIndex = idx + 1;
      sta.assignedRuTones = ruConfig.subcarriers;
      sta.macState = 'TRANSMITTING';
      sta.isTransmitting = true;
    });

    const triggerFrameTimeUs = DEFAULT_80211_CONSTANTS.PREAMBLE_HEADER_US + 40;
    const uplinkRuTxTimeUs = 180; // Simultaneous OFDMA parallel transmission
    const totalDurationUs = triggerFrameTimeUs + DEFAULT_80211_CONSTANTS.SIFS_US + uplinkRuTxTimeUs +
                            DEFAULT_80211_CONSTANTS.SIFS_US + DEFAULT_80211_CONSTANTS.ACK_DURATION_US;

    this.channel.status = 'BUSY_TX';
    this.channel.activeTransmitters = scheduled.map(s => s.id);
    this.channel.txEndUs = this.currentTimeUs + totalDurationUs;

    this.timelineEvents.push({
      startUs: this.currentTimeUs,
      durationUs: totalDurationUs,
      type: 'OFDMA_TF',
      transmitters: scheduled.map(s => s.id),
      category: 'AC_BE',
      success: true,
    });

    // Deliver packets without contention collision!
    for (const sta of scheduled) {
      const q = sta.queues[sta.activeCategory];
      if (q.packets.length > 0) {
        const pkt = q.packets.shift()!;
        q.totalDelivered++;
        sta.packetsTransmitted++;
        sta.bytesTransmitted += pkt.sizeBytes;
        this.successfulBitsLastInterval += pkt.sizeBytes * 8;
        this.packetsDeliveredLastInterval++;
      }
      sta.macState = 'IDLE';
      sta.isTransmitting = false;
      q.cw = q.cwMin;
      q.backoffCounter = Math.floor(Math.random() * (q.cw + 1));
    }
  }

  /**
   * Central Scheduler selection for AP Downlink queue
   */
  public getNextScheduledStation(): Station | null {
    const clients = this.stations.filter(s => s.role === 'STATION');
    if (clients.length === 0) return null;

    switch (this.config.trafficScheduler) {
      case 'ROUND_ROBIN': {
        this.roundRobinIndex = (this.roundRobinIndex + 1) % clients.length;
        return clients[this.roundRobinIndex];
      }

      case 'PROPORTIONAL_FAIR': {
        // Maximize R_i / (T_i)^alpha
        let bestScore = -Infinity;
        let bestSta: Station = clients[0];
        for (const sta of clients) {
          const instRate = sta.phyRateMbps;
          const avgTput = Math.max(0.1, this.averageThroughputHistory.get(sta.id) || 1.0);
          const score = instRate / avgTput;
          if (score > bestScore) {
            bestScore = score;
            bestSta = sta;
          }
        }
        return bestSta;
      }

      case 'DEFICIT_ROUND_ROBIN': {
        // Quantum addition
        const quantumBytes = 1500;
        for (let i = 0; i < clients.length; i++) {
          const idx = (this.roundRobinIndex + i) % clients.length;
          const sta = clients[idx];
          const currentDeficit = (this.drrDeficitCounters.get(sta.id) || 0) + quantumBytes;
          const q = sta.queues[sta.activeCategory];
          const pktSize = q.packets[0]?.sizeBytes || 1500;

          if (currentDeficit >= pktSize) {
            this.drrDeficitCounters.set(sta.id, currentDeficit - pktSize);
            this.roundRobinIndex = idx;
            return sta;
          } else {
            this.drrDeficitCounters.set(sta.id, currentDeficit);
          }
        }
        return clients[0];
      }

      case 'EARLIEST_DEADLINE': {
        // Find station with packet closest to expiration deadline
        let earliestDeadline = Infinity;
        let selected: Station = clients[0];
        for (const sta of clients) {
          for (const cat of ['AC_VO', 'AC_VI', 'AC_BE', 'AC_BK'] as AccessCategory[]) {
            const p = sta.queues[cat].packets[0];
            if (p && p.deadlineUs < earliestDeadline) {
              earliestDeadline = p.deadlineUs;
              selected = sta;
            }
          }
        }
        return selected;
      }

      default:
        return clients[0];
    }
  }

  /**
   * Calculate aggregated simulation metrics
   */
  private updateMetrics() {
    const elapsedIntervalSec = 50_000 / 1_000_000;
    const throughputMbps = (this.successfulBitsLastInterval / 1_000_000) / elapsedIntervalSec;

    const totalAttempts = this.packetsDeliveredLastInterval + this.packetsCollidedLastInterval;
    const collisionRatePct = totalAttempts > 0
      ? (this.packetsCollidedLastInterval / totalAttempts) * 100
      : 0;

    const channelUtil = this.totalChannelSlots > 0
      ? ((this.channel.totalBusySlots + this.channel.totalCollisionSlots) / this.totalChannelSlots) * 100
      : 0;

    // Jain's Fairness Index = (sum x_i)^2 / (n * sum x_i^2)
    const clientStations = this.stations.filter(s => s.role === 'STATION');
    const bytes = clientStations.map(s => s.bytesTransmitted);
    const sumBytes = bytes.reduce((a, b) => a + b, 0);
    const sumSquares = bytes.reduce((a, b) => a + b * b, 0);
    const jainIndex = (sumBytes > 0 && sumSquares > 0)
      ? (sumBytes * sumBytes) / (clientStations.length * sumSquares)
      : 1.0;

    // Delay & Jitter
    let totalDelaySum = 0;
    let delayCount = 0;
    const allDelays: number[] = [];
    for (const sta of clientStations) {
      if (sta.lastDelaySamples.length > 0) {
        totalDelaySum += sta.averageDelayMs;
        delayCount++;
        allDelays.push(...sta.lastDelaySamples);
      }
    }
    const avgDelayMs = delayCount > 0 ? totalDelaySum / delayCount : 8.5;

    // Calculate jitter as standard deviation of packet delays
    let jitterMs = 1.2;
    if (allDelays.length > 1) {
      const mean = allDelays.reduce((a, b) => a + b, 0) / allDelays.length;
      const variance = allDelays.reduce((acc, d) => acc + (d - mean) ** 2, 0) / allDelays.length;
      jitterMs = Math.sqrt(variance);
    }

    const perCategoryThroughputMbps: Record<AccessCategory, number> = {
      AC_VO: throughputMbps * 0.15,
      AC_VI: throughputMbps * 0.35,
      AC_BE: throughputMbps * 0.35,
      AC_BK: throughputMbps * 0.15,
    };

    const perCategoryDelayMs: Record<AccessCategory, number> = {
      AC_VO: Math.max(2, avgDelayMs * 0.25),
      AC_VI: Math.max(5, avgDelayMs * 0.6),
      AC_BE: avgDelayMs,
      AC_BK: avgDelayMs * 1.8,
    };

    this.currentMetrics = {
      timestampUs: this.currentTimeUs,
      totalThroughputMbps: Math.round(throughputMbps * 100) / 100,
      channelUtilizationPct: Math.min(100, Math.round(channelUtil * 10) / 10),
      collisionRatePct: Math.min(100, Math.round(collisionRatePct * 10) / 10),
      averageDelayMs: Math.round(avgDelayMs * 10) / 10,
      jitterMs: Math.round(jitterMs * 10) / 10,
      jainsFairnessIndex: Math.round(jainIndex * 1000) / 1000,
      activeStationsCount: clientStations.length,
      totalPacketsSent: this.packetsDeliveredLastInterval,
      totalPacketsDropped: clientStations.reduce((acc, s) => acc + s.packetsLost, 0),
      perCategoryThroughputMbps,
      perCategoryDelayMs,
    };

    this.metricsHistory.push({ ...this.currentMetrics });
    if (this.metricsHistory.length > 80) {
      this.metricsHistory.shift();
    }

    // Reset interval counters
    this.successfulBitsLastInterval = 0;
    this.packetsDeliveredLastInterval = 0;
    this.packetsCollidedLastInterval = 0;
  }
}
