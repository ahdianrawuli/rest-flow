import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../utils/api';

export default function InterceptorModal({ isOpen, onClose, activeWorkspaceId, foldersList }) {
    const [interceptedLogs, setInterceptedLogs] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null);
    const [isListening, setIsListening] = useState(false);

    const [saveFolderId, setSaveFolderId] = useState('');
    const [saveName, setSaveName] = useState('');
    
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info' });
    const showAlert = (message, type = 'info') => setAlertConfig({ isOpen: true, message, type });

    const logsEndRef = useRef(null);
    const wsRef = useRef(null);
    const retryTimerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const connectWebSocket = () => {
            if (!isOpen) return; // Jangan konek jika modal tertutup
            
            const token = localStorage.getItem('rf_token');
            if (!token) return;

            setIsListening(true);
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            
            const socket = new WebSocket(`${protocol}//${host}/ui-ws?token=${token}`);

            socket.onopen = () => {
                console.log("[Interceptor] Connected to Server");
                if (isMounted) setIsListening(true);
            };

            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'INTERCEPT_TRAFFIC') {
                        const newLog = {
                            id: 'int_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                            ...message.data
                        };
                        if (isMounted) {
                            setInterceptedLogs(prev => [...prev, newLog]);
                        }
                    }
                } catch (err) {
                    console.error("Error parsing intercept message:", err);
                }
            };

            socket.onclose = () => {
                console.log("[Interceptor] Disconnected");
                if (isMounted) {
                    setIsListening(false);
                    wsRef.current = null;
                    if (isOpen) {
                        retryTimerRef.current = setTimeout(connectWebSocket, 3000);
                    }
                }
            };

            socket.onerror = (err) => {
                console.error("[Interceptor] WebSocket Error:", err);
            };

            wsRef.current = socket;
        };

        if (isOpen) {
            connectWebSocket();
        }

        return () => {
            isMounted = false;
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            if (wsRef.current) {
                // PERBAIKAN: Mencegah onclose memicu looping setTimeout 3 detik saat komponen unmount
                wsRef.current.onclose = null; 
                wsRef.current.close();
                wsRef.current = null;
            }
            setIsListening(false);
        };
    }, [isOpen]);

    useEffect(() => {
        // Auto scroll to bottom when new log arrives
        if (logsEndRef.current && interceptedLogs.length > 0) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [interceptedLogs]);

    const clearLogs = () => {
        setInterceptedLogs([]);
        setSelectedLog(null);
    };

    const saveRequestToWorkspace = async () => {
        if (!selectedLog) return;
        if (!activeWorkspaceId) return showAlert('No active workspace', 'error');

        try {
            // Convert Header map to Array
            const headersArr = [];
            for (const [k, v] of Object.entries(selectedLog.reqHeaders || {})) {
                headersArr.push({ key: k, value: v });
            }

            // Tebak Body Type
            let bType = 'none';
            let bContent = selectedLog.reqBody || '';
            const cType = selectedLog.reqHeaders['Content-Type'] || selectedLog.reqHeaders['content-type'] || '';
            if (cType.includes('application/json')) bType = 'json';
            else if (cType.includes('x-www-form-urlencoded')) bType = 'urlencoded';
            else if (cType.includes('multipart/form-data')) bType = 'form-data';
            else if (bContent.length > 0) bType = 'text';

            const payload = {
                name: saveName || `Intercepted ${selectedLog.method}`,
                method: selectedLog.method,
                url: selectedLog.url,
                headers: headersArr,
                bodyType: bType,
                body: bType === 'json' || bType === 'text' ? bContent : '',
                assertions: [],
                authorization: { type: 'none' },
                pre_request_script: '',
                post_request_script: '',
                folder_id: saveFolderId ? parseInt(saveFolderId) : null,
                description: 'Intercepted from Android Proxy'
            };

            await ApiService.saveRequest(activeWorkspaceId, payload);
            showAlert('Request berhasil disimpan ke Workspace!', 'success');
        } catch (e) {
            showAlert('Gagal menyimpan request: ' + e.message, 'error');
        }
    };

    const safeFolders = Array.isArray(foldersList) ? foldersList : [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 flex flex-col h-[85vh] animate-fade-in">
                
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} shadow-sm`}></div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <i className="fa-solid fa-satellite-dish text-blue-500"></i> Traffic Interceptor
                            </h3>
                            <p className="text-[11px] text-gray-500 font-mono">Status: {isListening ? 'Listening on port 8081...' : 'Disconnected'}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={clearLogs} className="px-4 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700 rounded transition-colors font-medium">Clear Logs</button>
                        <button onClick={onClose} className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors font-medium">Close Panel</button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel: Request List */}
                    <div className="w-1/3 border-r border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/20 flex flex-col">
                        <div className="p-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Captured Traffic ({interceptedLogs.length})</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {interceptedLogs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 opacity-60">
                                    <i className="fa-solid fa-mobile-screen text-4xl"></i>
                                    <p className="text-xs text-center px-4">Waiting for the traffic...<br/>Make sure the service uses a Proxy Agent.</p>
                                </div>
                            ) : (
                                interceptedLogs.map(log => (
                                    <div 
                                        key={log.id} 
                                        onClick={() => setSelectedLog(log)}
                                        className={`p-3 rounded-lg cursor-pointer border transition-all ${selectedLog?.id === log.id ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700/50 shadow-sm' : 'bg-white border-gray-200 dark:bg-slate-800 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700/30'}`}
                                    >
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded method-${log.method}`}>{log.method}</span>
                                            <span className={`text-[10px] font-bold ${log.status >= 200 && log.status < 300 ? 'text-emerald-500' : 'text-red-500'}`}>{log.status} • {log.time}ms</span>
                                        </div>
                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full" title={log.url}>
                                            {new URL(log.url).pathname}
                                        </div>
                                        <div className="text-[9px] text-gray-400 truncate mt-1">{new URL(log.url).host}</div>
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* Right Panel: Detail Viewer */}
                    <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
                        {!selectedLog ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 opacity-50">
                                <i className="fa-solid fa-code-compare text-5xl"></i>
                                <p className="text-sm font-medium">Select a request to view details</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-6">
                                {/* Header Action */}
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-black px-2 py-1 rounded method-${selectedLog.method}`}>{selectedLog.method}</span>
                                        <div className="font-mono text-sm font-medium text-gray-800 dark:text-gray-200 break-all">{selectedLog.url}</div>
                                    </div>
                                </div>

                                {/* Request Section */}
                                <div className="mb-6">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><i className="fa-solid fa-arrow-right-to-bracket"></i> Request</h4>
                                    
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 mb-3">
                                        <h5 className="text-[10px] font-bold text-gray-400 mb-2">HEADERS</h5>
                                        <div className="font-mono text-xs text-gray-700 dark:text-gray-300 space-y-1">
                                            {Object.entries(selectedLog.reqHeaders || {}).map(([k, v]) => (
                                                <div key={k}><span className="font-bold text-blue-600 dark:text-blue-400">{k}:</span> {v}</div>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedLog.reqBody && (
                                        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                                            <h5 className="text-[10px] font-bold text-gray-400 mb-2">BODY</h5>
                                            <pre className="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">{selectedLog.reqBody}</pre>
                                        </div>
                                    )}
                                </div>

                                {/* Response Section */}
                                <div className="mb-6">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><i className="fa-solid fa-arrow-right-from-bracket"></i> Response <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${selectedLog.status >= 200 && selectedLog.status < 300 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{selectedLog.status}</span></h4>
                                    
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 mb-3">
                                        <h5 className="text-[10px] font-bold text-gray-400 mb-2">HEADERS</h5>
                                        <div className="font-mono text-xs text-gray-700 dark:text-gray-300 space-y-1 overflow-x-auto">
                                            {Object.entries(selectedLog.resHeaders || {}).map(([k, v]) => (
                                                <div key={k}><span className="font-bold text-purple-600 dark:text-purple-400">{k}:</span> {v}</div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                                        <h5 className="text-[10px] font-bold text-gray-400 mb-2">BODY</h5>
                                        <pre className="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-96 overflow-y-auto custom-scrollbar">{selectedLog.resBody || 'No Response Body'}</pre>
                                    </div>
                                </div>

                                {/* Save to Workspace Action */}
                                <div className="mt-auto pt-6 border-t border-gray-200 dark:border-slate-700">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Save Intercepted Request</h4>
                                    <div className="flex items-end gap-3 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Target Folder</label>
                                            <select value={saveFolderId} onChange={e => setSaveFolderId(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                                                <option value="">Root (No Folder)</option>
                                                {safeFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Request Name</label>
                                            <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder={`Intercepted ${selectedLog.method}`} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        </div>
                                        <button onClick={saveRequestToWorkspace} className="px-6 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-md transition-colors h-[34px] flex items-center gap-2">
                                            <i className="fa-solid fa-cloud-arrow-up"></i> Save to Workspace
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Alert Modal */}
            {alertConfig.isOpen && (
                <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/40 p-4 m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${alertConfig.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><i className={`fa-solid ${alertConfig.type === 'success' ? 'fa-check' : 'fa-times'}`}></i></div>
                            <h3 className="text-sm font-bold">{alertConfig.type === 'success' ? 'Success' : 'Error'}</h3>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">{alertConfig.message}</p>
                        <div className="flex justify-end"><button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded">Okay</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
