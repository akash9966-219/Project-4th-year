/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccessCategory = 'AC_VO' | 'AC_VI' | 'AC_BE' | 'AC_BK';

export type CongestionControlAlgorithm = 
  | 'STANDARD_BEB'      // Binary Exponential Backoff (IEEE 802.11 DCF/EDCA default)
  | 'IDLE_SENSE'        // Dynamic CW tracking target idle slots (optimal throughput)
  | 'AIMD_CW'           // Additive Increase Multiplicative Decrease CW adaptation
  | 'Q_LEARNING_RL';    // Deep / Reinforcement Learning adaptive contention control

export type TrafficSchedulerAlgorithm = 
  | 'ROUND_ROBIN'       // Classic cyclic queue scheduling
  | 'PROPORTIONAL_FAIR' // Maximize sum of log rates balancing SNR & throughput
  | 'DEFICIT_ROUND_ROBIN' // Quantum-based fairness for variable packet sizes
  | 'EARLIEST_DEADLINE' // Priority by remaining packet delay deadline
  | 'OFDMA_MULTI_USER'; // IEEE 802.11ax/be Multi-User Resource Unit (RU) allocation

export type AQMType = 'FIFO_DROP_TAIL' | 'CODEL' | 'FQ_CODEL';

export type TrafficPattern = 'VOICE' | 'VIDEO_STREAM' | 'BEST_EFFORT' | 'BACKGROUND_BULK' | 'MIXED_MULTIMEDIA';

export interface Packet {
  id: string;
  sourceId: string;
  destId: string;
  category: AccessCategory;
  sizeBytes: number;
  creationTimeUs: number; // Simulation time in microseconds
  deadlineUs: number;
  enqueueTimeUs: number;
  retries: number;
}

export interface EDCAQueueState {
  category: AccessCategory;
  aifsn: number;
  cw: number;
  cwMin: number;
  cwMax: number;
  txopUs: number;
  backoffCounter: number;
  packets: Packet[];
  totalEnqueued: number;
  totalDelivered: number;
  totalDropped: number;
  totalCollisions: number;
}

export type StationRole = 'AP' | 'STATION';

export interface Station {
  id: string;
  name: string;
  role: StationRole;
  x: number; // 2D position (meters)
  y: number;
  distanceToAp: number;
  snrDb: number;
  phyRateMbps: number;
  trafficPattern: TrafficPattern;
  packetRatePps: number; // Packets per second generated
  queues: Record<AccessCategory, EDCAQueueState>;
  // MAC state machine
  macState: 'IDLE' | 'DEFERRING_AIFS' | 'BACKING_OFF' | 'TRANSMITTING' | 'WAITING_ACK' | 'COLLIDED';
  activeCategory: AccessCategory;
  currentBackoff: number;
  currentCw: number;
  deferSlotsRemaining: number;
  currentTxEndTimeUs: number;
  isTransmitting: boolean;
  // Stats
  bytesTransmitted: number;
  packetsTransmitted: number;
  packetsLost: number;
  collisionCount: number;
  averageDelayMs: number;
  lastDelaySamples: number[];
  color: string;
  // Resource unit allocation for 802.11ax OFDMA
  assignedRuIndex?: number;
  assignedRuTones?: number;
  // Dynamic mobility model along predefined paths
  mobilityPath?: 'CIRCULAR' | 'FIGURE_EIGHT' | 'RADIAL_CONVERGE' | 'RANDOM_WAYPOINT';
  mobilitySpeed?: number; // meters per second
  baseAngle?: number;
  baseRadius?: number;
}

export interface ChannelState {
  status: 'IDLE' | 'BUSY_TX' | 'COLLISION';
  activeTransmitters: string[];
  txEndUs: number;
  slotDurationUs: number;
  totalIdleSlots: number;
  totalBusySlots: number;
  totalCollisionSlots: number;
}

export interface TimelineSlotEvent {
  startUs: number;
  durationUs: number;
  type: 'IDLE' | 'DIFS' | 'BACKOFF' | 'DATA_TX' | 'SIFS' | 'ACK' | 'COLLISION' | 'OFDMA_TF';
  transmitters: string[];
  category?: AccessCategory;
  packetId?: string;
  success?: boolean;
}

export interface DelayHistogramBin {
  binLabel: string;
  minMs: number;
  maxMs: number;
  totalCount: number;
  percentage: number;
  AC_VO: number;
  AC_VI: number;
  AC_BE: number;
  AC_BK: number;
}

export interface SimulationMetrics {
  timestampUs: number;
  totalThroughputMbps: number;
  channelUtilizationPct: number;
  collisionRatePct: number;
  averageDelayMs: number;
  jitterMs: number;
  p95DelayMs?: number;
  delayHistogram?: DelayHistogramBin[];
  jainsFairnessIndex: number;
  activeStationsCount: number;
  totalPacketsSent: number;
  totalPacketsDropped: number;
  perCategoryThroughputMbps: Record<AccessCategory, number>;
  perCategoryDelayMs: Record<AccessCategory, number>;
}

export interface QLearningAgentState {
  qTable: Record<string, number[]>; // stateKey -> [action0, action1, action2, action3]
  alpha: number; // Learning rate
  gamma: number; // Discount factor
  epsilon: number; // Exploration probability
  lastStateKey: string;
  lastAction: number;
  lastReward: number;
  totalRewardAccumulated: number;
  actionsTakenCount: number;
}

export type TopologyOrientationMode =
  | 'CONCENTRIC_TIERS'
  | 'RADIAL_STAR'
  | 'UNIFORM_HEXAGONAL'
  | 'PERIMETER_RING'
  | 'HIDDEN_TERMINAL_PAIRS';

export interface SimulationConfig {
  wifiStandard: '802.11ax' | '802.11ac' | '802.11n';
  channelBandwidthMhz: 20 | 40 | 80 | 160;
  congestionAlgorithm: CongestionControlAlgorithm;
  trafficScheduler: TrafficSchedulerAlgorithm;
  aqmMode: AQMType;
  stationCount: number;
  rtsCtsEnabled: boolean;
  rtsThresholdBytes: number;
  maxQueueCapacity: number;
  codelTargetMs: number;
  codelIntervalMs: number;
  slotTimeUs: number;
  sifsUs: number;
  difsUs: number;
  simSpeedMultiplier: number;
  enableNoiseChannelError: boolean;
  channelPerPct: number; // Packet Error Rate
  dynamicMobilityEnabled?: boolean;
  mobilityPattern?: 'ORBITAL' | 'CONVERGING' | 'FIGURE_EIGHT' | 'HYBRID';
  topologyMode?: TopologyOrientationMode;
}

export type ToastType = 'critical' | 'warning' | 'recovery' | 'info';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  throughputMbps?: number;
  thresholdMbps?: number;
  timestamp: number;
  simTimeMs: number;
  actionLabel?: string;
  actionType?: 'SWITCH_IDLE_SENSE' | 'SWITCH_OFDMA' | 'SWITCH_PF' | 'ENABLE_CODEL' | 'REDUCE_STATIONS';
}

export interface ToastSettings {
  enabled: boolean;
  throughputThresholdMbps: number;
  starvationFairnessThreshold: number;
  collisionThresholdPct: number;
  cooldownSeconds: number;
  soundEnabled: boolean;
}

export type CollisionRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface AlternativePreventionMethod {
  id: string;
  title: string;
  category: 'HANDSHAKE' | 'PHY_OFDMA' | 'MAC_BACKOFF' | 'QUEUE_AQM' | 'TOPOLOGY';
  description: string;
  technicalMechanism: string;
  expectedCollisionReductionPct: number;
  expectedThroughputGainPct: number;
  actionConfig: Partial<SimulationConfig>;
  triggerReorientMode?: TopologyOrientationMode | null;
  actionButtonText: string;
  applied?: boolean;
}

export interface AIPredictionResult {
  timestampMs: number;
  predictedCollisionRiskPct: number;
  riskLevel: CollisionRiskLevel;
  projectedRateIn5sPct: number;
  timeToCollapseSec: number | null;
  contentionEntropy: number;
  rootCauseDiagnosis: string;
  alternativeMethods: AlternativePreventionMethod[];
  source: 'GEMINI_AI' | 'BIANCHI_NEURAL_HEURISTIC';
}

export interface NormalcyHealthReport {
  overallHealthScore: number; // 0 to 100
  status: 'OPTIMAL' | 'ELEVATED' | 'HIGH_CONTENTION' | 'COLLAPSE';
  collisionHealth: number;    // 0 to 100
  throughputHealth: number;   // 0 to 100
  delayHealth: number;        // 0 to 100
  fairnessHealth: number;     // 0 to 100
  isAtNormalcy: boolean;
  activeBottlenecks: string[];
}

export interface NormalcyInterventionLog {
  id: string;
  timestamp: number;
  simTimeMs: number;
  triggerReason: string;
  actionsTaken: string[];
  healthScoreBefore: number;
  healthScoreAfter: number;
  reductionCollisionPct: number;
}
