/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Station, AccessCategory, TrafficPattern } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import {
  Users,
  ArrowUpDown,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Flame,
  Clock,
  Radio,
  Wifi,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Signal,
  Layers,
  Sparkles,
} from 'lucide-react';

export type StationSortKey =
  | 'throughput-asc'
  | 'throughput-desc'
  | 'collision-desc'
  | 'collision-asc'
  | 'delay-desc'
  | 'delay-asc'
  | 'drops-desc'
  | 'backlog-desc'
  | 'snr-asc'
  | 'id-asc';

export type StationFilterMode =
  | 'ALL'
  | 'STRUGGLING'
  | 'HIGH_COLLISION'
  | 'HIGH_DELAY'
  | 'PACKET_LOSS';

interface StationManagementViewProps {
  stations: Station[];
  onSelectStation: (stationId: string) => void;
  selectedStationId?: string | null;
}

interface StationPerformanceRecord {
  station: Station;
  idNumber: number;
  throughputMb: number;
  throughputMbps: number;
  totalAttempts: number;
  collisionRatePct: number;
  averageDelayMs: number;
  packetsLost: number;
  totalQueued: number;
  snrDb: number;
  distanceToAp: number;
  phyRateMbps: number;
  isStruggling: boolean;
  strugglingReasons: string[];
  healthStatus: 'CRITICAL' | 'WARNING' | 'HEALTHY';
}

export const StationManagementView: React.FC<StationManagementViewProps> = ({
  stations,
  onSelectStation,
  selectedStationId,
}) => {
  const [sortKey, setSortKey] = useState<StationSortKey>('collision-desc');
  const [filterMode, setFilterMode] = useState<StationFilterMode>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract client stations (exclude AP)
  const clientStations = useMemo(() => {
    return stations.filter((s) => s.role === 'STATION');
  }, [stations]);

  // Compute performance metrics for each station
  const stationRecords: StationPerformanceRecord[] = useMemo(() => {
    return clientStations.map((sta) => {
      const idMatch = sta.id.match(/\d+/);
      const idNumber = idMatch ? parseInt(idMatch[0], 10) : 0;

      const throughputMb = (sta.bytesTransmitted * 8) / 1e6;
      const throughputMbps = sta.bytesTransmitted > 0 ? (sta.bytesTransmitted * 8) / 1e6 : 0;
      const totalAttempts = sta.packetsTransmitted + sta.collisionCount;
      const collisionRatePct = totalAttempts > 0 ? (sta.collisionCount / totalAttempts) * 100 : 0;
      const averageDelayMs = sta.averageDelayMs || 0;
      const packetsLost = sta.packetsLost || 0;

      const totalQueued = Object.values(sta.queues).reduce(
        (sum, q) => sum + (q?.packets?.length || 0),
        0
      );

      // Determine struggling criteria
      const strugglingReasons: string[] = [];
      if (collisionRatePct >= 25) {
        strugglingReasons.push(`High Collision (${collisionRatePct.toFixed(1)}%)`);
      }
      if (averageDelayMs >= 40) {
        strugglingReasons.push(`Latency Starvation (${averageDelayMs.toFixed(1)}ms)`);
      }
      if (packetsLost > 0) {
        strugglingReasons.push(`Packet Drops (${packetsLost} lost)`);
      }
      if (totalQueued >= 8) {
        strugglingReasons.push(`Queue Backlog (${totalQueued} buffered)`);
      }
      if (sta.macState === 'COLLIDED') {
        strugglingReasons.push('In MAC Collision');
      }
      if (sta.snrDb < 12) {
        strugglingReasons.push(`Poor SNR (${sta.snrDb}dB)`);
      }

      const isStruggling = strugglingReasons.length > 0;

      let healthStatus: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
      if (collisionRatePct >= 35 || averageDelayMs >= 60 || packetsLost >= 5) {
        healthStatus = 'CRITICAL';
      } else if (isStruggling) {
        healthStatus = 'WARNING';
      }

      return {
        station: sta,
        idNumber,
        throughputMb,
        throughputMbps,
        totalAttempts,
        collisionRatePct,
        averageDelayMs,
        packetsLost,
        totalQueued,
        snrDb: sta.snrDb,
        distanceToAp: sta.distanceToAp,
        phyRateMbps: sta.phyRateMbps,
        isStruggling,
        strugglingReasons,
        healthStatus,
      };
    });
  }, [clientStations]);

  // Aggregate overview stats
  const maxThroughput = useMemo(() => {
    return Math.max(0.1, ...stationRecords.map((r) => r.throughputMb));
  }, [stationRecords]);

  const strugglingCount = useMemo(() => {
    return stationRecords.filter((r) => r.isStruggling).length;
  }, [stationRecords]);

  const highCollisionCount = useMemo(() => {
    return stationRecords.filter((r) => r.collisionRatePct >= 20).length;
  }, [stationRecords]);

  const highDelayCount = useMemo(() => {
    return stationRecords.filter((r) => r.averageDelayMs >= 30).length;
  }, [stationRecords]);

  const packetLossCount = useMemo(() => {
    return stationRecords.filter((r) => r.packetsLost > 0).length;
  }, [stationRecords]);

  // Filter and sort stations
  const processedStations = useMemo(() => {
    let result = [...stationRecords];

    // Filter Mode
    if (filterMode === 'STRUGGLING') {
      result = result.filter((r) => r.isStruggling);
    } else if (filterMode === 'HIGH_COLLISION') {
      result = result.filter((r) => r.collisionRatePct >= 20);
    } else if (filterMode === 'HIGH_DELAY') {
      result = result.filter((r) => r.averageDelayMs >= 30);
    } else if (filterMode === 'PACKET_LOSS') {
      result = result.filter((r) => r.packetsLost > 0);
    }

    // Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.station.id.toLowerCase().includes(q) ||
          r.station.name.toLowerCase().includes(q) ||
          r.station.trafficPattern.toLowerCase().includes(q) ||
          r.station.activeCategory.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortKey) {
        case 'throughput-asc':
          return a.throughputMb - b.throughputMb; // Lowest first (find starved nodes)
        case 'throughput-desc':
          return b.throughputMb - a.throughputMb; // Highest first
        case 'collision-desc':
          return b.collisionRatePct - a.collisionRatePct; // Highest collision first
        case 'collision-asc':
          return a.collisionRatePct - b.collisionRatePct;
        case 'delay-desc':
          return b.averageDelayMs - a.averageDelayMs; // Highest latency first
        case 'delay-asc':
          return a.averageDelayMs - b.averageDelayMs;
        case 'drops-desc':
          return b.packetsLost - a.packetsLost; // Most drops first
        case 'backlog-desc':
          return b.totalQueued - a.totalQueued; // Highest buffer backlog first
        case 'snr-asc':
          return a.snrDb - b.snrDb; // Lowest SNR first (edge nodes)
        case 'id-asc':
        default:
          return a.idNumber - b.idNumber;
      }
    });

    return result;
  }, [stationRecords, filterMode, searchQuery, sortKey]);

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-4 sm:p-5 flex flex-col gap-5 shadow-lg shadow-slate-950/50">
      {/* Top Header & Overview Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Wireless Station Fleet Management</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-300">
                  {clientStations.length} Contending STAs
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit node health, sort by performance bottlenecks, and inspect struggling contention queues
              </p>
            </div>
          </div>
        </div>

        {/* Quick Health Status Indicator Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {strugglingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
              <span>
                <strong>{strugglingCount}</strong> Struggling Node{strugglingCount > 1 ? 's' : ''} Detected
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>All {clientStations.length} Nodes Operating Normal</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Contending Stations</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold font-mono text-white">{clientStations.length}</span>
            <span className="text-xs text-slate-500">nodes</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          strugglingCount > 0
            ? 'bg-red-950/30 border-red-500/40'
            : 'bg-slate-900/60 border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Struggling / Starving</span>
            <AlertOctagon className={`w-3.5 h-3.5 ${strugglingCount > 0 ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-xl font-bold font-mono ${strugglingCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {strugglingCount}
            </span>
            <span className="text-xs text-slate-500">
              ({clientStations.length > 0 ? ((strugglingCount / clientStations.length) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          highCollisionCount > 0
            ? 'bg-amber-950/30 border-amber-500/40'
            : 'bg-slate-900/60 border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">High Collisions (&gt;20%)</span>
            <Flame className={`w-3.5 h-3.5 ${highCollisionCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-xl font-bold font-mono ${highCollisionCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {highCollisionCount}
            </span>
            <span className="text-xs text-slate-500">STAs</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          highDelayCount > 0
            ? 'bg-purple-950/30 border-purple-500/40'
            : 'bg-slate-900/60 border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Queuing Latency (&gt;30ms)</span>
            <Clock className={`w-3.5 h-3.5 ${highDelayCount > 0 ? 'text-purple-400' : 'text-slate-500'}`} />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-xl font-bold font-mono ${highDelayCount > 0 ? 'text-purple-400' : 'text-slate-300'}`}>
              {highDelayCount}
            </span>
            <span className="text-xs text-slate-500">STAs</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search, Filters & Sorting */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        {/* Left: Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-sky-500 text-white font-semibold shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Stations ({clientStations.length})
          </button>

          <button
            onClick={() => setFilterMode('STRUGGLING')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'STRUGGLING'
                ? 'bg-red-500 text-white font-semibold shadow-sm'
                : strugglingCount > 0
                ? 'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Struggling Nodes ({strugglingCount})</span>
          </button>

          <button
            onClick={() => setFilterMode('HIGH_COLLISION')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'HIGH_COLLISION'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>High Collision ({highCollisionCount})</span>
          </button>

          <button
            onClick={() => setFilterMode('HIGH_DELAY')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'HIGH_DELAY'
                ? 'bg-purple-500 text-white font-semibold shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>High Latency ({highDelayCount})</span>
          </button>

          {packetLossCount > 0 && (
            <button
              onClick={() => setFilterMode('PACKET_LOSS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'PACKET_LOSS'
                  ? 'bg-red-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>Drops ({packetLossCount})</span>
            </button>
          )}
        </div>

        {/* Right: Search & Sorting Selector */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search STA or profile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Performance Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-500 text-[11px] hidden sm:inline">Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as StationSortKey)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <optgroup label="Identify Bottlenecks & Struggling Nodes">
                <option value="collision-desc">💥 Collision Rate (Highest First)</option>
                <option value="throughput-asc">📉 Throughput (Lowest / Starved First)</option>
                <option value="delay-desc">⏱️ Latency (Highest / Bufferbloat First)</option>
                <option value="drops-desc">❌ Packets Dropped (Highest First)</option>
                <option value="backlog-desc">📦 Queue Backlog (Largest First)</option>
                <option value="snr-asc">📡 Signal SNR (Weakest First)</option>
              </optgroup>
              <optgroup label="Standard Metrics">
                <option value="throughput-desc">📈 Throughput (Highest First)</option>
                <option value="collision-asc">✅ Collision Rate (Lowest First)</option>
                <option value="delay-asc">⚡ Latency (Lowest First)</option>
                <option value="id-asc">🔢 Station Number (Default 1-N)</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Main Station Performance Table */}
      <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/70">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800/80 text-[11px] font-mono text-slate-400 bg-slate-900/60 uppercase tracking-wider">
              <th className="py-2.5 px-3">Station Node</th>
              <th className="py-2.5 px-3">Health Status</th>
              <th
                onClick={() => setSortKey(sortKey === 'throughput-asc' ? 'throughput-desc' : 'throughput-asc')}
                className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Throughput</span>
                  <ArrowUpDown className="w-3 h-3 text-sky-400" />
                </div>
              </th>
              <th
                onClick={() => setSortKey(sortKey === 'collision-desc' ? 'collision-asc' : 'collision-desc')}
                className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Collision Rate</span>
                  <ArrowUpDown className="w-3 h-3 text-amber-400" />
                </div>
              </th>
              <th
                onClick={() => setSortKey(sortKey === 'delay-desc' ? 'delay-asc' : 'delay-desc')}
                className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Mean Latency</span>
                  <ArrowUpDown className="w-3 h-3 text-purple-400" />
                </div>
              </th>
              <th className="py-2.5 px-3">Queue Backlog</th>
              <th className="py-2.5 px-3">PHY Link &amp; Distance</th>
              <th className="py-2.5 px-3 text-right">Inspection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {processedStations.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                  No stations match the selected filter or search query.
                </td>
              </tr>
            ) : (
              processedStations.map((record) => {
                const { station, throughputMb, collisionRatePct, averageDelayMs, packetsLost, totalQueued } = record;
                const isSelected = selectedStationId === station.id;
                const catDef = EDCA_DEFAULTS[station.activeCategory];
                const tputPct = (throughputMb / maxThroughput) * 100;

                return (
                  <tr
                    key={station.id}
                    onClick={() => onSelectStation(station.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-sky-500/10 hover:bg-sky-500/15'
                        : record.healthStatus === 'CRITICAL'
                        ? 'bg-red-950/20 hover:bg-red-950/30'
                        : record.healthStatus === 'WARNING'
                        ? 'bg-amber-950/15 hover:bg-amber-950/25'
                        : 'hover:bg-slate-900/50'
                    }`}
                  >
                    {/* 1. Station Node */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: station.color }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-white font-mono">
                            <span>{station.id}</span>
                            {station.isTransmitting && (
                              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-sans block">
                            {station.trafficPattern.replace('_', ' ')} · {station.activeCategory}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Health Status Badge */}
                    <td className="py-2.5 px-3 font-sans">
                      {record.healthStatus === 'CRITICAL' ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                            <AlertOctagon className="w-3 h-3" />
                            <span>STRUGGLING</span>
                          </span>
                          <span className="text-[10px] text-red-400/90 font-mono">
                            {record.strugglingReasons[0]}
                          </span>
                        </div>
                      ) : record.healthStatus === 'WARNING' ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <AlertTriangle className="w-3 h-3" />
                            <span>CONGESTED</span>
                          </span>
                          <span className="text-[10px] text-amber-400/90 font-mono">
                            {record.strugglingReasons[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>HEALTHY</span>
                        </span>
                      )}
                    </td>

                    {/* 3. Throughput */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-1 w-28">
                        <div className="flex items-baseline justify-between text-xs tabular-nums">
                          <span className="font-semibold text-white">
                            {throughputMb.toFixed(2)} MB
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {station.packetsTransmitted} pkts
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(3, tputPct)}%`,
                              backgroundColor: catDef?.color || '#38bdf8',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 4. Collision Rate */}
                    <td className="py-2.5 px-3 tabular-nums">
                      <div className="flex flex-col">
                        <span
                          className={`font-semibold text-xs ${
                            collisionRatePct >= 25
                              ? 'text-red-400'
                              : collisionRatePct >= 12
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {collisionRatePct.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {station.collisionCount} coll / {record.totalAttempts} att
                        </span>
                      </div>
                    </td>

                    {/* 5. Mean Latency */}
                    <td className="py-2.5 px-3 tabular-nums">
                      <div className="flex flex-col">
                        <span
                          className={`font-semibold text-xs ${
                            averageDelayMs >= 40
                              ? 'text-red-400'
                              : averageDelayMs >= 20
                              ? 'text-amber-400'
                              : 'text-sky-300'
                          }`}
                        >
                          {averageDelayMs.toFixed(1)} ms
                        </span>
                        <span className="text-[10px] text-slate-500">
                          CW: {station.currentCw} (max {catDef?.cwMax})
                        </span>
                      </div>
                    </td>

                    {/* 6. Queue Backlog */}
                    <td className="py-2.5 px-3 tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-semibold text-xs ${
                            totalQueued >= 10
                              ? 'text-red-400'
                              : totalQueued >= 4
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {totalQueued} pkts
                        </span>
                        {packetsLost > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/30">
                            -{packetsLost} lost
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 7. PHY Link & Distance */}
                    <td className="py-2.5 px-3 tabular-nums text-[11px]">
                      <div className="text-slate-300">
                        {station.phyRateMbps} Mbps · {station.snrDb} dB SNR
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Dist: {station.distanceToAp.toFixed(1)}m
                        {station.mobilityPath && (
                          <span className="text-purple-400 ml-1">· Moving</span>
                        )}
                      </div>
                    </td>

                    {/* 8. Inspect Action */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStation(station.id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-sky-500/50 hover:bg-sky-500/10 transition-all font-sans text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3 h-3 text-sky-400" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Guidance Note */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 font-sans">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>
            <strong>Performance Diagnostics:</strong> Nodes with high collision rates or &gt;40ms queuing delay indicate binary backoff contention collapse or DropTail bufferbloat.
          </span>
        </div>
        <span className="text-slate-500 font-mono hidden md:inline">
          Click any row to open deep EDCA queue inspector
        </span>
      </div>
    </div>
  );
};
