/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccessCategory } from '../types/wlan';

// IEEE 802.11 MAC Layer Standards Constants
export const DEFAULT_80211_CONSTANTS = {
  SLOT_TIME_US: 9,      // OFDM slot duration: 9 µs
  SIFS_US: 16,          // Short Inter-Frame Space: 16 µs
  DIFS_US: 34,          // Distributed Inter-Frame Space (SIFS + 2 * slot): 34 µs
  EIFS_US: 60,          // Extended IFS on collision: 60 µs
  PREAMBLE_HEADER_US: 20,// PHY preamble & PLCP header
  ACK_DURATION_US: 32,  // Standard BlockAck / ACK duration
  RTS_DURATION_US: 20,
  CTS_DURATION_US: 20,
  MAX_RETRY_LIMIT: 7,   // Dot11ShortRetryLimit
};

// 802.11e / 802.11ax EDCA Parameter Default Table
export const EDCA_DEFAULTS: Record<AccessCategory, {
  name: string;
  aifsn: number;
  cwMin: number;
  cwMax: number;
  txopUs: number;
  color: string;
  badgeBg: string;
  description: string;
}> = {
  AC_VO: {
    name: 'Voice (AC_VO)',
    aifsn: 2,
    cwMin: 3,
    cwMax: 7,
    txopUs: 1504,
    color: '#ef4444', // vibrant red
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    description: 'Highest priority for low-latency voice, VoIP, and gaming telemetry',
  },
  AC_VI: {
    name: 'Video (AC_VI)',
    aifsn: 2,
    cwMin: 7,
    cwMax: 15,
    txopUs: 3008,
    color: '#f59e0b', // amber
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    description: 'High priority with burst TXOP for video conferencing and 4K streams',
  },
  AC_BE: {
    name: 'Best Effort (AC_BE)',
    aifsn: 3,
    cwMin: 15,
    cwMax: 1023,
    txopUs: 0,
    color: '#06b6d4', // cyan
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    description: 'Standard legacy CSMA/CA priority for web browsing and standard TCP',
  },
  AC_BK: {
    name: 'Background (AC_BK)',
    aifsn: 7,
    cwMin: 15,
    cwMax: 1023,
    txopUs: 0,
    color: '#8b5cf6', // purple
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    description: 'Lowest priority for bulk file sync, cloud backups, and downloads',
  },
};

// 802.11ax OFDMA Resource Unit (RU) configurations for 20MHz channel
export const OFDMA_RU_CONFIGS = [
  { name: '26-tone RU', maxUsers: 9, subcarriers: 26, bandwidthKhz: 2000, rateRatio: 0.11 },
  { name: '52-tone RU', maxUsers: 4, subcarriers: 52, bandwidthKhz: 4000, rateRatio: 0.23 },
  { name: '106-tone RU', maxUsers: 2, subcarriers: 106, bandwidthKhz: 8000, rateRatio: 0.48 },
  { name: '242-tone RU', maxUsers: 1, subcarriers: 242, bandwidthKhz: 20000, rateRatio: 1.0 },
];

export const STATION_PALETTE = [
  '#38bdf8', '#34d399', '#a78bfa', '#fb923c', '#f472b6',
  '#4ade80', '#22d3ee', '#818cf8', '#fbbf24', '#f87171',
  '#2dd4bf', '#a3e635', '#e879f9', '#60a5fa', '#facc15',
];
