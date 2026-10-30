/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';

/**
 * Generates and downloads an exhaustive, publication-quality Master Documentation PDF
 * containing the full application workload, complete configuration files,
 * simulation algorithms, AI normalcy architecture, VS Code extensions, and execution workflow.
 */
export function generateWorkflowPdf(): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 24) {
      drawFooter();
      doc.addPage();
      y = margin + 16;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('IEEE 802.11 WLAN Lab — Master Architecture, Workload & Developer Execution Manual', margin, 24);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(margin, 28, pageWidth - margin, 28);
    y = Math.max(y, 42);
  };

  const drawFooter = () => {
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
    doc.text(`Page ${pageNum}`, pageWidth - margin - 35, pageHeight - 12);
    doc.text('IEEE 802.11 WLAN Congestion & Scheduling Lab — Complete System Workload', margin, pageHeight - 12);
  };

  const addSectionTitle = (title: string, subtitle?: string) => {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(2, 132, 199); // sky-600
    doc.text(title, margin, y);
    y += 13;

    if (subtitle) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(subtitle, margin, y);
      y += 11;
    }

    doc.setDrawColor(2, 132, 199);
    doc.setLineWidth(1);
    doc.line(margin, y - 3, margin + 45, y - 3);
    y += 5;
  };

  const addParagraph = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85); // slate-700
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 10 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 10 + 4;
  };

  const addCodeSnippet = (title: string, code: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    checkPageBreak(30);
    doc.text(title, margin, y);
    y += 10;

    const rawLines = code.split('\n');
    const blockHeight = rawLines.length * 8.5 + 8;
    checkPageBreak(Math.min(blockHeight, 200));

    doc.setFillColor(15, 23, 42); // slate-900
    doc.setDrawColor(30, 41, 59);
    doc.roundedRect(margin, y, contentWidth, blockHeight, 3, 3, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(248, 250, 252); // slate-50

    let codeY = y + 7.5;
    for (const l of rawLines) {
      doc.text(l, margin + 6, codeY);
      codeY += 8.5;
    }

    y += blockHeight + 8;
  };

  // --- COVER / MASTER HEADER ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 68, 6, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('IEEE 802.11 WLAN Lab — Master System Workload Manual', margin + 14, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253); // sky-200
  doc.text('Complete Source Architecture, CSMA/CA Algorithms, Bianchi Validation, AI Normalcy & Local Workflow', margin + 14, y + 42);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleDateString()} | Target Stack: React 19 + Express + Vite 8 + Tailwind CSS v4 + TypeScript`, margin + 14, y + 56);

  y += 78;

  // --- SECTION 1: ARCHITECTURAL OVERVIEW & WORKLOAD SPECIFICATION ---
  addSectionTitle('1. System Architecture & Workload Specification', 'Comprehensive high-level blueprint of the full-stack wireless simulation laboratory');

  addParagraph(
    'The IEEE 802.11 WLAN Congestion & Scheduling Lab is a full-stack discrete-event simulation engine and comparative analysis workbench. It models high-density wireless LAN contention dynamics across the physical (PHY) and medium access control (MAC) layers, supporting IEEE 802.11a/g, 802.11n, 802.11ac, and 802.11ax standards with full 4-tier EDCA QoS queues, carrier sensing ranges, hidden terminal topologies, and bufferbloat active queue management.'
  );

  addParagraph(
    'The application combines a high-performance 60 FPS HTML5 Canvas radio arena with real-time empirical telemetry, mathematical Markov chain validation (Bianchi model), multi-policy traffic schedulers (Round Robin, Proportional Fair, DRR, and OFDMA Multi-User), and an autonomous closed-loop AI Normalcy Controller powered by Google Gemini 3.8 Flash with a deterministic analytical fallback engine.'
  );

  // --- SECTION 2: EXHAUSTIVE FILE-BY-FILE REPOSITORY WORKLOAD MAP ---
  addSectionTitle('2. Repository Workload Map & Source Directory Structure', 'Paste these exact files into your laptop VS Code workspace');

  const fullFileMap = [
    { file: 'index.html', desc: 'HTML5 entry point mounting Canvas, Plus Jakarta Sans, JetBrains Mono fonts & meta headers' },
    { file: 'package.json', desc: 'Dependencies: Express, @google/genai, React 19, Recharts, Vite 8, jsPDF, Lucide icons, tsx' },
    { file: 'server.ts', desc: 'Full-stack Express proxy hosting /api/ai-collision-predict & mounting Vite development middleware' },
    { file: 'tsconfig.json', desc: 'TypeScript configuration enforcing ES2022, bundler module resolution, and @/* path alias' },
    { file: 'vite.config.ts', desc: 'Vite 8 build configuration loading @tailwindcss/vite and @vitejs/plugin-react plugins' },
    { file: '.env.example / .env', desc: 'Environment variables specifying PORT=3000 and optional GEMINI_API_KEY secret' },
    { file: 'docs/WORKFLOW_MANUAL.html', desc: 'Standalone printable documentation manual with print CSS for saving to PDF' },
    { file: 'src/main.tsx', desc: 'React 19 client application mounting root element' },
    { file: 'src/App.tsx', desc: 'Central orchestrator: tab switching, 60 FPS simulation loop, toast alerts & audio triggers' },
    { file: 'src/index.css', desc: 'Global stylesheet with Tailwind CSS v4 setup (@import "tailwindcss";) & dark scrollbars' },
    { file: 'src/types/wlan.ts', desc: 'TypeScript definitions: EDCA queues, Bianchi metrics, AI predictions, Normalcy health reports' },
    { file: 'src/simulation/constants.ts', desc: 'IEEE 802.11 standards timing constants: SIFS, DIFS, slot times, and EDCA AC_VO/VI/BE/BK bounds' },
    { file: 'src/simulation/engine.ts', desc: 'Discrete-event simulation engine: CSMA/CA state machine, backoffs, collisions & normalcy controller' },
    { file: 'src/simulation/bianchi.ts', desc: 'Mathematical Markov chain analytical solver computing theoretical conditional collision probability p and throughput S' },
    { file: 'src/services/aiPredictionService.ts', desc: 'AI predictor client service: calls backend proxy with Markovian neural heuristic fallback' },
    { file: 'src/utils/audio.ts', desc: 'Web Audio API alert synthesizer generating warning and recovery audio tones (zero MP3 assets)' },
    { file: 'src/utils/pdfGenerator.ts', desc: 'Client-side jsPDF document generator creating publication-grade developer guide PDF downloads' },
    { file: 'src/components/AiPredictionModule.tsx', desc: 'AI Contention Collapse HUD, One-Click Normalcy Stabilization button & Autonomous Governor' },
    { file: 'src/components/NetworkCanvas.tsx', desc: '60 FPS Canvas RF arena rendering AP, stations, carrier sense ranges, and collision shockwaves' },
    { file: 'src/components/AirtimeTimeline.tsx', desc: 'Live airtime Gantt chart displaying DIFS, random backoff slots, DATA, SIFS, and ACK confirmation frames' },
    { file: 'src/components/MetricsDashboard.tsx', desc: 'Real-time performance metrics: throughput (Mbps), collision rate (%), queuing delay, and Jain\'s fairness' },
    { file: 'src/components/BianchiValidationChart.tsx', desc: 'Interactive Recharts curves comparing live simulation empirical data against Bianchi formulas' },
    { file: 'src/components/SchedulerComparison.tsx', desc: 'Comparative testbench for Round Robin, Proportional Fair, DRR, and 802.11ax OFDMA parallel scheduling' },
    { file: 'src/components/StationManagementView.tsx', desc: 'Station fleet table with individual MAC states, MCS rates, queue backlogs & bottleneck markers' },
    { file: 'src/components/SimulationControls.tsx', desc: 'Runtime controls for station count, CWmin, CWmax, RTS/CTS thresholds, and AQM queue modes' },
    { file: 'src/components/ScenarioPresets.tsx', desc: 'Scenario presets: Dense Auditorium, VoIP Prioritization, Hidden Terminals, Bufferbloat Testbench' },
    { file: 'src/components/Navbar.tsx', desc: 'Top navigation bar with simulation playback controls, alerts modal & Workflow PDF download' },
    { file: 'src/components/ToastContainer.tsx', desc: 'Floating toast alert stack for severe contention warnings and starvation notices' },
  ];

  fullFileMap.forEach((item) => {
    checkPageBreak(15);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 13, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(item.file, margin + 5, y + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(item.desc, margin + 180, y + 9);

    y += 15;
  });

  y += 8;

  // --- SECTION 3: KEY CONFIGURATION FILES CODE REFERENCE ---
  addSectionTitle('3. Core Configuration Files Reference', 'Exact contents for package.json, server.ts, vite.config.ts, tsconfig.json, and .env.example');

  addCodeSnippet(
    'package.json (Dependencies & Scripts)',
`{
  "name": "ieee-80211-wlan-lab",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build",
    "start": "tsx server.ts",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "jspdf": "^4.2.1",
    "lucide-react": "^0.546.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "recharts": "^3.10.1",
    "vite": "^8.3.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2"
  }
}`
  );

  addCodeSnippet(
    'tsconfig.json (TypeScript Compiler Setup)',
`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./*"] },
    "noEmit": true
  }
}`
  );

  addCodeSnippet(
    'vite.config.ts (Vite & Tailwind CSS v4 Configuration)',
`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  server: { port: 3000, host: '0.0.0.0' }
});`
  );

  addCodeSnippet(
    '.env.example / .env',
`# Port for development and production Express server
PORT=3000

# Optional: Google Gemini API Key for online LLM contention reasoning
# If omitted, the application uses its built-in analytical Markov engine
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"`
  );

  // --- SECTION 4: IEEE 802.11 SIMULATION ENGINE MECHANICS ---
  addSectionTitle('4. IEEE 802.11 MAC & PHY Simulation Mechanics', 'Mathematical and protocol details of the discrete-event wireless engine');

  addParagraph(
    'The simulation engine (src/simulation/engine.ts) models the Distributed Coordination Function (DCF) and Enhanced Distributed Channel Access (EDCA). When a station has packets queued for transmission, it performs Physical and Virtual Carrier Sensing (CSMA/CA):'
  );

  addParagraph(
    '1. Inter-Frame Spacing: The station listens to the medium. If idle for DIFS (or AIFS[AC] = SIFS + AIFSN[AC] * SlotTime), it initializes a backoff counter chosen uniformly in [0, CW]. If the channel becomes busy, the counter freezes and resumes only after DIFS/AIFS of idle channel time.'
  );

  addParagraph(
    '2. Contention Window Adaptation (BEB vs. Idle Sense): Under Standard Binary Exponential Backoff (BEB), CW doubles upon collision: CW = min(CWmax, 2 * (CW + 1) - 1). Upon successful ACK reception, CW abruptly resets to CWmin (15). This creates severe cyclic collision spikes. The engine provides Idle Sense as an alternative, adjusting CW additively and multiplicatively based on observed idle slots.'
  );

  addParagraph(
    '3. EDCA 4-Tier Access Categories: AC_VO (Voice, AIFSN=2, CWmin=3, CWmax=7, TXOP=1504µs), AC_VI (Video, AIFSN=2, CWmin=7, CWmax=15, TXOP=3008µs), AC_BE (Best Effort, AIFSN=3, CWmin=15, CWmax=1023), AC_BK (Background, AIFSN=7, CWmin=15, CWmax=1023).'
  );

  addParagraph(
    '4. Path Loss & SNR: Uses the log-distance path loss model: PL(d) = PL(d0) + 10 * gamma * log10(d / d0) + X_sigma. SNR determines the Adaptive Modulation and Coding Scheme (MCS), selecting physical rates from 12 Mbps up to 1201 Mbps (Wi-Fi 6 802.11ax).'
  );

  // --- SECTION 5: MATHEMATICAL BIANCHI MARKOV VALIDATION ---
  addSectionTitle('5. Mathematical Bianchi Markov Model Formulations', 'Formulas used in src/simulation/bianchi.ts to validate empirical simulation data');

  addParagraph(
    'G. Bianchi (2000) formulated the saturation throughput of 802.11 DCF using a 2-dimensional discrete-time Markov chain (s(t), b(t)), where s(t) is the backoff stage (0 to m) and b(t) is the backoff counter.'
  );

  addParagraph(
    '1. Stationary Transmission Probability (tau):'
  );
  addParagraph(
    '   tau = 2 * (1 - 2*p) / [ (1 - 2*p) * (W + 1) + p * W * (1 - (2*p)^m) ]'
  );
  addParagraph(
    'where W is the minimum contention window (CWmin + 1), m is the maximum backoff stage such that CWmax = 2^m * W, and p is the conditional collision probability.'
  );

  addParagraph(
    '2. Conditional Collision Probability (p):'
  );
  addParagraph(
    '   p = 1 - (1 - tau)^(n - 1)'
  );
  addParagraph(
    'where n is the number of contending stations in the BSS. The nonlinear system {tau(p), p(tau)} is solved numerically using fixed-point iteration.'
  );

  addParagraph(
    '3. Normalized Saturation Throughput (S):'
  );
  addParagraph(
    '   P_tr = 1 - (1 - tau)^n     (Probability of at least one transmission in a slot)'
  );
  addParagraph(
    '   P_s = (n * tau * (1 - tau)^(n - 1)) / P_tr     (Probability of successful transmission given a busy slot)'
  );
  addParagraph(
    '   S = (P_s * P_tr * E[Payload]) / [ (1 - P_tr) * sigma + P_tr * P_s * T_s + P_tr * (1 - P_s) * T_c ]'
  );
  addParagraph(
    'where sigma is the idle slot time (9µs), T_s is the duration of a successful transmission slot, and T_c is the duration of a collision slot.'
  );

  // --- SECTION 6: AI COLLISION PREDICTION & NORMALCY CONTROLLER ---
  addSectionTitle('6. AI Collision Prediction & Normalcy Controller', 'How the AI anticipates contention collapse and self-heals the wireless network');

  addParagraph(
    'The AI Prediction Module (src/components/AiPredictionModule.tsx, src/services/aiPredictionService.ts, and server.ts) acts as an intelligent network orchestrator:'
  );

  addParagraph(
    '1. Telemetry Ingestion: Continuously monitors station density (N), collision rate (%), throughput (Mbps), average queuing delay (ms), jitter, MAC algorithm, and spatial node distances (>35m).'
  );

  addParagraph(
    '2. Dual-Engine Intelligence: Sends telemetry to Gemini 3.8 Flash via POST /api/ai-collision-predict. If offline or no API key is provided, the local analytical Markovian engine calculates identical structured predictions and recommendations without external dependencies.'
  );

  addParagraph(
    '3. Contention Collapse Metrics: Outputs Contention Collapse Risk Score (0–100%), Risk Level (LOW, MODERATE, HIGH, CRITICAL), Projected Rate in 5s, Time-to-Saturation estimation, and Channel Entropy.'
  );

  addParagraph(
    '4. One-Click Normalcy Stabilization (applyNormalcyStabilization): Executes a coordinated 5-layer recovery: normalizes contention windows into [15, 63], enables adaptive RTS/CTS (500B threshold) for hidden terminals, activates CoDel AQM (5ms sojourn target), enables Wi-Fi 6 OFDMA parallel RUs if N >= 14, and re-orients stations into balanced concentric RF tiers.'
  );

  addParagraph(
    '5. Autonomous AI Governor: A closed-loop background daemon. When enabled, if channel health drops below 60% or collisions exceed 18%, it automatically applies recovery and logs interventions in the audit history.'
  );

  // --- SECTION 7: RECOMMENDED VS CODE EXTENSIONS ---
  addSectionTitle('7. Recommended VS Code Extensions', 'Install these in VS Code (Ctrl+Shift+X) for optimal development');

  const exts = [
    { name: 'ESLint', id: 'dbaeumer.vscode-eslint', desc: 'Real-time syntax linting and TypeScript code quality enforcement' },
    { name: 'Prettier', id: 'esbenp.prettier-vscode', desc: 'Automatic formatting for TSX, TS, CSS, and JSON files on save' },
    { name: 'Tailwind CSS IntelliSense', id: 'bradlc.vscode-tailwindcss', desc: 'Autocomplete, hover previews, and linting for Tailwind CSS classes' },
    { name: 'TypeScript Language Features', id: 'ms-vscode.vscode-typescript-next', desc: 'Enhanced TypeScript language server support and auto-imports' },
    { name: 'Pretty TypeScript Errors', id: 'yoavbls.pretty-ts-errors', desc: 'Converts complex nested TypeScript errors into readable formatting' },
    { name: 'DotENV', id: 'mikestead.dotenv', desc: 'Syntax highlighting and validation for .env and .env.example files' },
    { name: 'Auto Rename Tag', id: 'formulahendry.auto-rename-tag', desc: 'Synchronizes opening and closing JSX/HTML tags automatically' },
  ];

  exts.forEach((e) => {
    checkPageBreak(18);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 15, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(e.name, margin + 6, y + 7);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(2, 132, 199);
    doc.text(`ID: ${e.id}`, margin + 140, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(e.desc, margin + 6, y + 13);

    y += 18;
  });

  y += 6;

  // --- SECTION 8: STEP-BY-STEP TERMINAL EXECUTION WORKFLOW ---
  addSectionTitle('8. Step-by-Step Local Execution Workflow', 'Commands to run in terminal from initial setup to running app');

  const steps = [
    { step: '1. Prerequisites', cmd: 'node -v && npm -v', desc: 'Verify Node.js is version 20.x or 22.x.' },
    { step: '2. Workspace Setup', cmd: 'mkdir ieee-80211-wlan-lab && cd ieee-80211-wlan-lab && code .', desc: 'Create directory and open in VS Code.' },
    { step: '3. Environment Setup', cmd: 'cp .env.example .env', desc: 'Create .env file with PORT=3000 and optional GEMINI_API_KEY.' },
    { step: '4. Dependencies', cmd: 'npm install', desc: 'Install Express, React 19, Vite, Recharts, jsPDF, and TypeScript.' },
    { step: '5. Development Server', cmd: 'npm run dev', desc: 'Starts tsx server.ts (Express backend + Vite middleware on port 3000).' },
    { step: '6. Browser Access', cmd: 'http://localhost:3000', desc: 'Open web browser to interact with the simulation.' },
    { step: '7. Lint & Typecheck', cmd: 'npm run lint', desc: 'Runs tsc --noEmit (must pass with 0 errors).' },
    { step: '8. Production Build', cmd: 'npm run build && npm start', desc: 'Compiles frontend into dist/ and serves production backend.' },
  ];

  steps.forEach((s) => {
    checkPageBreak(24);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text(s.step, margin + 6, y + 8);

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(s.cmd, margin + 110, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(s.desc, margin + 6, y + 16);

    y += 24;
  });

  drawFooter();
  doc.save('IEEE-802.11-WLAN-Lab-Full-Workload-Manual.pdf');
}
