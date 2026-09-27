/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_80211_CONSTANTS } from './constants';

export interface BianchiResult {
  n: number;
  tau: number;         // Transmission probability per slot
  pCollision: number;  // Conditional collision probability
  pTransmission: number; // Probability at least one station transmits
  pSuccess: number;    // Probability transmission is successful given transmission
  saturationThroughputRatio: number; // Dimensionless throughput efficiency [0, 1]
  saturationThroughputMbps: number;
}

export class BianchiModel {
  /**
   * Numerically solve Bianchi's fixed point equation for n contending stations
   * @param n Number of contending stations
   * @param cwMin Minimum contention window (default 15 for 802.11a/g/n/ac/ax)
   * @param cwMax Maximum contention window (default 1023)
   * @param packetSizeBytes Average packet payload in bytes (default 1500)
   * @param phyDataRateMbps Channel physical bit rate in Mbps (e.g. 54 or 144)
   */
  static solve(
    n: number,
    cwMin: number = 15,
    cwMax: number = 1023,
    packetSizeBytes: number = 1500,
    phyDataRateMbps: number = 54
  ): BianchiResult {
    if (n < 1) {
      return {
        n,
        tau: 0,
        pCollision: 0,
        pTransmission: 0,
        pSuccess: 0,
        saturationThroughputRatio: 0,
        saturationThroughputMbps: 0,
      };
    }
    if (n === 1) {
      const packetTxTimeUs = (packetSizeBytes * 8) / phyDataRateMbps;
      const ts = DEFAULT_80211_CONSTANTS.PREAMBLE_HEADER_US + packetTxTimeUs +
                 DEFAULT_80211_CONSTANTS.SIFS_US + DEFAULT_80211_CONSTANTS.ACK_DURATION_US +
                 DEFAULT_80211_CONSTANTS.DIFS_US;
      const avgBackoffSlots = cwMin / 2;
      const throughputRatio = packetTxTimeUs / (avgBackoffSlots * DEFAULT_80211_CONSTANTS.SLOT_TIME_US + ts);
      return {
        n: 1,
        tau: 2 / (cwMin + 2),
        pCollision: 0,
        pTransmission: 1,
        pSuccess: 1,
        saturationThroughputRatio: throughputRatio,
        saturationThroughputMbps: throughputRatio * phyDataRateMbps,
      };
    }

    const W = cwMin + 1;
    const m = Math.round(Math.log2((cwMax + 1) / (cwMin + 1)));

    // Fixed point iteration to solve tau and p:
    // tau(p) = 2(1 - 2p) / [ (1 - 2p)(W + 1) + pW(1 - (2p)^m) ]
    // p(tau) = 1 - (1 - tau)^(n - 1)
    let p = 0.05;
    const maxIters = 100;
    const epsilon = 1e-6;

    for (let iter = 0; iter < maxIters; iter++) {
      let tau: number;
      if (Math.abs(p - 0.5) < 1e-5) {
        // Limit when 1 - 2p -> 0
        tau = 2 / (W + 1 + W * m / 2);
      } else {
        const num = 2 * (1 - 2 * p);
        const den = (1 - 2 * p) * (W + 1) + p * W * (1 - Math.pow(2 * p, m));
        tau = Math.max(1e-5, Math.min(0.999, num / den));
      }

      const pNext = 1 - Math.pow(1 - tau, n - 1);
      if (Math.abs(pNext - p) < epsilon) {
        p = pNext;
        break;
      }
      // Damped relaxation to avoid oscillations
      p = 0.6 * pNext + 0.4 * p;
    }

    const tauFinal = (p >= 0.999) 
      ? 2 / ((cwMax + 1)) 
      : (2 * (1 - 2 * p)) / ((1 - 2 * p) * (W + 1) + p * W * (1 - Math.pow(2 * p, m)));

    const pTr = 1 - Math.pow(1 - tauFinal, n);
    const pSuccess = (n * tauFinal * Math.pow(1 - tauFinal, n - 1)) / (pTr || 1e-6);

    const packetPayloadBits = packetSizeBytes * 8;
    const txDataDurationUs = DEFAULT_80211_CONSTANTS.PREAMBLE_HEADER_US + (packetPayloadBits / phyDataRateMbps);

    // Ts = PHY + DATA + SIFS + ACK + DIFS
    const Ts = txDataDurationUs + DEFAULT_80211_CONSTANTS.SIFS_US +
               DEFAULT_80211_CONSTANTS.ACK_DURATION_US + DEFAULT_80211_CONSTANTS.DIFS_US;

    // Tc = PHY + DATA + DIFS
    const Tc = txDataDurationUs + DEFAULT_80211_CONSTANTS.DIFS_US;

    const sigma = DEFAULT_80211_CONSTANTS.SLOT_TIME_US;

    const expectedPayloadUs = pSuccess * pTr * (packetPayloadBits / phyDataRateMbps);
    const expectedSlotLengthUs = (1 - pTr) * sigma + pTr * pSuccess * Ts + pTr * (1 - pSuccess) * Tc;

    const saturationThroughputRatio = expectedPayloadUs / expectedSlotLengthUs;
    const saturationThroughputMbps = saturationThroughputRatio * phyDataRateMbps;

    return {
      n,
      tau: tauFinal,
      pCollision: p,
      pTransmission: pTr,
      pSuccess,
      saturationThroughputRatio,
      saturationThroughputMbps,
    };
  }

  /**
   * Generate saturation throughput curve for a range of station counts
   */
  static generateCurve(
    maxStations: number = 50,
    cwMin: number = 15,
    cwMax: number = 1023,
    packetSizeBytes: number = 1500,
    phyDataRateMbps: number = 54
  ): BianchiResult[] {
    const points: BianchiResult[] = [];
    for (let count = 1; count <= maxStations; count += (count > 20 ? 2 : 1)) {
      points.push(this.solve(count, cwMin, cwMax, packetSizeBytes, phyDataRateMbps));
    }
    return points;
  }
}
