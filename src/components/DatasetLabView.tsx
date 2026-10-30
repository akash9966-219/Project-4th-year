/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CustomStationRecord,
  CustomTracePacket,
  CustomTelemetryEntry,
  DatasetType,
  ImportedDataset,
  SimulationConfig,
} from '../types/wlan';
import {
  Database,
  Upload,
  Download,
  FileText,
  Play,
  Check,
  AlertCircle,
  Copy,
  Sparkles,
  RefreshCw,
  FileCode,
  Layers,
  Users,
  Activity,
  CheckCircle2,
} from 'lucide-react';

interface DatasetLabViewProps {
  onLoadCustomTopology: (stations: CustomStationRecord[]) => void;
  onInjectTracePackets: (packets: CustomTracePacket[]) => number;
  onLoadTelemetryStream: (entries: CustomTelemetryEntry[]) => void;
  onExportCurrent: (type: DatasetType, format: 'JSON' | 'CSV') => string;
  onTriggerAiAudit?: () => void;
  onApplyToast?: (msg: string, type: 'critical' | 'warning' | 'recovery' | 'info') => void;
}

export const DatasetLabView: React.FC<DatasetLabViewProps> = ({
  onLoadCustomTopology,
  onInjectTracePackets,
  onLoadTelemetryStream,
  onExportCurrent,
  onTriggerAiAudit,
  onApplyToast,
}) => {
  const [datasetType, setDatasetType] = useState<DatasetType>('STATION_TOPOLOGY');
  const [inputFormat, setInputFormat] = useState<'JSON' | 'CSV'>('JSON');
  const [rawInputText, setRawInputText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  // Sample real-world dataset templates
  const SAMPLE_TOPOLOGY_JSON = JSON.stringify(
    [
      { id: 'STA-01', name: 'MacBook Pro Lab', x: -8.5, y: 12.0, trafficRateMbps: 18.5, primaryCategory: 'AC_VI' },
      { id: 'STA-02', name: 'iPhone Executive', x: 10.2, y: 9.4, trafficRateMbps: 4.2, primaryCategory: 'AC_VO' },
      { id: 'STA-03', name: 'IoT Temp Sensor', x: -22.0, y: -4.5, trafficRateMbps: 0.8, primaryCategory: 'AC_BK' },
      { id: 'STA-04', name: 'Research Workstation', x: 5.0, y: -14.0, trafficRateMbps: 22.0, primaryCategory: 'AC_BE' },
      { id: 'STA-05', name: 'Auditorium Camera', x: 23.5, y: -2.0, trafficRateMbps: 16.0, primaryCategory: 'AC_VI' },
      { id: 'STA-06', name: 'Hidden Terminal East', x: 26.0, y: 0.0, trafficRateMbps: 12.0, primaryCategory: 'AC_BE' },
      { id: 'STA-07', name: 'Hidden Terminal West', x: -26.0, y: 0.0, trafficRateMbps: 12.0, primaryCategory: 'AC_BE' },
      { id: 'STA-08', name: 'VoIP Phone Lobby', x: 2.5, y: 6.0, trafficRateMbps: 1.5, primaryCategory: 'AC_VO' },
    ],
    null,
    2
  );

  const SAMPLE_TOPOLOGY_CSV = `id,name,x,y,trafficRateMbps,primaryCategory
STA-01,"MacBook Pro Lab",-8.5,12.0,18.5,AC_VI
STA-02,"iPhone Executive",10.2,9.4,4.2,AC_VO
STA-03,"IoT Temp Sensor",-22.0,-4.5,0.8,AC_BK
STA-04,"Research Workstation",5.0,-14.0,22.0,AC_BE
STA-05,"Auditorium Camera",23.5,-2.0,16.0,AC_VI
STA-06,"Hidden Terminal East",26.0,0.0,12.0,AC_BE
STA-07,"Hidden Terminal West",-26.0,0.0,12.0,AC_BE
STA-08,"VoIP Phone Lobby",2.5,6.0,1.5,AC_VO`;

  const SAMPLE_PACKET_TRACE_JSON = JSON.stringify(
    [
      { timeOffsetMs: 5, stationId: 'STA-01', packetSizeBytes: 1500, accessCategory: 'AC_VI' },
      { timeOffsetMs: 12, stationId: 'STA-02', packetSizeBytes: 200, accessCategory: 'AC_VO' },
      { timeOffsetMs: 18, stationId: 'STA-06', packetSizeBytes: 1500, accessCategory: 'AC_BE' },
      { timeOffsetMs: 18, stationId: 'STA-07', packetSizeBytes: 1500, accessCategory: 'AC_BE' },
      { timeOffsetMs: 25, stationId: 'STA-04', packetSizeBytes: 1500, accessCategory: 'AC_BE' },
      { timeOffsetMs: 34, stationId: 'STA-05', packetSizeBytes: 1200, accessCategory: 'AC_VI' },
      { timeOffsetMs: 40, stationId: 'STA-08', packetSizeBytes: 160, accessCategory: 'AC_VO' },
      { timeOffsetMs: 48, stationId: 'STA-03', packetSizeBytes: 1500, accessCategory: 'AC_BK' },
    ],
    null,
    2
  );

  const SAMPLE_TELEMETRY_JSON = JSON.stringify(
    [
      { timeSec: 1.0, stationCount: 16, collisionRatePct: 8.5, throughputMbps: 21.2, averageDelayMs: 6.4, jainsFairnessIndex: 0.88 },
      { timeSec: 2.0, stationCount: 20, collisionRatePct: 15.2, throughputMbps: 18.4, averageDelayMs: 12.1, jainsFairnessIndex: 0.81 },
      { timeSec: 3.0, stationCount: 24, collisionRatePct: 24.8, throughputMbps: 14.0, averageDelayMs: 24.5, jainsFairnessIndex: 0.72 },
      { timeSec: 4.0, stationCount: 28, collisionRatePct: 34.2, throughputMbps: 8.8, averageDelayMs: 42.0, jainsFairnessIndex: 0.58 },
      { timeSec: 5.0, stationCount: 28, collisionRatePct: 38.6, throughputMbps: 6.1, averageDelayMs: 58.0, jainsFairnessIndex: 0.51 },
    ],
    null,
    2
  );

  // Load a preset template into the text area
  const handleLoadTemplate = (type: DatasetType, format: 'JSON' | 'CSV') => {
    setDatasetType(type);
    setInputFormat(format);
    if (type === 'STATION_TOPOLOGY') {
      setRawInputText(format === 'JSON' ? SAMPLE_TOPOLOGY_JSON : SAMPLE_TOPOLOGY_CSV);
    } else if (type === 'PACKET_TRACE') {
      setRawInputText(SAMPLE_PACKET_TRACE_JSON);
    } else {
      setRawInputText(SAMPLE_TELEMETRY_JSON);
    }
    setStatusMessage(null);
    setParsedCount(null);
  };

  // Handle local file upload (drag & drop or file dialog)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawInputText(content);
      if (file.name.endsWith('.csv')) setInputFormat('CSV');
      else setInputFormat('JSON');
      setStatusMessage({ text: `Loaded file: ${file.name} (${Math.round(file.size / 1024)} KB)`, isError: false });
    };
    reader.readAsText(file);
  };

  // Parse and apply the dataset
  const handleApplyDataset = () => {
    if (!rawInputText.trim()) {
      setStatusMessage({ text: 'Please paste or upload dataset content first.', isError: true });
      return;
    }

    try {
      if (datasetType === 'STATION_TOPOLOGY') {
        let stations: CustomStationRecord[] = [];
        if (inputFormat === 'JSON') {
          const parsed = JSON.parse(rawInputText);
          if (!Array.isArray(parsed)) throw new Error('JSON topology must be an array of station objects.');
          stations = parsed.map((item: any, idx: number) => ({
            id: item.id || `STA-${(idx + 1).toString().padStart(2, '0')}`,
            name: item.name || `Station ${idx + 1}`,
            x: Number(item.x) || 0,
            y: Number(item.y) || 0,
            trafficRateMbps: item.trafficRateMbps ? Number(item.trafficRateMbps) : 10,
            primaryCategory: item.primaryCategory || 'AC_BE',
            txPowerDbm: item.txPowerDbm ? Number(item.txPowerDbm) : 18,
          }));
        } else {
          // CSV Parser
          const lines = rawInputText.trim().split('\n');
          const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
          const xIdx = header.indexOf('x');
          const yIdx = header.indexOf('y');
          const idIdx = header.indexOf('id');
          const nameIdx = header.indexOf('name');
          const rateIdx = header.findIndex((h) => h.includes('rate'));

          if (xIdx === -1 || yIdx === -1) throw new Error('CSV must contain "x" and "y" coordinate columns.');

          stations = lines.slice(1).filter((l) => l.trim()).map((line, idx) => {
            const parts = line.split(',').map((p) => p.replace(/"/g, '').trim());
            return {
              id: idIdx !== -1 && parts[idIdx] ? parts[idIdx] : `STA-${(idx + 1).toString().padStart(2, '0')}`,
              name: nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx] : `Station ${idx + 1}`,
              x: parseFloat(parts[xIdx]) || 0,
              y: parseFloat(parts[yIdx]) || 0,
              trafficRateMbps: rateIdx !== -1 ? parseFloat(parts[rateIdx]) || 10 : 10,
              primaryCategory: 'AC_BE',
            };
          });
        }

        onLoadCustomTopology(stations);
        setParsedCount(stations.length);
        setStatusMessage({ text: `Successfully loaded custom topology with ${stations.length} wireless stations!`, isError: false });
        if (onApplyToast) onApplyToast(`Applied custom topology (${stations.length} stations)`, 'info');
      } else if (datasetType === 'PACKET_TRACE') {
        const parsed = JSON.parse(rawInputText);
        if (!Array.isArray(parsed)) throw new Error('Packet trace must be an array of packet objects.');
        const packets: CustomTracePacket[] = parsed.map((p: any) => ({
          timeOffsetMs: Number(p.timeOffsetMs) || 0,
          stationId: p.stationId || 'STA-01',
          packetSizeBytes: Number(p.packetSizeBytes) || 1500,
          accessCategory: p.accessCategory || 'AC_BE',
        }));

        const count = onInjectTracePackets(packets);
        setParsedCount(count);
        setStatusMessage({ text: `Successfully injected ${count} custom packets into EDCA queues!`, isError: false });
        if (onApplyToast) onApplyToast(`Injected ${count} custom trace packets`, 'info');
      } else if (datasetType === 'TELEMETRY_SERIES') {
        const parsed = JSON.parse(rawInputText);
        if (!Array.isArray(parsed)) throw new Error('Telemetry series must be an array of metric entries.');
        const entries: CustomTelemetryEntry[] = parsed.map((e: any) => ({
          timeSec: Number(e.timeSec) || 0,
          stationCount: Number(e.stationCount) || 12,
          collisionRatePct: Number(e.collisionRatePct) || 10,
          throughputMbps: Number(e.throughputMbps) || 15,
          averageDelayMs: Number(e.averageDelayMs) || 8,
          jainsFairnessIndex: e.jainsFairnessIndex ? Number(e.jainsFairnessIndex) : 0.85,
        }));

        onLoadTelemetryStream(entries);
        setParsedCount(entries.length);
        setStatusMessage({ text: `Successfully streamed ${entries.length} empirical telemetry points to AI Predictor!`, isError: false });
        if (onTriggerAiAudit) onTriggerAiAudit();
        if (onApplyToast) onApplyToast(`Streamed ${entries.length} telemetry points. AI Audit triggered.`, 'recovery');
      }
    } catch (err: any) {
      setStatusMessage({ text: `Parse Error: ${err.message}`, isError: true });
    }
  };

  // Download exported current simulation dataset
  const handleExport = (format: 'JSON' | 'CSV') => {
    const text = onExportCurrent(datasetType, format);
    const blob = new Blob([text], { type: format === 'JSON' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wlan-dataset-${datasetType.toLowerCase()}.${format.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
    if (onApplyToast) onApplyToast(`Exported ${datasetType} as ${format}`, 'info');
  };

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full">
      {/* Top Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-slate-950/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-sky-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-0" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 via-purple-500/20 to-emerald-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
            <Database className="w-5 h-5 text-sky-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Custom Dataset Import &amp; Trace Injection Lab</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                CSV / JSON Support
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Inject your own Wi-Fi traces, custom floor-plan station topologies, or testbed metrics to drive the simulation &amp; AI predictor
            </p>
          </div>
        </div>

        {/* Export Current Data Buttons */}
        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <span className="text-[11px] text-slate-400 font-mono hidden lg:inline">Export Current State:</span>
          <button
            onClick={() => handleExport('JSON')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Download current simulation data as JSON"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>JSON</span>
          </button>
          <button
            onClick={() => handleExport('CSV')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Download current simulation data as CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Dataset Type Selection & Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Preset Templates & Controls */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-lg shadow-slate-950/30">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>1. Select Dataset Category</span>
          </h3>

          <div className="flex flex-col gap-2">
            {[
              {
                type: 'STATION_TOPOLOGY' as DatasetType,
                title: 'Station Fleet Topology',
                desc: 'Upload custom (x, y) coordinates, MCS rates, and traffic rates for each client station.',
                icon: Users,
              },
              {
                type: 'PACKET_TRACE' as DatasetType,
                title: 'Packet Arrival Trace',
                desc: 'Inject real Wi-Fi pcap or NS-3 packet arrivals with custom sizes and EDCA categories.',
                icon: FileText,
              },
              {
                type: 'TELEMETRY_SERIES' as DatasetType,
                title: 'Empirical Telemetry Series',
                desc: 'Feed recorded testbed collision rates, throughputs, and delays directly to the AI.',
                icon: Activity,
              },
            ].map((cat) => {
              const Icon = cat.icon;
              const isSelected = datasetType === cat.type;
              return (
                <button
                  key={cat.type}
                  onClick={() => {
                    setDatasetType(cat.type);
                    handleLoadTemplate(cat.type, inputFormat);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-500/50 shadow-sm shadow-sky-500/20'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-white text-xs">{cat.title}</span>
                    <span className="text-[11px] text-slate-400 leading-snug">{cat.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Real-World Templates */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Real-World Templates:</span>
            </span>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleLoadTemplate('STATION_TOPOLOGY', 'JSON')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                Topology JSON
              </button>
              <button
                onClick={() => handleLoadTemplate('STATION_TOPOLOGY', 'CSV')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                Topology CSV
              </button>
              <button
                onClick={() => handleLoadTemplate('PACKET_TRACE', 'JSON')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                Packet Trace
              </button>
              <button
                onClick={() => handleLoadTemplate('TELEMETRY_SERIES', 'JSON')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                Telemetry Series
              </button>
            </div>
          </div>

          {/* Upload File Box */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Upload CSV / JSON File:</span>
            </span>
            <label className="border border-dashed border-slate-700 hover:border-sky-500/60 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-colors">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">Click to browse or drop file here</span>
              <span className="text-[10px] text-slate-500 font-mono">Supports .json, .csv</span>
              <input type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Right 2 Columns: Live Text/Data Editor */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 shadow-lg shadow-slate-950/30">
          <div className="flex flex-col gap-3">
            {/* Editor Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-white text-sm">2. Dataset Payload Editor</span>
                <span className="text-xs font-mono text-slate-500">({inputFormat})</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setInputFormat('JSON')}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                      inputFormat === 'JSON' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setInputFormat('CSV')}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                      inputFormat === 'CSV' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    CSV
                  </button>
                </div>

                <button
                  onClick={() => setRawInputText('')}
                  className="px-2 py-1 rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Clear editor"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Code / Text Area */}
            <div className="relative">
              <textarea
                value={rawInputText}
                onChange={(e) => setRawInputText(e.target.value)}
                placeholder={
                  datasetType === 'STATION_TOPOLOGY'
                    ? 'Paste your station list JSON or CSV here...'
                    : datasetType === 'PACKET_TRACE'
                    ? 'Paste your packet trace array here...'
                    : 'Paste your telemetry time-series array here...'
                }
                rows={16}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/60 leading-relaxed resize-y"
              />
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div
                className={`p-3 rounded-lg border flex items-center gap-2 text-xs font-mono ${
                  statusMessage.isError
                    ? 'bg-red-950/40 border-red-500/40 text-red-300'
                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {statusMessage.isError ? (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              {parsedCount !== null ? (
                <span className="text-emerald-400 font-mono font-semibold">
                  Active: {parsedCount} items loaded in engine
                </span>
              ) : (
                'Review payload and click apply to run in simulation engine'
              )}
            </span>

            <button
              onClick={handleApplyDataset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white shadow-md shadow-sky-950/50 cursor-pointer transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Apply Dataset to Simulation Engine</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
