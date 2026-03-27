import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../utils/api';

export default function Scenarios({ activeWorkspaceId }) {
    const [scenarios, setScenarios] = useState([]);
    const [requests, setRequests] = useState([]);
    const [mocks, setMocks] = useState([]);
    const [folders, setFolders] = useState([]);
    const [variablesList, setVariablesList] = useState([]);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    const [currentScenario, setCurrentScenario] = useState({ 
        id: null, name: 'New Scenario', testType: 'api_flow', 
        perfConfig: { vus: 10, spawnRate: 2, duration: 15 }, 
        nodes: [], edges: [] 
    });
    
    const [librarySearch, setLibrarySearch] = useState('');
    const [logs, setLogs] = useState([]);
    const [logsOpen, setLogsOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    
    const [expandedLibraryFolders, setExpandedLibraryFolders] = useState({});

    // Running States
    const [isRunning, setIsRunning] = useState(false);
    const abortRef = useRef(false);
    const perfLogsRef = useRef([]);
    const perfNodesRef = useRef({});

    // Modal & Report States
    const [showNewModal, setShowNewModal] = useState(false);
    const [newScenarioName, setNewScenarioName] = useState('New Scenario');
    const [newScenarioType, setNewScenarioType] = useState('api_flow');
    
    const [perfReport, setPerfReport] = useState(null);
    const [apiFlowReport, setApiFlowReport] = useState(null);
    
    // Expandable states for reports
    const [expandedPerfNode, setExpandedPerfNode] = useState(null);
    const [expandedPerfDetail, setExpandedPerfDetail] = useState(null);
    const [expandedFlowItem, setExpandedFlowItem] = useState(null);

    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

    const showAlert = (message, type = 'info', title = '') => setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info') });

    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const scaledContainerRef = useRef(null); 
    const scenarioRef = useRef(currentScenario); 

    useEffect(() => { scenarioRef.current = currentScenario; }, [currentScenario]);

    useEffect(() => {
        if (activeWorkspaceId) {
            loadLibraryData();
            loadScenarios();
        }
    }, [activeWorkspaceId]);

    const loadLibraryData = async () => {
        try {
            const [reqs, fs, ms, vars] = await Promise.all([
                ApiService.getRequests(activeWorkspaceId), ApiService.getFolders(activeWorkspaceId),
                ApiService.getMocks(activeWorkspaceId), ApiService.getVariables(activeWorkspaceId)
            ]);
            setRequests(reqs); setFolders(fs); setMocks(ms); setVariablesList(vars);
        } catch (e) { console.error(e); }
    };

    const loadScenarios = async () => {
        try {
            const list = await ApiService.getScenarios(activeWorkspaceId);
            setScenarios(list);
            if (list.length > 0 && !currentScenario.id) handleLoadScenario(list[0]);
        } catch (e) { console.error(e); }
    };

    const handleLoadScenario = (s) => {
        let parsed = { type: 'api_flow', config: { vus: 10, spawnRate: 2, duration: 15 }, nodes: [], edges: [] };
        try {
            if (typeof s.nodes === 'string') {
                const d = JSON.parse(s.nodes);
                if (Array.isArray(d)) { parsed.nodes = d; parsed.edges = []; } else { parsed = d; }
            } else { parsed = s.nodes; }
        } catch(e) {}

        const nodes = parsed.nodes || [];
        nodes.forEach((n, i) => { if (n.x === undefined) n.x = 50; if (n.y === undefined) n.y = 50 + (i * 150); });

        setCurrentScenario({ 
            id: s.id, name: s.name, 
            testType: parsed.type || 'api_flow',
            perfConfig: parsed.config || { vus: 10, spawnRate: 2, duration: 15 },
            nodes, edges: parsed.edges || [] 
        });
        setSidebarOpen(false); setLogsOpen(false); setIsRunning(false); abortRef.current = false;
        setConnectState(null); // Reset connection state when loading
    };

    const initiateNewScenario = () => {
        setNewScenarioName('New Scenario');
        setNewScenarioType('api_flow');
        setShowNewModal(true);
        setSidebarOpen(false);
    };

    const executeCreateNewScenario = () => {
        setCurrentScenario({ 
            id: null, name: newScenarioName, testType: newScenarioType, 
            perfConfig: { vus: 10, spawnRate: 2, duration: 15 }, 
            nodes: [], edges: [] 
        });
        setShowNewModal(false); setLogsOpen(false); setIsRunning(false); abortRef.current = false;
        setConnectState(null);
    };

    const handleAddNode = (type, item, folderName = null) => {
        const offset = currentScenario.nodes.length * 20;
        setCurrentScenario(prev => ({
            ...prev, nodes: [...prev.nodes, { id: 'node_' + Date.now() + '_' + Math.floor(Math.random() * 1000), type, refId: item.id, name: item.name, method: item.method, folderName, iterations: 1, delay: 0, x: 100 + offset, y: 100 + offset }]
        }));
    };

    const handleSave = async () => {
        if (!activeWorkspaceId) return;
        try {
            const payload = { 
                id: currentScenario.id, name: currentScenario.name || 'New Scenario', 
                nodes: { type: currentScenario.testType, config: currentScenario.perfConfig, nodes: currentScenario.nodes, edges: currentScenario.edges } 
            };
            const result = await ApiService.saveScenario(activeWorkspaceId, payload);
            setCurrentScenario(prev => ({ ...prev, id: prev.id || result.id }));
            loadScenarios();
            showAlert('Scenario saved successfully', 'success');
        } catch (err) { showAlert(err.message, 'error'); }
    };

    const handleDeleteTrigger = () => {
        if (!currentScenario.id) return;
        setConfirmConfig({ isOpen: true, message: 'Are you sure you want to delete this scenario?', onConfirm: executeDeleteScenario });
    };

    const executeDeleteScenario = async () => {
        try {
            await ApiService.deleteScenario(activeWorkspaceId, currentScenario.id);
            setCurrentScenario({ id: null, name: 'New Scenario', testType: 'api_flow', perfConfig: { vus: 10, spawnRate: 2, duration: 15 }, nodes: [], edges: [] });
            loadScenarios();
            showAlert('Scenario deleted', 'success');
        } catch (err) { showAlert(err.message, 'error'); }
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    const handleNodeChange = (id, field, value) => {
        setCurrentScenario(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === id ? { ...n, [field]: value } : n) }));
    };

    const handleConfigChange = (field, value) => {
        setCurrentScenario(prev => ({ ...prev, perfConfig: { ...prev.perfConfig, [field]: value } }));
    };

    const removeNode = (id) => {
        setCurrentScenario(prev => ({ ...prev, nodes: prev.nodes.filter(n => n.id !== id), edges: prev.edges.filter(e => e.source !== id && e.target !== id) }));
        setConnectState(null); 
    };

    const removeEdgeTrigger = (id) => {
        setConfirmConfig({ isOpen: true, message: 'Delete this connection?', onConfirm: () => executeRemoveEdge(id) });
    };

    const executeRemoveEdge = (id) => {
        setCurrentScenario(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== id) }));
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    const [dragState, setDragState] = useState({ active: false, nodeId: null, startX: 0, startY: 0, nStartX: 0, nStartY: 0 });
    const [connectState, setConnectState] = useState(null);

    const handleHandleClick = (e, nodeId, handleId) => {
        e.stopPropagation(); 
        if (!connectState) {
            setConnectState({ nodeId, handleId });
        } else {
            if (connectState.nodeId !== nodeId) {
                const exists = currentScenario.edges.find(edge => (edge.source === connectState.nodeId && edge.target === nodeId) || (edge.target === connectState.nodeId && edge.source === nodeId));
                if (!exists) {
                    setCurrentScenario(prev => ({ ...prev, edges: [...prev.edges, { id: 'edge_' + Date.now(), source: connectState.nodeId, sourceHandle: connectState.handleId, target: nodeId, targetHandle: handleId }] }));
                }
            }
            setConnectState(null);
        }
    };

    const startDrag = (e, node) => {
        if (e.target.closest('button')) return;
        e.target.setPointerCapture(e.pointerId);
        setDragState({ active: true, nodeId: node.id, startX: e.clientX, startY: e.clientY, nStartX: node.x, nStartY: node.y });
    };

    const handlePointerMove = (e) => {
        if (!dragState.active || dragState.nodeId !== e.currentTarget.dataset.id) return;
        const dx = (e.clientX - dragState.startX) / zoom;
        const dy = (e.clientY - dragState.startY) / zoom;
        const newX = Math.max(0, dragState.nStartX + dx);
        const newY = Math.max(0, dragState.nStartY + dy);
        setCurrentScenario(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === dragState.nodeId ? { ...n, x: newX, y: newY } : n) }));
    };

    const handlePointerUp = (e) => {
        e.target.releasePointerCapture(e.pointerId);
        setDragState({ active: false, nodeId: null, startX: 0, startY: 0, nStartX: 0, nStartY: 0 });
    };

    const drawLines = () => {
        if (!svgRef.current || !scaledContainerRef.current) return;
        const svg = svgRef.current; const scaledContainer = scaledContainerRef.current; svg.innerHTML = '';
        const scaledRect = scaledContainer.getBoundingClientRect();

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        // Membuat 4 panah berbeda agar warnanya dinamis mengikuti state garis. refX="9" menjamin panah menutup rapi garisnya
        defs.innerHTML = `
            <marker id="arrow-default" viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 -5 L 10 0 L 0 5 z" fill="#94a3b8" /></marker>
            <marker id="arrow-running" viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 -5 L 10 0 L 0 5 z" fill="#3b82f6" /></marker>
            <marker id="arrow-success" viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 -5 L 10 0 L 0 5 z" fill="#10b981" /></marker>
            <marker id="arrow-error" viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 -5 L 10 0 L 0 5 z" fill="#ef4444" /></marker>
        `;
        svg.appendChild(defs);

        const edgesToDraw = scenarioRef.current ? scenarioRef.current.edges : currentScenario.edges;

        edgesToDraw.forEach((edge) => {
            const sourceHandle = document.querySelector(`.node-handle[data-node="${edge.source}"][data-handle="${edge.sourceHandle}"]`);
            const targetHandle = document.querySelector(`.node-handle[data-node="${edge.target}"][data-handle="${edge.targetHandle}"]`);
            if (!sourceHandle || !targetHandle) return;

            const rect1 = sourceHandle.getBoundingClientRect(); 
            const rect2 = targetHandle.getBoundingClientRect();
            
            let x1 = ((rect1.left + rect1.width / 2) - scaledRect.left) / zoom;
            let y1 = ((rect1.top + rect1.height / 2) - scaledRect.top) / zoom;
            let x2 = ((rect2.left + rect2.width / 2) - scaledRect.left) / zoom;
            let y2 = ((rect2.top + rect2.height / 2) - scaledRect.top) / zoom;

            // KALKULASI OFFSET - Menggeser titik awal & akhir agar menjauh dari kotak node
            const offsetDist = 8; // Menghentikan garis 8px sebelum masuk ke area node
            if (edge.sourceHandle === 'right') x1 += offsetDist;
            if (edge.sourceHandle === 'left') x1 -= offsetDist;
            if (edge.sourceHandle === 'top') y1 -= offsetDist;
            if (edge.sourceHandle === 'bottom') y1 += offsetDist;

            if (edge.targetHandle === 'right') x2 += offsetDist;
            if (edge.targetHandle === 'left') x2 -= offsetDist;
            if (edge.targetHandle === 'top') y2 -= offsetDist;
            if (edge.targetHandle === 'bottom') y2 += offsetDist;

            let cx1 = x1, cy1 = y1, cx2 = x2, cy2 = y2;
            const bezierOffset = 50;
            if (edge.sourceHandle === 'right') cx1 += bezierOffset; 
            if (edge.sourceHandle === 'left') cx1 -= bezierOffset;
            if (edge.sourceHandle === 'top') cy1 -= bezierOffset; 
            if (edge.sourceHandle === 'bottom') cy1 += bezierOffset;
            
            if (edge.targetHandle === 'right') cx2 += bezierOffset; 
            if (edge.targetHandle === 'left') cx2 -= bezierOffset;
            if (edge.targetHandle === 'top') cy2 -= bezierOffset; 
            if (edge.targetHandle === 'bottom') cy2 += bezierOffset;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
            
            // Pewarnaan garis dan pemasangan marker (panah) yang senada warnanya
            if (edge.runtimeStatus === 'running') {
                path.setAttribute('stroke', '#3b82f6');
                path.setAttribute('stroke-width', '3'); 
                path.setAttribute('stroke-dasharray', '8');
                path.style.animation = 'flowDash 0.8s linear infinite';
                path.setAttribute('marker-end', 'url(#arrow-running)');
            } else if (edge.runtimeStatus === 'error') {
                path.setAttribute('stroke', '#ef4444');
                path.setAttribute('stroke-width', '3'); 
                path.style.animation = 'none';
                path.setAttribute('marker-end', 'url(#arrow-error)');
            } else if (edge.runtimeStatus === 'success') {
                path.setAttribute('stroke', '#10b981');
                path.setAttribute('stroke-width', '3'); 
                path.style.animation = 'none';
                path.setAttribute('marker-end', 'url(#arrow-success)');
            } else {
                path.setAttribute('stroke', '#94a3b8'); 
                path.setAttribute('stroke-width', '3'); 
                path.style.animation = 'none';
                path.setAttribute('marker-end', 'url(#arrow-default)');
            }
            
            path.setAttribute('fill', 'none'); 
            path.classList.add('flow-line');

            // Garis tebal tersembunyi untuk area klik (menghapus edge)
            const clickPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            clickPath.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
            clickPath.setAttribute('stroke', 'transparent'); clickPath.setAttribute('stroke-width', '25'); clickPath.setAttribute('fill', 'none'); clickPath.classList.add('edge-delete', 'cursor-pointer');
            clickPath.addEventListener('click', () => removeEdgeTrigger(edge.id));

            svg.appendChild(path); svg.appendChild(clickPath);
        });
    };

    useEffect(() => {
        const raf = requestAnimationFrame(() => drawLines());
        return () => cancelAnimationFrame(raf);
    }, [currentScenario.edges, currentScenario.nodes, zoom, connectState]);

    useEffect(() => {
        window.addEventListener('resize', drawLines);
        return () => window.removeEventListener('resize', drawLines);
    }, []);

    const appendLog = (msg, type = 'info') => setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);

    const runScript = async (scriptCode, context) => {
        if (!scriptCode || scriptCode.trim() === '') return context;
        try {
            const func = new Function('request', 'response', 'variables', scriptCode);
            func(context.request, context.response, context.variables);
        } catch (e) { console.error('Script error:', e); }
        return context;
    };

    const formatPayload = (data) => {
        if (!data) return 'N/A';
        if (typeof data === 'object') return JSON.stringify(data, null, 2);
        try { return JSON.stringify(JSON.parse(data), null, 2); } catch(e) { return data; }
    };

    // =====================================
    // EKSPOR KE EXCEL HELPER (Native HTML XLS)
    // =====================================
    const exportHTMLToExcel = (title, date, tableHTML, filename) => {
        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8" />
                <style>
                    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
                    th { background-color: #f2f2f2; text-align: left; padding: 8px; }
                    td { padding: 8px; }
                </style>
            </head>
            <body>
                <h2>${title}</h2>
                <p><strong>Date:</strong> ${date}</p>
                <br/>
                ${tableHTML}
            </body>
            </html>
        `;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.xls';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportApiFlowToExcel = () => {
        if (!apiFlowReport) return;
        const title = `API Flow Test Report - ${currentScenario.name}`;
        const date = new Date().toLocaleString();
        
        let tableHTML = `
            <table border="1">
                <tr>
                    <th>Step</th>
                    <th>Method</th>
                    <th>Endpoint Name</th>
                    <th>Status</th>
                    <th>Response Time (ms)</th>
                </tr>`;
            
        apiFlowReport.forEach((item, index) => {
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.method}</td>
                    <td>${item.name}</td>
                    <td>${item.status}</td>
                    <td>${item.time}</td>
                </tr>`;
        });
        tableHTML += `</table>`;
        
        exportHTMLToExcel(title, date, tableHTML, `APIFlowReport_${currentScenario.name.replace(/\s+/g, '_')}`);
    };

    const exportPerfToExcel = () => {
        if (!perfReport) return;
        const title = `Performance Load Test Report - ${currentScenario.name}`;
        const date = new Date().toLocaleString();
        
        let tableHTML = `
            <h3>Global Configuration & Metrics</h3>
            <table border="1">
                <tr><th>Virtual Users (VUs)</th><td>${currentScenario.perfConfig.vus}</td></tr>
                <tr><th>Spawn Rate (/s)</th><td>${currentScenario.perfConfig.spawnRate}</td></tr>
                <tr><th>Duration (s)</th><td>${currentScenario.perfConfig.duration}</td></tr>
                <tr><th>Total Requests Executed</th><td>${perfReport.global.total}</td></tr>
                <tr><th>Total Success</th><td>${perfReport.global.success}</td></tr>
                <tr><th>Total Failed</th><td>${perfReport.global.fail}</td></tr>
                <tr><th>Global Average Time (ms)</th><td>${perfReport.global.metrics.avg}</td></tr>
            </table>
            <br/>
            <h3>Metrics Summary per API Endpoint</h3>
            <table border="1">
                <tr>
                    <th>Method</th>
                    <th>API Name</th>
                    <th>Total Req</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Avg Time (ms)</th>
                    <th>Min Time (ms)</th>
                    <th>Max Time (ms)</th>
                    <th>P95 Time (ms)</th>
                </tr>`;
            
        Object.values(perfReport.nodes).forEach(n => {
            tableHTML += `
                <tr>
                    <td>${n.method}</td>
                    <td>${n.name}</td>
                    <td>${n.total}</td>
                    <td>${n.success}</td>
                    <td>${n.fail}</td>
                    <td>${n.metrics.avg}</td>
                    <td>${n.metrics.min}</td>
                    <td>${n.metrics.max}</td>
                    <td>${n.metrics.p95}</td>
                </tr>`;
        });
        tableHTML += `</table>`;
        
        exportHTMLToExcel(title, date, tableHTML, `PerformanceReport_${currentScenario.name.replace(/\s+/g, '_')}`);
    };

    // =====================================
    // RUNNER: API FLOW TEST
    // =====================================
    const runApiFlowTest = async () => {
        if (currentScenario.nodes.length === 0) return showAlert('No nodes to run', 'warning');
        setIsRunning(true); abortRef.current = false;
        setLogs([]); setLogsOpen(true); 
        setApiFlowReport(null);
        setExpandedFlowItem(null);
        appendLog(`Starting API Flow Test: ${currentScenario.name}`, 'info');

        let runtimeVariables = [...variablesList];
        const flowResultsList = [];

        const applyVariablesToText = (text, varsArr) => {
            if (!text) return text; let result = String(text);
            varsArr.forEach(v => { if (v.var_key && v.var_value) result = result.replace(new RegExp(`\\{\\{${v.var_key}\\}\\}`, 'g'), v.var_value); });
            return result;
        };

        const nodesCopy = [...currentScenario.nodes]; nodesCopy.forEach(n => { n.runStatus = null; });
        const edgesCopy = [...currentScenario.edges]; edgesCopy.forEach(e => { delete e.runtimeStatus; });
        setCurrentScenario(prev => ({ ...prev, nodes: nodesCopy, edges: edgesCopy }));

        let inDegree = {}; let adj = {};
        currentScenario.nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
        currentScenario.edges.forEach(e => { if (inDegree[e.target] !== undefined) inDegree[e.target]++; if (adj[e.source]) adj[e.source].push(e); });

        let startNodes = currentScenario.nodes.filter(n => inDegree[n.id] === 0);
        if (startNodes.length === 0 && currentScenario.nodes.length > 0) startNodes.push(currentScenario.nodes[0]);

        let scenarioSuccess = true; let visited = new Set();

        const updateNodeStatus = (id, status, text, prog = '') => {
            setCurrentScenario(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === id ? { ...n, runStatus: { status, text, prog } } : n) }));
        };

        const updateEdgeStatus = (edgeList, status) => {
            setCurrentScenario(prev => {
                const newEdges = [...prev.edges]; edgeList.forEach(edge => { const e = newEdges.find(ne => ne.id === edge.id); if (e) e.runtimeStatus = status; });
                return { ...prev, edges: newEdges };
            });
        };

        const executeNodeAsync = async (node) => {
            if (visited.has(node.id) || abortRef.current) return;
            visited.add(node.id);

            const delayMs = parseInt(node.delay) || 0;
            if (delayMs > 0) {
                updateNodeStatus(node.id, 'waiting', 'Waiting...', '');
                let remaining = delayMs;
                while (remaining > 0 && !abortRef.current) {
                    updateNodeStatus(node.id, 'waiting', `Waiting (${Math.ceil(remaining/1000)}s)...`, '');
                    const step = Math.min(1000, remaining);
                    await new Promise(r => setTimeout(r, step));
                    remaining -= step;
                }
            }

            if (abortRef.current) return;

            updateNodeStatus(node.id, 'running', 'Running...', '');
            const incomingEdges = currentScenario.edges.filter(e => e.target === node.id);
            updateEdgeStatus(incomingEdges, 'running');

            let nodeSuccess = true;
            appendLog(`Executing: ${node.name}`, 'info');

            let reqData = null;
            if (node.type === 'request') reqData = requests.find(r => r.id === node.refId);
            else if (node.type === 'mock') reqData = mocks.find(m => m.id === node.refId);

            if (!reqData) {
                appendLog(`Skipped: Data missing`, 'error');
                nodeSuccess = false;
            } else {
                for (let iter = 1; iter <= node.iterations; iter++) {
                    if (abortRef.current) break;
                    updateNodeStatus(node.id, 'running', 'Running...', `${iter}/${node.iterations}`);
                    
                    let resultDetail = {
                        nodeId: node.id,
                        name: node.name,
                        method: reqData.method,
                        url: '',
                        status: 0,
                        time: 0,
                        reqHeaders: '',
                        reqBody: '',
                        resHeaders: '',
                        resBody: '',
                        error: null
                    };

                    try {
                        let responseStatus, responseTime = 0, responseBodyStr = '';
                        if (node.type === 'request') {
                            let rawHeaders = typeof reqData.headers === 'string' ? JSON.parse(reqData.headers) : (reqData.headers || []);
                            let rawAuth = typeof reqData.authorization === 'string' ? JSON.parse(reqData.authorization) : (reqData.authorization || {});
                            
                            let context = { request: { url: reqData.url, method: reqData.method, headers: rawHeaders, body: reqData.body }, response: null, variables: runtimeVariables.reduce((acc, v) => ({ ...acc, [v.var_key]: v.var_value }), {}) };
                            context = await runScript(reqData.pre_request_script, context);
                            
                            let url = applyVariablesToText(context.request.url, runtimeVariables); let finalUrl = new URL(url);
                            let finalHeaders = context.request.headers.filter(h => h.key && h.key.trim() !== '').map(h => ({ key: applyVariablesToText(h.key, runtimeVariables), value: applyVariablesToText(h.value, runtimeVariables) }));

                            if (rawAuth) {
                                if (rawAuth.type === 'bearer' && rawAuth.token) { finalHeaders.push({ key: 'Authorization', value: `Bearer ${applyVariablesToText(rawAuth.token, runtimeVariables)}` }); } 
                                else if (rawAuth.type === 'basic' && rawAuth.username) { finalHeaders.push({ key: 'Authorization', value: `Basic ${btoa(`${applyVariablesToText(rawAuth.username, runtimeVariables)}:${applyVariablesToText(rawAuth.password, runtimeVariables)}`)}` }); } 
                                else if (rawAuth.type === 'apikey' && rawAuth.apikey) {
                                    if (rawAuth.addto === 'header') finalHeaders.push({ key: applyVariablesToText(rawAuth.apikey, runtimeVariables), value: applyVariablesToText(rawAuth.apivalue, runtimeVariables) });
                                    else finalUrl.searchParams.append(applyVariablesToText(rawAuth.apikey, runtimeVariables), applyVariablesToText(rawAuth.apivalue, runtimeVariables));
                                }
                            }

                            let bType = reqData.bodyType || reqData.body_type || 'none';
                            let rawBodyString = ['json', 'xml', 'text', 'html'].includes(bType) ? context.request.body : '';
                            let processedBody = applyVariablesToText(rawBodyString, runtimeVariables);
                            let formDataEntries = []; let urlencodedEntries = [];

                            if (bType === 'form-data') {
                                let fData = typeof reqData.body === 'string' ? JSON.parse(reqData.body) : (reqData.body || []);
                                formDataEntries = fData.filter(f => f.key && f.key.trim() !== '').map(f => ({...f, key: applyVariablesToText(f.key, runtimeVariables), value: f.type === 'text' ? applyVariablesToText(f.value, runtimeVariables) : f.value}));
                            } else if (bType === 'urlencoded') {
                                let uData = typeof reqData.body === 'string' ? JSON.parse(reqData.body) : (reqData.body || []);
                                urlencodedEntries = uData.filter(f => f.key && f.key.trim() !== '').map(f => ({...f, key: applyVariablesToText(f.key, runtimeVariables), value: applyVariablesToText(f.value, runtimeVariables)}));
                            }

                            const proxyData = { method: context.request.method, url: finalUrl.toString(), headersStr: JSON.stringify(finalHeaders), bodyType: bType, bodyContent: processedBody, formDataEntries, urlencodedEntries };
                            
                            resultDetail.url = finalUrl.toString();
                            resultDetail.reqHeaders = proxyData.headersStr;
                            resultDetail.reqBody = proxyData.bodyContent;

                            const response = await ApiService.proxyRequest(proxyData);
                            responseStatus = response.status; responseTime = response.time || 0;
                            responseBodyStr = typeof response.data === 'object' ? JSON.stringify(response.data) : (response.data || '');
                            context.response = response;

                            resultDetail.status = responseStatus;
                            resultDetail.time = responseTime;
                            resultDetail.resHeaders = JSON.stringify(response.headers);
                            resultDetail.resBody = responseBodyStr;

                            await runScript(reqData.post_request_script, context);
                            for (const key in context.variables) {
                                const existingVar = runtimeVariables.find(v => v.var_key === key);
                                if (!existingVar || String(existingVar.var_value) !== String(context.variables[key])) {
                                    try {
                                        await ApiService.saveVariable(activeWorkspaceId, key, context.variables[key]);
                                        let vIdx = runtimeVariables.findIndex(v => v.var_key === key);
                                        if(vIdx > -1) runtimeVariables[vIdx].var_value = context.variables[key];
                                        else runtimeVariables.push({id: null, var_key: key, var_value: context.variables[key]});
                                    } catch(e) {}
                                }
                            }

                            let assertions = [];
                            try { assertions = typeof reqData.assertions === 'string' ? JSON.parse(reqData.assertions) : (reqData.assertions || []); } catch(e) {}
                            if (assertions && assertions.length > 0) {
                                const hasFailures = assertions.some(a => {
                                    if (!a.value || a.value.trim() === '') return false;
                                    let passed = false;
                                    try {
                                        if (a.type === 'status') { if (a.operator === 'equals') passed = responseStatus.toString() === a.value; else if (a.operator === 'contains') passed = responseStatus.toString().includes(a.value); else if (a.operator === 'less_than') passed = parseInt(responseStatus) < parseInt(a.value); } 
                                        else if (a.type === 'time') { if (a.operator === 'equals') passed = parseInt(responseTime) === parseInt(a.value); else if (a.operator === 'less_than') passed = parseInt(responseTime) < parseInt(a.value); } 
                                        else if (a.type === 'body_contains') { if (a.operator === 'contains') passed = responseBodyStr.includes(a.value); else if (a.operator === 'equals') passed = responseBodyStr === a.value; }
                                    } catch(e) {}
                                    return !passed;
                                });
                                if (hasFailures) throw new Error(`Assertion failed on iter ${iter}`);
                            }
                        } else {
                            const url = `${window.location.origin}/api/mock/${activeWorkspaceId}${reqData.path.startsWith('/') ? reqData.path : '/' + reqData.path}`;
                            resultDetail.url = url;
                            const reqStart = Date.now();
                            const response = await fetch(url, { method: reqData.method });
                            responseStatus = response.status;
                            
                            resultDetail.status = responseStatus;
                            resultDetail.time = Date.now() - reqStart;
                            resultDetail.resHeaders = JSON.stringify(Object.fromEntries(response.headers.entries()));
                            resultDetail.resBody = await response.text();

                            if (responseStatus !== parseInt(reqData.status)) throw new Error(`Expected ${reqData.status}, got ${responseStatus}`);
                        }

                        appendLog(`  Iter ${iter}: HTTP ${responseStatus}`, responseStatus >= 200 && responseStatus < 300 ? 'success' : 'warning');
                        if (iter < node.iterations) await new Promise(r => setTimeout(r, 200));

                    } catch (e) {
                        appendLog(`  Iter ${iter} Error: ${e.message}`, 'error');
                        resultDetail.error = e.message;
                        nodeSuccess = false; scenarioSuccess = false; 
                    } finally {
                        flowResultsList.push(resultDetail);
                    }
                    
                    if (!nodeSuccess) break;
                }
            }

            if (abortRef.current) return;

            if (nodeSuccess) {
                updateNodeStatus(node.id, 'passed', 'Passed');
                updateEdgeStatus(incomingEdges, 'success');
                const children = adj[node.id].map(edge => currentScenario.nodes.find(n => n.id === edge.target)).filter(n => n && !visited.has(n.id));
                if (children.length > 0) {
                    updateEdgeStatus(adj[node.id].filter(e => !visited.has(e.target)), 'running');
                    await Promise.all(children.map(child => executeNodeAsync(child)));
                }
            } else {
                updateNodeStatus(node.id, 'failed', 'Failed');
                updateEdgeStatus(incomingEdges, 'error'); updateEdgeStatus(adj[node.id], 'error');
            }
        };

        await Promise.all(startNodes.map(node => executeNodeAsync(node)));

        if (abortRef.current) {
            appendLog(`Test stopped manually.`, 'warning');
        } else {
            setCurrentScenario(prev => {
                const newE = [...prev.edges]; newE.forEach(e => { if (e.runtimeStatus === 'running') e.runtimeStatus = 'error'; });
                return { ...prev, edges: newE };
            });
            setVariablesList(runtimeVariables);
            appendLog(scenarioSuccess ? `Scenario completed successfully!` : `Scenario execution finished with failures.`, scenarioSuccess ? 'success' : 'error');
            setApiFlowReport(flowResultsList); // Show the report automatically
        }
        setIsRunning(false);
    };

    // =====================================
    // RUNNER: PERFORMANCE LOAD TEST
    // =====================================
    const runPerformanceTest = async () => {
        const { vus, spawnRate, duration } = currentScenario.perfConfig;
        if (!vus || !spawnRate || !duration) {
            return showAlert('Concurrent VUs, Spawn Rate, and Duration must be filled!', 'warning');
        }
        if (currentScenario.nodes.length === 0) return showAlert('No nodes to run', 'warning');
        
        setIsRunning(true); abortRef.current = false;
        setPerfReport(null); setExpandedPerfNode(null); setExpandedPerfDetail(null);
        perfLogsRef.current = [];
        perfNodesRef.current = {};

        setLogs([]); setLogsOpen(true);
        appendLog(`Starting Performance Test: ${currentScenario.name} [VUs: ${vus}, Rate: ${spawnRate}/s, Duration: ${duration}s]`, 'info');

        const durationMs = duration * 1000;
        const startTime = Date.now();
        
        const stats = { global: { total: 0, success: 0, fail: 0, times: [] }, nodes: {} };
        
        currentScenario.nodes.forEach(n => { 
            stats.nodes[n.id] = { name: n.name, method: n.method, total: 0, success: 0, fail: 0, times: [], details: [] }; 
            perfNodesRef.current[n.id] = { status: 'running', text: 'Load Testing', prog: '0 Req' };
        });

        // Set all edges to animated 'running'
        setCurrentScenario(prev => ({
            ...prev,
            edges: prev.edges.map(e => ({ ...e, runtimeStatus: 'running' })),
            nodes: prev.nodes.map(n => ({ ...n, runStatus: perfNodesRef.current[n.id] }))
        }));

        let inDegree = {}; let adj = {};
        currentScenario.nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
        currentScenario.edges.forEach(e => { if (inDegree[e.target] !== undefined) inDegree[e.target]++; if (adj[e.source]) adj[e.source].push(e); });
        let startNodes = currentScenario.nodes.filter(n => inDegree[n.id] === 0);
        if (startNodes.length === 0 && currentScenario.nodes.length > 0) startNodes.push(currentScenario.nodes[0]);

        // Sync interval to update UI without freezing
        const syncInterval = setInterval(() => {
            if (abortRef.current || Date.now() - startTime >= durationMs) {
                clearInterval(syncInterval);
                return;
            }
            if (perfLogsRef.current.length > 0) {
                setLogs(prev => {
                    const newLogs = [...prev, ...perfLogsRef.current];
                    perfLogsRef.current = [];
                    return newLogs.length > 150 ? newLogs.slice(-150) : newLogs; // limit buffer
                });
            }
            setCurrentScenario(prev => {
                const newNodes = prev.nodes.map(n => perfNodesRef.current[n.id] ? { ...n, runStatus: perfNodesRef.current[n.id] } : n);
                return { ...prev, nodes: newNodes };
            });
        }, 500);

        const runVU = async (vuId) => {
            let vuVariables = JSON.parse(JSON.stringify(variablesList)); 
            const applyVars = (text) => {
                if (!text) return text; let result = String(text);
                vuVariables.forEach(v => { if (v.var_key && v.var_value) result = result.replace(new RegExp(`\\{\\{${v.var_key}\\}\\}`, 'g'), v.var_value); });
                return result;
            };

            while (Date.now() - startTime < durationMs && !abortRef.current) {
                const traverse = async (nodeId) => {
                    if (abortRef.current || Date.now() - startTime >= durationMs) return;
                    const node = currentScenario.nodes.find(n => n.id === nodeId);
                    if (!node) return;

                    let reqData = node.type === 'request' ? requests.find(r => r.id === node.refId) : mocks.find(m => m.id === node.refId);
                    if (reqData) {
                        const reqStart = Date.now();
                        let resultDetail = { vu: vuId, status: 0, time: 0, reqHeaders: '', reqBody: '', resHeaders: '', resBody: '', error: null };
                        
                        try {
                            let isSuccess = false;
                            if (node.type === 'request') {
                                let url = applyVars(reqData.url); let finalUrl = new URL(url);
                                let bType = reqData.bodyType || reqData.body_type || 'none';
                                let rawBodyString = ['json', 'xml', 'text', 'html'].includes(bType) ? reqData.body : '';
                                let processedBody = applyVars(rawBodyString);
                                const proxyData = { method: reqData.method, url: finalUrl.toString(), headersStr: '[]', bodyType: bType, bodyContent: processedBody, formDataEntries: [], urlencodedEntries: [] };
                                
                                resultDetail.reqHeaders = proxyData.headersStr;
                                resultDetail.reqBody = proxyData.bodyContent;
                                resultDetail.url = finalUrl.toString();

                                const response = await ApiService.proxyRequest(proxyData);
                                resultDetail.time = response.time || (Date.now() - reqStart);
                                resultDetail.status = response.status;
                                resultDetail.resHeaders = JSON.stringify(response.headers);
                                resultDetail.resBody = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;
                                
                                isSuccess = response.status >= 200 && response.status < 300;
                            } else {
                                const url = `${window.location.origin}/api/mock/${activeWorkspaceId}${reqData.path.startsWith('/') ? reqData.path : '/' + reqData.path}`;
                                resultDetail.url = url;
                                const response = await fetch(url, { method: reqData.method });
                                resultDetail.time = Date.now() - reqStart;
                                resultDetail.status = response.status;
                                resultDetail.resHeaders = JSON.stringify(Object.fromEntries(response.headers.entries()));
                                resultDetail.resBody = await response.text();
                                
                                isSuccess = response.status === parseInt(reqData.status);
                            }

                            stats.global.total++;
                            stats.nodes[nodeId].total++;
                            stats.global.times.push(resultDetail.time);
                            stats.nodes[nodeId].times.push(resultDetail.time);
                            
                            if(isSuccess) { stats.global.success++; stats.nodes[nodeId].success++; } 
                            else { stats.global.fail++; stats.nodes[nodeId].fail++; }

                            stats.nodes[nodeId].details.push(resultDetail);
                            
                            perfNodesRef.current[nodeId] = { status: 'running', text: 'Load Testing', prog: `Avg: ${Math.round(stats.nodes[nodeId].times.reduce((a,b)=>a+b,0)/stats.nodes[nodeId].times.length)}ms` };
                            perfLogsRef.current.push({ msg: `[VU-${vuId}] ${node.name} - HTTP ${resultDetail.status} (${resultDetail.time}ms)`, type: isSuccess ? 'success' : 'error', time: new Date().toLocaleTimeString() });

                        } catch(e) {
                            resultDetail.time = Date.now() - reqStart;
                            resultDetail.error = e.message;
                            stats.global.total++; stats.global.fail++;
                            stats.nodes[nodeId].total++; stats.nodes[nodeId].fail++;
                            stats.nodes[nodeId].details.push(resultDetail);
                            
                            perfLogsRef.current.push({ msg: `[VU-${vuId}] ${node.name} - ERR: ${e.message}`, type: 'error', time: new Date().toLocaleTimeString() });
                        }
                    }

                    for (const edge of adj[nodeId]) await traverse(edge.target);
                };

                for (const startNode of startNodes) await traverse(startNode.id);
            }
        };

        let activeVUs = 0;
        const spawnInterval = setInterval(() => {
            if (abortRef.current || Date.now() - startTime >= durationMs) {
                clearInterval(spawnInterval);
                return;
            }
            for (let i = 0; i < spawnRate && activeVUs < vus; i++) {
                activeVUs++;
                runVU(activeVUs);
            }
            if (activeVUs >= vus) clearInterval(spawnInterval);
        }, 1000);

        await new Promise(resolve => {
            const check = setInterval(() => {
                if (abortRef.current || Date.now() - startTime >= durationMs) {
                    clearInterval(check);
                    resolve();
                }
            }, 500);
        });

        clearInterval(syncInterval);

        setCurrentScenario(prev => ({
            ...prev,
            edges: prev.edges.map(e => ({ ...e, runtimeStatus: abortRef.current ? 'error' : 'success' })),
            nodes: prev.nodes.map(n => ({ ...n, runStatus: { status: abortRef.current ? 'waiting' : 'passed', text: abortRef.current ? 'Stopped' : 'Finished', prog: `Reqs: ${stats.nodes[n.id].total}` } }))
        }));

        setIsRunning(false);
        
        if (abortRef.current) {
            appendLog(`Performance test stopped manually.`, 'warning');
        } else {
            appendLog(`Performance test finished successfully.`, 'success');
        }

        // Calculate Report Metrics
        const calcMetrics = (arr) => {
            if (arr.length === 0) return { min: 0, max: 0, avg: 0, p95: 0 };
            arr.sort((a,b)=>a-b);
            return {
                min: arr[0], max: arr[arr.length - 1],
                avg: Math.round(arr.reduce((a,b)=>a+b,0) / arr.length),
                p95: arr[Math.floor(arr.length * 0.95)]
            };
        };

        stats.global.metrics = calcMetrics(stats.global.times);
        Object.keys(stats.nodes).forEach(k => {
            stats.nodes[k].metrics = calcMetrics(stats.nodes[k].times);
        });

        setPerfReport(stats);
    };

    const handleStopTest = () => {
        abortRef.current = true;
    };

    const handleRunClick = () => {
        setConnectState(null); // RESET STATE GARIS SAAT RUN TEST DIKLIK
        if (currentScenario.testType === 'performance') runPerformanceTest();
        else runApiFlowTest();
    };

    const q = librarySearch.toLowerCase();
    const filteredReqs = requests.filter(r => (r.name || '').toLowerCase().includes(q) || (r.url || '').toLowerCase().includes(q));
    const filteredMocks = mocks.filter(m => (m.name || '').toLowerCase().includes(q));

    let maxX = 0, maxY = 0;
    currentScenario.nodes.forEach(n => { if (n.x + 300 > maxX) maxX = n.x + 300; if (n.y + 300 > maxY) maxY = n.y + 300; });

    return (
        <div className="flex-grow flex overflow-hidden w-full h-full relative">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes flowDash { to { stroke-dashoffset: -16; } }
                .scroll-custom::-webkit-scrollbar { width: 6px; height: 6px; }
                .scroll-custom::-webkit-scrollbar-track { background: transparent; }
                .scroll-custom::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
                .dark .scroll-custom::-webkit-scrollbar-thumb { background-color: #475569; }
                
                @keyframes pulse-red-custom {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                    70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
                @keyframes pulse-green-custom {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .handle-source-active {
                    background-color: #ef4444 !important;
                    border-color: #991b1b !important;
                    animation: pulse-red-custom 1.2s infinite;
                    transform: scale(1.2);
                }
                .handle-target-valid {
                    background-color: #10b981 !important;
                    border-color: #047857 !important;
                    animation: pulse-green-custom 1s infinite;
                    transform: scale(1.15);
                }
            `}} />
            
            {/* Sidebar Library */}
            <aside className={`w-64 bg-gray-50 dark:bg-slate-800/50 border-r border-gray-200 dark:border-slate-700 flex flex-col shrink-0 z-30 absolute md:relative h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300"><i className="fa-solid fa-flask mr-2"></i>Test Scenarios</h3>
                    <button onClick={initiateNewScenario} className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors" title="New Scenario"><i className="fa-solid fa-plus text-sm"></i></button>
                </div>
                <div className="flex-grow overflow-y-auto scroll-custom p-2 pb-12 space-y-1">
                    {scenarios.length === 0 && <div className="text-center p-4 text-sm text-gray-500">No test scenarios</div>}
                    {scenarios.map(s => {
                        let isPerf = false;
                        try { const d = JSON.parse(s.nodes); if (d.type === 'performance') isPerf = true; } catch(e){}
                        return (
                            <div key={s.id} onClick={() => handleLoadScenario(s)} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer transition-colors group relative border-l-2 border-transparent ${currentScenario.id === s.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''}`}>
                                <div className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{s.name}</div>
                                <div className="text-[10px] text-gray-500 mt-0.5">{isPerf ? 'Performance Test' : 'API Flow Test'}</div>
                            </div>
                        )
                    })}
                </div>
            </aside>

            {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

            <main className="flex-grow flex flex-col bg-white dark:bg-slate-900 min-w-0 h-full overflow-hidden relative">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 md:hidden flex items-center shrink-0">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors mr-2"><i className="fa-solid fa-bars"></i></button>
                    <span className="font-semibold text-sm">Scenarios Sidebar</span>
                </div>

                <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800 shrink-0">
                    <div className="flex items-center gap-3 w-1/2">
                        <input type="text" value={currentScenario.name} onChange={e => setCurrentScenario(p => ({...p, name: e.target.value}))} className="bg-transparent font-bold text-lg outline-none w-full max-w-[250px]" placeholder="Scenario Name" />
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentScenario.testType === 'performance' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                            {currentScenario.testType === 'performance' ? 'Performance Test' : 'API Flow'}
                        </span>
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={isRunning} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2 disabled:opacity-50"><i className="fa-solid fa-save"></i> <span className="hidden md:inline">Save</span></button>
                        
                        {!isRunning ? (
                            <button onClick={handleRunClick} className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex items-center gap-2">
                                <i className="fa-solid fa-play"></i> <span className="hidden md:inline">Run Test</span>
                            </button>
                        ) : (
                            <button onClick={handleStopTest} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-2">
                                <i className="fa-solid fa-circle-notch fa-spin"></i> <span className="hidden md:inline">Stop Test</span>
                            </button>
                        )}
                        
                        {currentScenario.id && <button onClick={handleDeleteTrigger} disabled={isRunning} className="px-3 py-2 text-sm font-medium bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors disabled:opacity-50"><i className="fa-solid fa-trash"></i></button>}
                    </div>
                </div>

                {currentScenario.testType === 'performance' && (
                    <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/10 border-b border-gray-200 dark:border-slate-700 shrink-0 flex gap-6 items-center overflow-x-auto scroll-custom">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">Concurrent VUs:</label>
                            <input type="number" min="1" max="1000" value={currentScenario.perfConfig.vus} onChange={e => handleConfigChange('vus', e.target.value === '' ? '' : parseInt(e.target.value))} className="w-20 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded outline-none focus:ring-1 focus:ring-purple-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">Spawn Rate (users/s):</label>
                            <input type="number" min="1" max="100" value={currentScenario.perfConfig.spawnRate} onChange={e => handleConfigChange('spawnRate', e.target.value === '' ? '' : parseInt(e.target.value))} className="w-20 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded outline-none focus:ring-1 focus:ring-purple-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">Duration (sec):</label>
                            <input type="number" min="5" max="3600" value={currentScenario.perfConfig.duration} onChange={e => handleConfigChange('duration', e.target.value === '' ? '' : parseInt(e.target.value))} className="w-20 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded outline-none focus:ring-1 focus:ring-purple-500" />
                        </div>
                    </div>
                )}

                <div className="flex-grow flex overflow-hidden">
                    {/* Inner Sidebar Library */}
                    <div className="w-1/3 max-w-[300px] border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 flex flex-col">
                        <div className="p-3 border-b border-gray-200 dark:border-slate-700 font-semibold text-sm">Library</div>
                        <div className="p-2 border-b border-gray-200 dark:border-slate-700"><input type="text" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} placeholder="Search..." className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded" /></div>
                        
                        <div className="flex-grow overflow-y-auto scroll-custom p-2 pb-12 space-y-1">
                            {filteredReqs.length > 0 && <div className="text-xs font-bold text-gray-500 mt-2 mb-1 px-1 uppercase tracking-wider">Requests</div>}
                            
                            {folders.map(f => {
                                const fReqs = filteredReqs.filter(r => r.folder_id === f.id);
                                if (q !== '' && fReqs.length === 0 && !(f.name||'').toLowerCase().includes(q)) return null;
                                const isExpanded = expandedLibraryFolders[f.id] !== false;

                                return (
                                    <div key={f.id} className="mb-2">
                                        <div onClick={() => setExpandedLibraryFolders(p => ({...p, [f.id]: !isExpanded}))} className="cursor-pointer flex items-center gap-1.5 px-1.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors group">
                                            <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} w-3 text-center text-[10px] text-gray-500`}></i>
                                            <i className="fa-solid fa-folder text-blue-500"></i>
                                            <span className="truncate">{f.name}</span>
                                        </div>
                                        {isExpanded && (
                                            <div className="pl-5 pr-1 mt-1 space-y-1">
                                                {fReqs.map(r => (
                                                    <div key={r.id} onClick={() => handleAddNode('request', r, f.name)} className="p-1.5 rounded border border-transparent hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-slate-700 dark:hover:border-slate-600 cursor-pointer text-xs flex items-center justify-between group transition-colors">
                                                        <div className="flex items-center gap-2 truncate"><span className={`font-bold method-${r.method}`}>{r.method}</span> <span className="truncate">{r.name}</span></div>
                                                        <button className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800"><i className="fa-solid fa-plus"></i></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredReqs.filter(r => !r.folder_id).map(r => (
                                <div key={r.id} onClick={() => handleAddNode('request', r)} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer text-xs mb-1 flex items-center justify-between group">
                                    <div className="flex items-center gap-2 truncate"><span className={`font-bold method-${r.method}`}>{r.method}</span> <span className="truncate">{r.name}</span></div>
                                    <button className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800"><i className="fa-solid fa-plus"></i></button>
                                </div>
                            ))}

                            {filteredMocks.length > 0 && <div className="text-xs font-bold text-gray-500 mt-3 mb-1 px-1 uppercase tracking-wider">Mocks</div>}
                            {filteredMocks.map(m => (
                                <div key={m.id} onClick={() => handleAddNode('mock', m)} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer text-xs mb-1 flex items-center justify-between group">
                                    <div className="flex items-center gap-2 truncate"><span className={`font-bold method-${m.method}`}>{m.method}</span> <span className="truncate">{m.name}</span></div>
                                    <button className="opacity-0 group-hover:opacity-100 text-orange-600 hover:text-orange-800"><i className="fa-solid fa-plus"></i></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-grow relative bg-[#f8fafc] dark:bg-[#0f172a] overflow-hidden">
                        <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 bg-white dark:bg-slate-800 shadow-md rounded-lg border border-gray-200 dark:border-slate-700 p-1">
                            <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><i className="fa-solid fa-plus"></i></button>
                            <div className="w-full h-px bg-gray-200 dark:bg-slate-700"></div>
                            <button onClick={() => setZoom(1)} className="w-8 h-8 flex items-center justify-center text-[10px] font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">{Math.round(zoom * 100)}%</button>
                            <div className="w-full h-px bg-gray-200 dark:bg-slate-700"></div>
                            <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><i className="fa-solid fa-minus"></i></button>
                        </div>

                        {/* RESET STATE KETIKA KLIK AREA KOSONG KANVAS */}
                        <div ref={containerRef} onScroll={drawLines} className="absolute inset-0 w-full h-full overflow-y-auto scroll-custom z-10">
                            <div ref={scaledContainerRef} onClick={() => setConnectState(null)} style={{ width: Math.max(maxX, containerRef.current?.clientWidth || 0), height: Math.max(maxY, containerRef.current?.clientHeight || 0), transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="relative min-w-full min-h-full">
                                <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"></svg>

                                {currentScenario.nodes.map((node) => (
                                    <div key={node.id} id={`canvas-node-${node.id}`} className="w-64 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 p-3 absolute z-10 flex flex-col transition-colors" style={{ left: node.x, top: node.y }}>
                                    {['top', 'right', 'bottom', 'left'].map(pos => {
                                        // CEK APAKAH TITIK INI SUDAH TERHUBUNG GARIS
                                        const isConnected = currentScenario.edges.some(e => 
                                            (e.source === node.id && e.sourceHandle === pos) || 
                                            (e.target === node.id && e.targetHandle === pos)
                                        );

                                        const isSource = connectState && connectState.nodeId === node.id && connectState.handleId === pos;
                                        const isValidTarget = connectState && connectState.nodeId !== node.id;
                                        
                                        const posStyle = pos === 'top' ? { top: -6, left: '50%', transform: 'translateX(-50%)' } 
                                            : pos === 'bottom' ? { bottom: -6, left: '50%', transform: 'translateX(-50%)' } 
                                            : pos === 'right' ? { right: -6, top: '50%', transform: 'translateY(-50%)' } 
                                            : { left: -6, top: '50%', transform: 'translateY(-50%)' };

                                        let handleClass = "node-handle absolute w-3.5 h-3.5 rounded-full transition-all duration-200 z-20 ";
                                        
                                        // JIKA SUDAH TERHUBUNG, HANYA SEMBUNYIKAN SECARA VISUAL
                                        if (isConnected) {
                                            handleClass += "opacity-0 pointer-events-none";
                                        } else {
                                            handleClass += "bg-white dark:bg-slate-200 border-2 border-gray-400 dark:border-slate-500 cursor-crosshair hover:scale-125 ";
                                            if (isSource) {
                                                handleClass += "handle-source-active";
                                            } else if (isValidTarget) {
                                                handleClass += "handle-target-valid hover:bg-emerald-600 hover:border-emerald-800";
                                            } else {
                                                handleClass += "hover:bg-blue-500 hover:border-blue-700";
                                            }
                                        }

                                        return <div key={pos} onClick={(e) => handleHandleClick(e, node.id, pos)} className={handleClass} style={posStyle} data-node={node.id} data-handle={pos}></div>;
                                    })}

                                    <div data-id={node.id} onPointerDown={(e) => startDrag(e, node)} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} className="flex justify-between items-start mb-2 border-b border-gray-100 dark:border-slate-700 pb-2 cursor-grab active:cursor-grabbing node-header" style={{ touchAction: 'none' }}>
                                        <div className="flex flex-col truncate pr-2 pointer-events-none">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className={`w-6 h-6 shrink-0 rounded flex items-center justify-center text-xs ${node.type === 'mock' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}><i className={`fa-solid ${node.type === 'mock' ? 'fa-server' : 'fa-paper-plane'}`}></i></div>
                                                <span className="font-bold text-sm truncate">{node.name}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0 mt-0.5 pointer-events-auto">
                                            <button onClick={() => removeNode(node.id)} className="text-gray-400 hover:text-red-500 p-1"><i className="fa-solid fa-times text-xs"></i></button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        <div className="flex justify-between items-center"><span>Method:</span><span className={`font-bold method-${node.method}`}>{node.method}</span></div>
                                        {currentScenario.testType === 'api_flow' && (
                                            <>
                                            <div className="flex justify-between items-center"><span>Iterations:</span><input type="number" min="1" max="100" value={node.iterations} onChange={e => handleNodeChange(node.id, 'iterations', e.target.value)} onBlur={e => handleNodeChange(node.id, 'iterations', parseInt(e.target.value)||1)} className="w-16 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-1 py-0.5 outline-none" /></div>
                                            <div className="flex justify-between items-center"><span>Delay (ms):</span><input type="number" min="0" value={node.delay} onChange={e => handleNodeChange(node.id, 'delay', e.target.value)} onBlur={e => handleNodeChange(node.id, 'delay', parseInt(e.target.value)||0)} className="w-16 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-1 py-0.5 outline-none" /></div>
                                            </>
                                        )}
                                    </div>
                                    {node.runStatus && (
                                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                {node.runStatus.status === 'running' && <i className="fa-solid fa-circle-notch fa-spin text-sm text-blue-500"></i>}
                                                {node.runStatus.status === 'passed' && <i className="fa-solid fa-check-circle text-sm text-green-500"></i>}
                                                {node.runStatus.status === 'failed' && <i className="fa-solid fa-times-circle text-sm text-red-500"></i>}
                                                {node.runStatus.status === 'waiting' && <i className="fa-regular fa-clock text-sm text-yellow-500"></i>}
                                                <span className={`text-xs font-bold ${node.runStatus.status === 'passed' ? 'text-green-600' : node.runStatus.status === 'failed' ? 'text-red-600' : node.runStatus.status === 'waiting' ? 'text-yellow-600' : 'text-blue-600'}`}>{node.runStatus.text}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-mono font-bold">{node.runStatus.prog}</span>
                                        </div>
                                    )}
                                    </div>
                                ))}
                                {currentScenario.nodes.length === 0 && (
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-gray-500">
                                        <i className="fa-solid fa-diagram-project text-4xl mb-3 opacity-50"></i><p>Add requests from the library to build your test scenario</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Logs Pane */}
                        <div className={`absolute bottom-0 left-0 right-0 h-1/3 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)] transform transition-transform duration-300 z-50 flex flex-col ${logsOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                            <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/80">
                                <span className="font-semibold text-sm">Execution Logs {isRunning && <i className="fa-solid fa-circle-notch fa-spin ml-2 text-blue-500"></i>}</span>
                                <button onClick={() => setLogsOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><i className="fa-solid fa-times"></i></button>
                            </div>
                            <div className="flex-grow overflow-y-auto scroll-custom p-4 pb-12 font-mono text-xs space-y-2">
                                {logs.map((log, i) => (
                                    <div key={i} className={log.type === 'success' ? 'text-green-600 dark:text-green-400' : log.type === 'error' ? 'text-red-600 dark:text-red-400' : log.type === 'warning' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}>
                                        <span className="text-gray-400 dark:text-gray-600">[{log.time}]</span> {log.msg}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal Report untuk API Flow Test */}
            {apiFlowReport && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all border border-gray-200 dark:border-slate-700">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 shrink-0">
                            <h3 className="font-bold text-xl text-blue-700 dark:text-blue-400"><i className="fa-solid fa-list-check mr-2"></i>API Flow Test Report</h3>
                            <button onClick={() => setApiFlowReport(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 min-h-0 scroll-custom bg-gray-50 dark:bg-slate-900">
                            <div className="space-y-3">
                                {apiFlowReport.map((item, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                        <div 
                                            onClick={() => setExpandedFlowItem(expandedFlowItem === idx ? null : idx)}
                                            className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 w-1/2">
                                                <i className={`fa-solid fa-chevron-${expandedFlowItem === idx ? 'down' : 'right'} text-gray-400 text-xs w-3`}></i>
                                                <span className={`font-bold text-xs method-${item.method}`}>{item.method}</span>
                                                <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{item.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-mono">
                                                <span className={`${item.status >= 200 && item.status < 300 ? 'text-emerald-600' : 'text-red-600'} font-bold`}>{item.status}</span>
                                                <span className="text-gray-500">{item.time}ms</span>
                                            </div>
                                        </div>

                                        {expandedFlowItem === idx && (
                                            <div className="border-t border-gray-200 dark:border-slate-700 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 dark:bg-slate-900/50 text-xs">
                                                {/* Request Panel */}
                                                <div className="space-y-2">
                                                    <h5 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700 pb-1">Request</h5>
                                                    <div className="font-mono bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-700 break-all">{item.url}</div>
                                                    
                                                    <div className="font-bold text-gray-500 mt-2">Headers:</div>
                                                    <pre className="bg-gray-100 dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom text-[10px]">{formatPayload(item.reqHeaders)}</pre>
                                                    
                                                    <div className="font-bold text-gray-500 mt-2">Body:</div>
                                                    <pre className="bg-gray-100 dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom text-[10px] max-h-40">{item.reqBody || 'No Body'}</pre>
                                                </div>

                                                {/* Response Panel */}
                                                <div className="space-y-2">
                                                    <h5 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700 pb-1">Response</h5>
                                                    {item.error ? (
                                                        <div className="text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200">Error: {item.error}</div>
                                                    ) : (
                                                        <>
                                                        <div className="font-bold text-gray-500 mt-2">Headers:</div>
                                                        <pre className="bg-gray-100 dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom text-[10px] max-h-32">{formatPayload(item.resHeaders)}</pre>
                                                        
                                                        <div className="font-bold text-gray-500 mt-2">Body:</div>
                                                        <pre className="bg-gray-100 dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom text-[10px] max-h-40">{formatPayload(item.resBody)}</pre>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800 shrink-0">
                            <button onClick={exportApiFlowToExcel} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"><i className="fa-solid fa-file-excel"></i> Export to Excel</button>
                            <button onClick={() => setApiFlowReport(null)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors">Close Report</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Performance Report Modal - Detail Per API & Executions */}
            {perfReport && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all border border-gray-200 dark:border-slate-700">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-purple-50 dark:bg-purple-900/20 shrink-0">
                            <h3 className="font-bold text-xl text-purple-700 dark:text-purple-400"><i className="fa-solid fa-chart-line mr-2"></i>Performance Report</h3>
                            <button onClick={() => setPerfReport(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 min-h-0 scroll-custom bg-gray-50 dark:bg-slate-900">
                            {/* Global Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 text-center shadow-sm">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Total Req</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">{perfReport.global.total}</p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center shadow-sm">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">Success</p>
                                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{perfReport.global.success}</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800 text-center shadow-sm">
                                    <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase mb-1">Failed</p>
                                    <p className="text-2xl font-black text-red-700 dark:text-red-400">{perfReport.global.fail}</p>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-center shadow-sm">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Avg Time</p>
                                    <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{perfReport.global.metrics.avg}ms</p>
                                </div>
                            </div>
                            
                            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2">Details per API Endpoint</h4>
                            
                            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 font-bold">
                                        <tr>
                                            <th className="px-4 py-3 w-8"></th>
                                            <th className="px-4 py-3">API Name</th>
                                            <th className="px-4 py-3 text-center">Total</th>
                                            <th className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400">Success</th>
                                            <th className="px-4 py-3 text-center text-red-600 dark:text-red-400">Failed</th>
                                            <th className="px-4 py-3 text-right">Avg</th>
                                            <th className="px-4 py-3 text-right">Min</th>
                                            <th className="px-4 py-3 text-right">Max</th>
                                            <th className="px-4 py-3 text-right">P95</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {Object.entries(perfReport.nodes).map(([nodeId, n]) => (
                                            <React.Fragment key={nodeId}>
                                                <tr 
                                                    onClick={() => { setExpandedPerfNode(expandedPerfNode === nodeId ? null : nodeId); setExpandedPerfDetail(null); }}
                                                    className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-4 py-3 text-center text-gray-400"><i className={`fa-solid fa-chevron-${expandedPerfNode === nodeId ? 'down' : 'right'} text-xs`}></i></td>
                                                    <td className="px-4 py-3 font-medium flex items-center gap-2 max-w-[200px] truncate" title={n.name}>
                                                        <span className={`text-[10px] font-bold method-${n.method}`}>{n.method}</span> {n.name}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono">{n.total}</td>
                                                    <td className="px-4 py-3 text-center font-mono text-emerald-600">{n.success}</td>
                                                    <td className="px-4 py-3 text-center font-mono text-red-600">{n.fail}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{n.metrics.avg}ms</td>
                                                    <td className="px-4 py-3 text-right font-mono">{n.metrics.min}ms</td>
                                                    <td className="px-4 py-3 text-right font-mono">{n.metrics.max}ms</td>
                                                    <td className="px-4 py-3 text-right font-mono">{n.metrics.p95}ms</td>
                                                </tr>
                                                
                                                {/* Expanded Output Results for the Node */}
                                                {expandedPerfNode === nodeId && (
                                                    <tr>
                                                        <td colSpan="9" className="p-0 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                                                            <div className="p-4 max-h-96 overflow-y-auto scroll-custom">
                                                                <h5 className="font-bold text-xs uppercase text-gray-500 mb-2 tracking-wider">Execution History (Total: {n.details.length})</h5>
                                                                <div className="space-y-2">
                                                                    {n.details.map((det, idx) => (
                                                                        <div key={idx} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                                            <div 
                                                                                onClick={() => setExpandedPerfDetail(expandedPerfDetail === idx ? null : idx)}
                                                                                className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                                                                            >
                                                                                <div className="flex items-center gap-3">
                                                                                    <i className={`fa-solid fa-chevron-${expandedPerfDetail === idx ? 'down' : 'right'} text-[10px] text-gray-400`}></i>
                                                                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">VU {det.vu}</span>
                                                                                    {det.error ? (
                                                                                        <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">ERR</span>
                                                                                    ) : (
                                                                                        <span className={`text-xs font-bold ${det.status >= 200 && det.status < 300 ? 'text-emerald-600 bg-emerald-100' : 'text-red-600 bg-red-100'} px-1.5 py-0.5 rounded`}>{det.status}</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-xs font-mono text-gray-500">{det.time} ms</div>
                                                                            </div>

                                                                            {/* Expanded Detailed Request/Response Payload */}
                                                                            {expandedPerfDetail === idx && (
                                                                                <div className="border-t border-gray-100 dark:border-slate-700 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs bg-gray-50/30 dark:bg-slate-900/30">
                                                                                    {/* Request Pane */}
                                                                                    <div>
                                                                                        <h6 className="font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700 pb-1 mb-2">Request</h6>
                                                                                        <div className="font-mono bg-white dark:bg-slate-950 p-1.5 rounded border border-gray-200 dark:border-slate-700 break-all mb-2">{det.url}</div>
                                                                                        
                                                                                        <div className="font-bold text-gray-500 mt-2">Headers:</div>
                                                                                        <pre className="bg-white dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom max-h-32 mt-1">{formatPayload(det.reqHeaders)}</pre>
                                                                                        
                                                                                        <div className="font-bold text-gray-500 mt-2">Body:</div>
                                                                                        <pre className="bg-white dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom max-h-40 mt-1">{formatPayload(det.reqBody) || 'No Body'}</pre>
                                                                                    </div>

                                                                                    {/* Response Pane */}
                                                                                    <div>
                                                                                        <h6 className="font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700 pb-1 mb-2">Response</h6>
                                                                                        {det.error ? (
                                                                                            <div className="bg-red-50 text-red-600 p-2 border border-red-200 rounded font-bold break-all">Error: {det.error}</div>
                                                                                        ) : (
                                                                                            <>
                                                                                            <div className="font-bold text-gray-500 mt-2">Headers:</div>
                                                                                            <pre className="bg-white dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom max-h-32 mt-1">{formatPayload(det.resHeaders)}</pre>
                                                                                            
                                                                                            <div className="font-bold text-gray-500 mt-2">Body:</div>
                                                                                            <pre className="bg-white dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto scroll-custom max-h-40 mt-1">{formatPayload(det.resBody)}</pre>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800 shrink-0">
                            <button onClick={exportPerfToExcel} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"><i className="fa-solid fa-file-excel"></i> Export to Excel</button>
                            <button onClick={() => setPerfReport(null)} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">Close Report</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Select Scenario Type */}
            {showNewModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all border border-gray-200 dark:border-slate-700">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Create Scenario</h3>
                            <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Scenario Name</label>
                                <input type="text" value={newScenarioName} onChange={e => setNewScenarioName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Checkout Flow" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Scenario Type</label>
                                <select value={newScenarioType} onChange={e => setNewScenarioType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="api_flow">API Flow Test</option>
                                    <option value="performance">Performance Load Test</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    {newScenarioType === 'api_flow' ? 'Execute endpoints sequentially to validate logic and assertions.' : 'Simulate concurrent virtual users to stress test your endpoints.'}
                                </p>
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 rounded-lg">Cancel</button>
                                <button onClick={executeCreateNewScenario} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Alert & Confirm Modals */}
            {alertConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${alertConfig.type === 'success' ? 'bg-green-100 text-green-600' : alertConfig.type === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}><i className={`fa-solid ${alertConfig.type === 'success' ? 'fa-check' : alertConfig.type === 'warning' ? 'fa-exclamation' : 'fa-times'}`}></i></div>
                            <h3 className="text-lg font-semibold">{alertConfig.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{alertConfig.message}</p>
                        <div className="flex justify-end"><button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md">Okay</button></div>
                    </div>
                </div>
            )}
            {confirmConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><i className="fa-solid fa-triangle-exclamation"></i></div>
                            <h3 className="text-lg font-semibold">Confirmation</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{confirmConfig.message}</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmConfig({ isOpen: false, message: '', onConfirm: null })} className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 rounded-md">Cancel</button>
                            <button onClick={confirmConfig.onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md">Yes, proceed</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
