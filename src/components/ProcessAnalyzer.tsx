import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { FileSearch, FileText, Upload, X, AlertCircle, Loader2, CheckCircle2, Layers, Users, Download, FileSpreadsheet, Terminal, Copy, FileCode } from 'lucide-react';
import { cn } from '../lib/utils';
import { extractTextFromFile, analyzeProcessFromText } from '../services/geminiService';

const escapeXML = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const generateBPMNXML = (processName: string, steps: any[]) => {
  const lanes = [...new Set(steps.map((s: any) => s.lane))] as string[];
  const LANE_HEIGHT = 200, LANE_WIDTH = (steps.length + 3) * 200;
  const ACTIVITY_WIDTH = 120, ACTIVITY_HEIGHT = 80, GATEWAY_SIZE = 50, EVENT_SIZE = 36;
  const HORIZONTAL_SPACING = 200, START_X = 150;
  const laneYMap: Record<string, number> = {};
  lanes.forEach((lane, idx) => { laneYMap[lane] = idx * LANE_HEIGHT; });

  const getBPMNTag = (step: any) => {
    if (step.type === 'gateway') return 'bpmn:exclusiveGateway';
    switch (step.subType) {
      case 'send': return 'bpmn:sendTask'; case 'receive': return 'bpmn:receiveTask';
      case 'user': return 'bpmn:userTask'; case 'manual': return 'bpmn:manualTask';
      case 'service': return 'bpmn:serviceTask'; case 'businessRule': return 'bpmn:businessRuleTask';
      default: return 'bpmn:task';
    }
  };
  const getPrefix = (step: any) => step.type === 'gateway' ? 'Gateway' : 'Activity';

  const laneElements = lanes.map((lane, idx) => `
      <bpmn:lane id="Lane_${idx}" name="${escapeXML(lane)}">
        ${steps.filter((s: any) => s.lane === lane).map((s: any) => { const sIdx = steps.indexOf(s); return `<bpmn:flowNodeRef>${getPrefix(s)}_${sIdx}</bpmn:flowNodeRef>`; }).join('\n        ')}
        ${lane === steps[0].lane ? '<bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>' : ''}
        ${lane === steps[steps.length - 1].lane ? '<bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>' : ''}
      </bpmn:lane>`).join('');

  const flowNodes = steps.map((s: any, idx: number) => {
    const tag = getBPMNTag(s), id = `${getPrefix(s)}_${idx}`, name = escapeXML(s.name);
    const incoming = `<bpmn:incoming>Flow_${idx}</bpmn:incoming>`;
    const outgoing = s.type === 'gateway' ? `<bpmn:outgoing>Flow_${idx + 1}</bpmn:outgoing><bpmn:outgoing>Flow_${idx}_No</bpmn:outgoing>` : `<bpmn:outgoing>Flow_${idx + 1}</bpmn:outgoing>`;
    if (s.type === 'gateway') return `\n    <bpmn:exclusiveGateway id="${id}" name="${name}" gatewayDirection="Diverging">${incoming}${outgoing}</bpmn:exclusiveGateway>`;
    return `\n    <${tag} id="${id}" name="${name}">${incoming}${outgoing}</${tag}>`;
  }).join('');

  let sequences = steps.map((s: any, idx: number) => {
    const source = idx === 0 ? 'StartEvent_1' : `${getPrefix(steps[idx - 1])}_${idx - 1}`;
    const target = `${getPrefix(s)}_${idx}`;
    const nameAttr = idx > 0 && steps[idx - 1].type === 'gateway' ? ' name="Sí"' : '';
    return `<bpmn:sequenceFlow id="Flow_${idx}"${nameAttr} sourceRef="${source}" targetRef="${target}" />`;
  }).join('\n    ');
  steps.forEach((s: any, idx: number) => { if (s.type === 'gateway' && idx > 0) sequences += `\n    <bpmn:sequenceFlow id="Flow_${idx}_No" name="No" sourceRef="${getPrefix(s)}_${idx}" targetRef="${getPrefix(steps[idx - 1])}_${idx - 1}" />`; });
  sequences += `\n    <bpmn:sequenceFlow id="Flow_${steps.length}" sourceRef="${getPrefix(steps[steps.length - 1])}_${steps.length - 1}" targetRef="EndEvent_1" />`;

  let diShapes = `<bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true"><dc:Bounds x="50" y="0" width="${LANE_WIDTH + 100}" height="${lanes.length * LANE_HEIGHT}" /></bpmndi:BPMNShape>`;
  diShapes += lanes.map((_, idx) => `<bpmndi:BPMNShape id="Lane_${idx}_di" bpmnElement="Lane_${idx}" isHorizontal="true"><dc:Bounds x="80" y="${idx * LANE_HEIGHT}" width="${LANE_WIDTH + 70}" height="${LANE_HEIGHT}" /></bpmndi:BPMNShape>`).join('');
  diShapes += `<bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="120" y="${laneYMap[steps[0].lane] + LANE_HEIGHT / 2 - EVENT_SIZE / 2}" width="${EVENT_SIZE}" height="${EVENT_SIZE}" /></bpmndi:BPMNShape>`;
  diShapes += steps.map((s: any, idx: number) => { const x = START_X + idx * HORIZONTAL_SPACING, id = `${getPrefix(s)}_${idx}`; if (s.type === 'gateway') { const y = laneYMap[s.lane] + LANE_HEIGHT / 2 - GATEWAY_SIZE / 2; return `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}" isMarkerVisible="true"><dc:Bounds x="${x}" y="${y}" width="${GATEWAY_SIZE}" height="${GATEWAY_SIZE}" /></bpmndi:BPMNShape>`; } const y = laneYMap[s.lane] + LANE_HEIGHT / 2 - ACTIVITY_HEIGHT / 2; return `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="${x}" y="${y}" width="${ACTIVITY_WIDTH}" height="${ACTIVITY_HEIGHT}" /></bpmndi:BPMNShape>`; }).join('');
  diShapes += `<bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="${START_X + steps.length * HORIZONTAL_SPACING + 50}" y="${laneYMap[steps[steps.length - 1].lane] + LANE_HEIGHT / 2 - EVENT_SIZE / 2}" width="${EVENT_SIZE}" height="${EVENT_SIZE}" /></bpmndi:BPMNShape>`;

  let diEdges = steps.map((s: any, idx: number) => { const prev = steps[idx - 1]; const sourceX = idx === 0 ? 156 : START_X + (idx - 1) * HORIZONTAL_SPACING + (prev.type === 'gateway' ? GATEWAY_SIZE : ACTIVITY_WIDTH); const sourceY = idx === 0 ? laneYMap[steps[0].lane] + LANE_HEIGHT / 2 : laneYMap[prev.lane] + LANE_HEIGHT / 2; const targetX = START_X + idx * HORIZONTAL_SPACING; const targetY = laneYMap[s.lane] + LANE_HEIGHT / 2; return `<bpmndi:BPMNEdge id="Flow_${idx}_di" bpmnElement="Flow_${idx}"><di:waypoint x="${sourceX}" y="${sourceY}" /><di:waypoint x="${targetX}" y="${targetY}" /></bpmndi:BPMNEdge>`; }).join('');
  const last = steps[steps.length - 1];
  diEdges += `<bpmndi:BPMNEdge id="Flow_${steps.length}_di" bpmnElement="Flow_${steps.length}"><di:waypoint x="${START_X + (steps.length - 1) * HORIZONTAL_SPACING + (last.type === 'gateway' ? GATEWAY_SIZE : ACTIVITY_WIDTH)}" y="${laneYMap[last.lane] + LANE_HEIGHT / 2}" /><di:waypoint x="${START_X + steps.length * HORIZONTAL_SPACING + 50}" y="${laneYMap[last.lane] + LANE_HEIGHT / 2}" /></bpmndi:BPMNEdge>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1"><bpmn:participant id="Participant_1" name="${escapeXML(processName)}" processRef="Process_1" /></bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">${laneElements}</bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Inicio"><bpmn:outgoing>Flow_0</bpmn:outgoing></bpmn:startEvent>
    ${flowNodes}
    <bpmn:endEvent id="EndEvent_1" name="Fin"><bpmn:incoming>Flow_${steps.length}</bpmn:incoming></bpmn:endEvent>
    ${sequences}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">${diShapes}${diEdges}</bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });

const readFileAsText = (file: File): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsText(file); });

const ACCEPTED_MIME = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'application/xml', 'text/xml'];
type PAStatus = 'idle' | 'reading' | 'extracting' | 'analyzing' | 'done' | 'error';
const PA_STATUS_LABELS: Record<PAStatus, string> = { idle: '', reading: 'Leyendo archivo...', extracting: 'Extrayendo texto con IA...', analyzing: 'Analizando proceso con Gemini...', done: '', error: '' };

export const ProcessAnalyzer = () => {
  const [file, setFile]             = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus]         = useState<PAStatus>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const [result, setResult]         = useState<any>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<'basicos' | 'extendidos'>('extendidos');
  const fileInputRef                = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File) => {
    const isDrawio = f.name.endsWith('.drawio') || f.name.endsWith('.xml');
    if (!isDrawio && !ACCEPTED_MIME.some(m => f.type.startsWith(m.split('/')[0]) || f.type === m)) { setErrorMsg('Formato no soportado. Usa PDF, Word, TXT, Imagen o Draw.io.'); return; }
    setFile(f); setErrorMsg(''); setResult(null); setSelectedStepId(null);
  };

  const handleAnalyze = async () => {
    if (!file && !manualText.trim()) return;
    setStatus('idle'); setErrorMsg(''); setResult(null); setSelectedStepId(null);
    try {
      let extractedText = '';
      if (file) {
        setStatus('reading');
        if (file.type === 'text/plain' || file.name.endsWith('.drawio') || file.name.endsWith('.xml') || file.type === 'application/xml' || file.type === 'text/xml') { extractedText = await readFileAsText(file); }
        else if (file.type === 'application/pdf' || file.type.startsWith('image/')) { setStatus('extracting'); extractedText = await extractTextFromFile(await readFileAsBase64(file), file.type); }
        else { setStatus('extracting'); try { extractedText = await readFileAsText(file); } catch { throw new Error('Los archivos .docx requieren conversión previa a PDF o TXT.'); } }
      } else { extractedText = manualText; }
      if (!extractedText.trim()) throw new Error('No se pudo extraer texto del documento.');
      setStatus('analyzing');
      const parsed = await analyzeProcessFromText(extractedText);
      const steps = (parsed.steps || []).map((s: any, i: number) => ({ id: String(s.id || i + 1), lane: s.lane || 'General', name: s.name || `Paso ${i + 1}`, type: s.type || 'task', subType: s.subType || 'user', description: s.description || '', performers: s.performers || '', accountable: s.accountable || '', consulted: s.consulted || '', informed: s.informed || '' }));
      setResult({ ...parsed, steps }); setStatus('done');
    } catch (err: any) { console.error(err); setErrorMsg(err?.message || 'Error al analizar el proceso.'); setStatus('error'); }
  };

  const downloadBPMN = () => {
    if (!result?.steps?.length) return;
    const xml = generateBPMNXML(result.bizagiBasics?.name || result.name, result.steps);
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
    const a = document.createElement('a'); a.href = url; a.download = `${result.code || 'proceso'}.bpmn`; a.click(); URL.revokeObjectURL(url);
  };

  const copyBPMN = () => { if (result?.steps?.length) navigator.clipboard.writeText(generateBPMNXML(result.bizagiBasics?.name || result.name, result.steps)); };

  const exportToExcel = () => {
    if (!result) return;
    const wb = XLSX.utils.book_new();
    if (result.bizagiBasics || result.bizagiExtended) {
      const data = [
        { Atributo: 'Nombre', Valor: result.bizagiBasics?.name || '' }, { Atributo: 'Descripción', Valor: result.bizagiBasics?.description || '' },
        { Atributo: 'Versión', Valor: result.bizagiBasics?.version || '' }, { Atributo: 'Autor', Valor: result.bizagiBasics?.author || '' },
        { Atributo: 'Objetivo', Valor: result.bizagiExtended?.objective || '' }, { Atributo: 'Alcance', Valor: result.bizagiExtended?.scope || '' },
        { Atributo: 'Dueño de Proceso', Valor: result.bizagiExtended?.processOwner || '' },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Atributos Bizagi');
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.steps.map((s: any) => ({ 'ID': s.id, 'Rol': s.lane, 'Actividad': s.name, 'Tipo': s.type, 'Subtipo': s.subType, 'Descripción': s.description }))), 'Flujo de Proceso');
    if (result.indicators?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.indicators.map((k: any) => ({ 'Indicador': k.name, 'Meta': k.goal, 'Frecuencia': k.frequency, 'Fuente': k.source }))), 'Indicadores KPI');
    if (result.riskMatrix?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.riskMatrix.map((r: any) => ({ 'Riesgo': r.risk, 'Impacto': r.impact, 'Probabilidad': r.probability, 'Mitigación': r.mitigation }))), 'Matriz de Riesgos');
    XLSX.writeFile(wb, `${result.code || 'analisis'}.xlsx`);
  };

  const isLoading = ['reading', 'extracting', 'analyzing'].includes(status);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-8 h-8 bg-blue-600/15 border border-blue-500/20 rounded-xl flex items-center justify-center"><FileSearch className="w-4 h-4 text-blue-400" /></div>
          <h1 className="text-[22px] font-semibold text-slate-900 dark:text-white tracking-tight">Analizador de Procesos Externos</h1>
        </div>
        <p className="text-[13px] text-slate-900/35 dark:text-white/35 ml-11">Sube un PDF, Word, Imagen o archivo Draw.io y obtén el diagrama BPMN listo para importar en Bizagi</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left panel */}
        <div className={cn('space-y-4', result ? 'xl:col-span-3' : 'xl:col-span-4')}>
          <div className="glass-panel p-6">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-900/25 dark:text-white/25 mb-4">Entrada de datos</p>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,image/*,.drawio,.xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) acceptFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn('relative flex flex-col items-center justify-center gap-3 py-8 px-4 border border-dashed rounded-xl cursor-pointer transition-all duration-150',
                isDragging ? 'border-blue-500/50 bg-blue-500/[0.06]' : file ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.15] dark:border-white/[0.15] hover:bg-black/[0.02] dark:bg-white/[0.02]')}>
              {file ? (
                <>
                  <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center"><FileText className="w-5 h-5 text-emerald-400" /></div>
                  <div className="text-center"><p className="text-[13px] font-medium text-slate-900/70 dark:text-white/70 truncate max-w-[180px]">{file.name}</p><p className="text-[10px] text-slate-900/25 dark:text-white/25 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p></div>
                  <button onClick={e => { e.stopPropagation(); setFile(null); setResult(null); setStatus('idle'); }} className="absolute top-2 right-2 w-6 h-6 rounded-md bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] flex items-center justify-center text-slate-900/30 dark:text-white/30 hover:text-slate-900/60 dark:text-white/60 transition-all"><X className="w-3 h-3" /></button>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-center"><Upload className="w-5 h-5 text-slate-900/25 dark:text-white/25" /></div>
                  <div className="text-center"><p className="text-[13px] font-medium text-slate-900/45 dark:text-white/45">{isDragging ? '¡Suéltalo aquí!' : 'Arrastra o haz clic'}</p><p className="text-[10px] text-slate-900/20 dark:text-white/20 mt-0.5 tracking-wide uppercase">PDF · Word · TXT · Imagen · Draw.io</p></div>
                </>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-medium text-slate-900/20 dark:text-white/20 mb-2 uppercase tracking-widest">O describe el proceso manualmente</p>
              <textarea value={manualText} onChange={e => setManualText(e.target.value)} disabled={!!file} placeholder="Describe el proceso paso a paso..."
                className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.07] dark:border-white/[0.07] rounded-xl p-3 text-[12.5px] text-slate-900/70 dark:text-white/70 placeholder:text-slate-900/15 dark:text-white/15 focus:outline-none focus:border-blue-500/30 resize-none h-28 transition-all disabled:opacity-30 disabled:cursor-not-allowed" />
            </div>
            {status === 'error' && <div className="mt-3 flex items-start gap-2.5 bg-red-500/[0.06] border border-red-500/10 rounded-xl p-3"><AlertCircle className="w-3.5 h-3.5 text-red-400/70 shrink-0 mt-0.5" /><p className="text-[11.5px] text-red-400/70 leading-relaxed">{errorMsg}</p></div>}
            <button onClick={handleAnalyze} disabled={isLoading || (!file && !manualText.trim())}
              className="mt-4 w-full h-11 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 dark:text-white text-[11px] font-semibold tracking-[0.08em] uppercase rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.99]">
              {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />{PA_STATUS_LABELS[status]}</>) : (<><FileSearch className="w-4 h-4" />Analizar con IA</>)}
            </button>
          </div>
          <AnimatePresence>
            {status === 'done' && result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-panel p-5 border-l-2 border-emerald-500">
                <div className="flex items-center gap-2 mb-3"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[10px] font-bold tracking-[0.12em] uppercase text-emerald-400">Análisis completado</span></div>
                <div className="space-y-1.5">
                  {[{ l: 'Actividades', v: result.steps?.length ?? 0 }, { l: 'Roles detectados', v: new Set(result.steps?.map((s: any) => s.lane) ?? []).size }, { l: 'KPIs generados', v: result.indicators?.length ?? 0 }, { l: 'Riesgos identificados', v: result.riskMatrix?.length ?? 0 }].map(({ l, v }) => (
                    <div key={l} className="flex justify-between items-center"><span className="text-[11.5px] text-slate-900/35 dark:text-white/35">{l}</span><span className="text-[12px] font-semibold text-slate-900/75 dark:text-white/75">{v}</span></div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center & Right panels */}
        {!result && !isLoading && (
          <div className="xl:col-span-8">
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass-panel">
              <div className="w-14 h-14 border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl flex items-center justify-center mb-4"><FileCode className="w-6 h-6 text-slate-900/10 dark:text-white/10" /></div>
              <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-slate-900/15 dark:text-white/15">Sube un archivo para comenzar</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="xl:col-span-8">
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass-panel gap-4">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[12px] font-medium text-blue-400/70 animate-pulse">{PA_STATUS_LABELS[status]}</p>
            </div>
          </div>
        )}

        {result && status === 'done' && (
          <>
            {/* Center */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="xl:col-span-5 space-y-4">
              <div className="glass-panel p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="text-[9px] font-bold tracking-[0.18em] uppercase text-blue-400/60 mb-1.5">Proceso detectado</div>
                    <h2 className="text-[18px] font-semibold text-slate-900 dark:text-white tracking-tight leading-tight mb-1">{result.bizagiBasics?.name || result.name}</h2>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-900/30 dark:text-white/30"><Layers className="w-3 h-3" />{result.code || 'N/A'}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-900/30 dark:text-white/30"><Users className="w-3 h-3" />{new Set(result.steps?.map((s: any) => s.lane)).size} roles</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button onClick={downloadBPMN} className="flex items-center gap-1.5 h-8 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all"><Download className="w-3 h-3" /> .BPMN</button>
                    <button onClick={exportToExcel} className="flex items-center gap-1.5 h-8 px-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-all"><FileSpreadsheet className="w-3 h-3" /> Excel</button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {result.steps?.map((step: any, idx: number) => (
                    <div key={step.id} onClick={() => setSelectedStepId(selectedStepId === step.id ? null : step.id)}
                      className={cn('flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group', selectedStepId === step.id ? 'bg-blue-500/[0.08] border-blue-500/25' : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.05] dark:border-white/[0.05] hover:border-black/[0.1] dark:border-white/[0.1]')}>
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0', step.type === 'gateway' ? 'bg-amber-500/15 text-amber-400' : selectedStepId === step.id ? 'bg-blue-500/20 text-blue-400' : 'bg-black/[0.04] dark:bg-white/[0.04] text-slate-900/25 dark:text-white/25 group-hover:text-slate-900/50 dark:text-white/50')}>{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9.5px] font-semibold text-blue-400/60 uppercase tracking-wider mb-0.5 truncate">{step.lane}</div>
                        <div className="text-[12.5px] text-slate-900/70 dark:text-white/70 truncate">{step.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-blue-400/60" /><span className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-slate-900/25 dark:text-white/25">BPMN XML Preview</span></div>
                  <button onClick={copyBPMN} className="flex items-center gap-1.5 h-7 px-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[9.5px] font-medium text-blue-400 hover:bg-blue-500/20 transition-all"><Copy className="w-3 h-3" /> Copiar</button>
                </div>
                <pre className="text-[10px] text-slate-900/30 dark:text-white/30 font-mono leading-relaxed overflow-x-auto max-h-40 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-xl p-4">
                  {generateBPMNXML(result.bizagiBasics?.name || result.name, result.steps).slice(0, 800)}...
                </pre>
              </div>
            </motion.div>

            {/* Right: Bizagi metadata tabs */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="xl:col-span-4">
              <div className="glass-panel p-0 overflow-hidden flex flex-col h-[calc(100vh-120px)] sticky top-6">
                <div className="flex border-b border-black/[0.05] dark:border-white/[0.05]">
                  {(['basicos', 'extendidos'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={cn('flex-1 py-3.5 text-[10px] font-bold tracking-[0.15em] uppercase transition-all', activeTab === tab ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/[0.03]' : 'text-slate-900/30 dark:text-white/30 hover:text-slate-900/50 dark:text-white/50 hover:bg-black/[0.02] dark:bg-white/[0.02]')}>
                      {tab === 'basicos' ? 'Básicos' : 'Extendidos'}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {activeTab === 'basicos' && (
                    <div className="space-y-4">
                      <div className="border border-blue-500/20 bg-blue-500/[0.02] rounded-xl p-4"><p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3">Atributos del Proceso</p>
                        {[['Nombre', result.bizagiBasics?.name || result.name], ['Descripción', result.bizagiBasics?.description], ['Versión', result.bizagiBasics?.version], ['Autor', result.bizagiBasics?.author]].map(([label, value]) => (
                          <div key={label as string} className="mb-3"><p className="text-[9px] text-slate-900/30 dark:text-white/30 uppercase tracking-wider mb-0.5">{label}</p><p className="text-[12px] text-slate-900/70 dark:text-white/70">{value || '-'}</p></div>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeTab === 'extendidos' && (
                    <div className="space-y-6">
                      {[
                        ['1. Objetivo', result.bizagiExtended?.objective || result.objective],
                        ['2. Alcance', result.bizagiExtended?.scope],
                        ['4. Responsable del Proceso', result.bizagiExtended?.processOwner],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <p className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-slate-900/30 dark:text-white/30 mb-2">{label}</p>
                          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl p-3.5"><p className="text-[12px] text-slate-900/70 dark:text-white/70 leading-relaxed">{value || '-'}</p></div>
                        </div>
                      ))}
                      {/* KPIs */}
                      <div>
                        <p className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-slate-900/30 dark:text-white/30 mb-2">6. Indicadores KPI</p>
                        {result.indicators?.length > 0 ? (
                          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl overflow-hidden">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05]"><tr><th className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">Indicador</th><th className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">Meta</th><th className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">Frec.</th></tr></thead>
                              <tbody className="divide-y divide-white/[0.02]">
                                {result.indicators.map((k: any, i: number) => (<tr key={i}><td className="p-2.5 text-slate-900/70 dark:text-white/70">{k.name}</td><td className="p-2.5 text-emerald-400/70">{k.goal}</td><td className="p-2.5 text-slate-900/50 dark:text-white/50">{k.frequency}</td></tr>))}
                              </tbody>
                            </table>
                          </div>
                        ) : <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl p-3.5"><p className="text-[12px] text-slate-900/40 dark:text-white/40 italic">No se detectaron indicadores.</p></div>}
                      </div>
                      {/* Risks */}
                      <div>
                        <p className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-slate-900/30 dark:text-white/30 mb-2">7. Matriz de Riesgos</p>
                        {result.riskMatrix?.length > 0 ? (
                          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl overflow-hidden">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05]"><tr><th className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">Riesgo</th><th className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">Imp.</th><th className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">Prob.</th></tr></thead>
                              <tbody className="divide-y divide-white/[0.02]">
                                {result.riskMatrix.map((r: any, i: number) => (<tr key={i}><td className="p-2.5 text-slate-900/70 dark:text-white/70">{r.risk}</td><td className={cn('p-2.5', r.impact === 'Alto' ? 'text-red-400/70' : r.impact === 'Medio' ? 'text-amber-400/70' : 'text-emerald-400/70')}>{r.impact}</td><td className="p-2.5 text-slate-900/50 dark:text-white/50">{r.probability}</td></tr>))}
                              </tbody>
                            </table>
                          </div>
                        ) : <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl p-3.5"><p className="text-[12px] text-slate-900/40 dark:text-white/40 italic">No se detectó matriz de riesgos.</p></div>}
                      </div>
                      {/* SIPOC */}
                      {result.sipocMatrix?.length > 0 && (
                        <div>
                          <p className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-slate-900/30 dark:text-white/30 mb-2">9. Matriz SIPOC</p>
                          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl overflow-hidden overflow-x-auto">
                            <table className="w-full text-left text-[11px] min-w-[400px]">
                              <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05]"><tr>{['Proveedor', 'Entrada', 'Proceso', 'Salida', 'Cliente'].map(h => <th key={h} className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">{h}</th>)}</tr></thead>
                              <tbody className="divide-y divide-white/[0.02]">
                                {result.sipocMatrix.map((s: any, i: number) => (<tr key={i}><td className="p-2.5 text-slate-900/70 dark:text-white/70">{s.supplier}</td><td className="p-2.5 text-slate-900/60 dark:text-white/60">{s.input}</td><td className="p-2.5 text-slate-900/60 dark:text-white/60">{s.process}</td><td className="p-2.5 text-slate-900/60 dark:text-white/60">{s.output}</td><td className="p-2.5 text-slate-900/70 dark:text-white/70">{s.customer}</td></tr>))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {/* RACI */}
                      {result.raciMatrix?.length > 0 && (
                        <div>
                          <p className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-slate-900/30 dark:text-white/30 mb-2">12. RACI</p>
                          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl overflow-hidden">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05]"><tr>{['Actividad', 'R', 'A', 'C/I'].map(h => <th key={h} className="p-2.5 font-medium text-slate-900/40 dark:text-white/40">{h}</th>)}</tr></thead>
                              <tbody className="divide-y divide-white/[0.02]">
                                {result.raciMatrix.map((r: any, i: number) => (<tr key={i}><td className="p-2.5 text-slate-900/70 dark:text-white/70">{r.exec}</td><td className="p-2.5 text-slate-900/60 dark:text-white/60">{r.resp}</td><td className="p-2.5 text-slate-900/60 dark:text-white/60">{r.cons}</td><td className="p-2.5 text-slate-900/60 dark:text-white/60">{r.info}</td></tr>))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};
