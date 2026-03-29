import React, { useState, useEffect } from 'react';
import ResponsePane from './ResponsePane';

export default function RequestEditor({
    currentRequest, setCurrentRequest, foldersList, responseState,
    sendRequest, handleSaveRequest, handleDeleteRequest,
    setSidebarOpen, setImportModalOpen, showAlert
}) {
    const [activeTab, setActiveTab] = useState('params');
    
    // SNIPPET STATE
    const [showSnippetModal, setShowSnippetModal] = useState(false);
    const [snippetTarget, setSnippetTarget] = useState('curl');
    const [snippetCode, setSnippetCode] = useState('');
    const [snippetLoading, setSnippetLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // MONITOR STATE
    const [showMonitorModal, setShowMonitorModal] = useState(false);
    const [monitorModalTab, setMonitorModalTab] = useState('list');
    const [monitors, setMonitors] = useState([]);
    const [cronSchedule, setCronSchedule] = useState('0 * * * *');
    const [monitorName, setMonitorName] = useState('');
    const [isSavingMonitor, setIsSavingMonitor] = useState(false);
    
    // STATE UNTUK HISTORY MONITOR
    const [expandedMonitorId, setExpandedMonitorId] = useState(null);
    const [monitorHistories, setMonitorHistories] = useState([]);
    const [loadingMonitorHistory, setLoadingMonitorHistory] = useState(false);

    // COMMENTS STATE
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    const fetchComments = async () => {
        if (!currentRequest?.id) return;
        setLoadingComments(true);
        try {
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/requests/${currentRequest.id}/comments`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error("Gagal mengambil komentar");
            const text = await res.text();
            if (text) {
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data)) setComments(data);
                } catch (e) { console.error("Komentar bukan JSON", e); }
            }
        } catch (e) { console.error('Failed to fetch comments', e); } finally { setLoadingComments(false); }
    };

    const submitComment = async () => {
        if (!newComment.trim() || !currentRequest?.id) return;
        try {
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/requests/${currentRequest.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: newComment.trim() })
            });
            if (res.ok) { setNewComment(''); fetchComments(); } else throw new Error("Gagal menyimpan komentar");
        } catch (e) { if(typeof showAlert === 'function') showAlert('Gagal mengirim komentar', 'error'); }
    };

    useEffect(() => { if (activeTab === 'comments' && currentRequest?.id) fetchComments(); }, [activeTab, currentRequest?.id]);

    const fetchMonitors = async () => {
        try {
            const wsId = localStorage.getItem('rf_active_workspace');
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/workspaces/${wsId}/monitors`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setMonitors(data);
            }
        } catch(e) {}
    };

    useEffect(() => { if (showMonitorModal) fetchMonitors(); }, [showMonitorModal]);

    const handleSaveMonitor = async () => {
        setIsSavingMonitor(true);
        try {
            const wsId = localStorage.getItem('rf_active_workspace');
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/workspaces/${wsId}/monitors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: monitorName || `Monitor: ${currentRequest?.name || 'Request'}`, folder_id: currentRequest?.folder_id || null, schedule_cron: cronSchedule, is_active: true })
            });
            if(!res.ok) throw new Error("Format Cron tidak valid");
            setMonitorModalTab('list'); fetchMonitors();
            if(typeof showAlert === 'function') showAlert('Cron Job Monitor berhasil didaftarkan!', 'success');
        } catch (e) { if(typeof showAlert === 'function') showAlert(e.message, 'error'); } finally { setIsSavingMonitor(false); }
    };

    const handleDeleteMonitor = async (monitorId) => {
        if (!window.confirm("Yakin ingin menghapus jadwal monitor ini?")) return;
        try {
            const wsId = localStorage.getItem('rf_active_workspace');
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/workspaces/${wsId}/monitors/${monitorId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if(res.ok) { fetchMonitors(); if(typeof showAlert === 'function') showAlert('Monitor berhasil dihapus', 'success'); } 
            else throw new Error("Gagal menghapus monitor");
        } catch(e) { if(typeof showAlert === 'function') showAlert(e.message, 'error'); }
    };

    // FUNGSI BARU: TOGGLE & FETCH HISTORI MONITOR (10 Terakhir)
    const toggleMonitorHistory = async (monitorId) => {
        if (expandedMonitorId === monitorId) {
            setExpandedMonitorId(null);
            return;
        }
        setExpandedMonitorId(monitorId);
        setLoadingMonitorHistory(true);
        try {
            const wsId = localStorage.getItem('rf_active_workspace');
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/workspaces/${wsId}/monitors/${monitorId}/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMonitorHistories(data);
            }
        } catch(e) {} finally {
            setLoadingMonitorHistory(false);
        }
    };

    const generateSnippet = async (lang) => {
        setSnippetLoading(true);
        try {
            const token = localStorage.getItem('rf_token');
            const safeHeaders = Array.isArray(currentRequest?.headers) ? currentRequest.headers : [];
            const res = await fetch(`/api/generate-snippet`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    target: lang,
                    request: { url: currentRequest?.url || '', method: currentRequest?.method || 'GET', headers: JSON.stringify(safeHeaders.filter(h => h.key && h.key.trim() !== '')), bodyType: currentRequest?.bodyType || 'none', body: currentRequest?.body || '' }
                })
            });
            const data = await res.json();
            setSnippetCode(data.snippet || '// Failed to generate snippet'); setCopied(false);
        } catch (e) { setSnippetCode('// Error connecting to snippet generator: ' + e.message); } finally { setSnippetLoading(false); }
    };

    useEffect(() => { if (showSnippetModal) generateSnippet(snippetTarget); }, [showSnippetModal, snippetTarget]);

    const copyToClipboard = () => { navigator.clipboard.writeText(snippetCode); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    const addNewRow = (field) => {
        if(!currentRequest) return;
        const list = [...(currentRequest[field] || [])];
        let newRow = { key: '', value: '' };
        if (field === 'formData') newRow = { key: '', value: '', type: 'text', file: null };
        if (field === 'assertions') newRow = { type: 'status', operator: 'equals', value: '' };
        list.push(newRow);
        setCurrentRequest(prev => ({ ...prev, [field]: list }));
    };

    const updateList = (field, index, subfield, value) => {
        if(!currentRequest) return;
        const list = [...(currentRequest[field] || [])];
        if (!list[index]) return;
        list[index][subfield] = value;
        if (index === list.length - 1 && value.trim() !== '') {
            let newRow = { key: '', value: '' };
            if (field === 'formData') newRow = { key: '', value: '', type: 'text', file: null };
            if (field === 'assertions') newRow = { type: 'status', operator: 'equals', value: '' };
            list.push(newRow);
        }
        setCurrentRequest(prev => ({ ...prev, [field]: list }));
        if (field === 'params') setTimeout(syncParamsToUrl, 10);
    };

    const removeListItem = (field, index) => {
        if(!currentRequest) return;
        const list = [...(currentRequest[field] || [])];
        list.splice(index, 1);
        if (list.length === 0) {
            let newRow = { key: '', value: '' };
            if (field === 'formData') newRow = { key: '', value: '', type: 'text', file: null };
            if (field === 'assertions') newRow = { type: 'status', operator: 'equals', value: '' };
            list.push(newRow);
        }
        setCurrentRequest(prev => ({ ...prev, [field]: list }));
        if (field === 'params') setTimeout(syncParamsToUrl, 10);
    };

    const syncUrlToParams = (urlString) => {
        setCurrentRequest(prev => {
            const parts = urlString.split('?'); const params = [];
            if (parts.length > 1) {
                const queryString = parts.slice(1).join('?');
                const searchParams = new URLSearchParams(queryString);
                for (const [key, value] of searchParams.entries()) params.push({ key, value });
            }
            if (params.length === 0) params.push({ key: '', value: '' });
            return { ...prev, url: urlString, params };
        });
    };

    const syncParamsToUrl = () => {
        setCurrentRequest(prev => {
            if (!prev.url) return prev;
            let baseUrl = prev.url.split('?')[0]; const queryParts = [];
            (prev.params || []).forEach(p => {
                if (p.key) {
                    let k = encodeURIComponent(p.key).replace(/%7B/g, '{').replace(/%7D/g, '}');
                    let v = encodeURIComponent(p.value).replace(/%7B/g, '{').replace(/%7D/g, '}');
                    queryParts.push(`${k}=${v}`);
                }
            });
            const newUrl = queryParts.length > 0 ? `${baseUrl}?${queryParts.join('&')}` : baseUrl;
            return { ...prev, url: newUrl };
        });
    };

    const handleFileUpload = (e, index) => { if (e.target.files.length > 0) updateList('formData', index, 'file', e.target.files[0]); };

    const exportRequest = () => {
        if (!currentRequest?.url) return showAlert ? showAlert('URL is missing.', 'warning') : alert('Empty Request');
        
        let finalBody = currentRequest.body;
        const safeFormData = Array.isArray(currentRequest.formData) ? currentRequest.formData : [];
        const safeUrlencoded = Array.isArray(currentRequest.urlencoded) ? currentRequest.urlencoded : [];
        const safeHeaders = Array.isArray(currentRequest.headers) ? currentRequest.headers : [];
        const safeAssertions = Array.isArray(currentRequest.assertions) ? currentRequest.assertions : [];

        if (currentRequest.bodyType === 'form-data') finalBody = JSON.stringify(safeFormData.filter(f => f.key.trim() !== ''));
        else if (currentRequest.bodyType === 'urlencoded') finalBody = JSON.stringify(safeUrlencoded.filter(f => f.key.trim() !== ''));

        const data = {
            version: "1.0", type: "request",
            request: {
                name: currentRequest.name, method: currentRequest.method, url: currentRequest.url,
                headers: safeHeaders.filter(h => h.key.trim() !== ''),
                bodyType: currentRequest.bodyType, body: finalBody, authorization: currentRequest.authorization,
                pre_request_script: currentRequest.pre_request_script, post_request_script: currentRequest.post_request_script,
                assertions: safeAssertions.filter(a => a.value.trim() !== ''), description: currentRequest.description
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `request-${currentRequest.name.replace(/\s+/g, '-')}.json`; a.click(); URL.revokeObjectURL(url);
    };

    const safeFolders = Array.isArray(foldersList) ? foldersList : [];

    return (
        <main className="flex-grow flex flex-col bg-white dark:bg-slate-900 min-w-0 h-full overflow-hidden">
            <div className="p-2 md:p-3 border-b border-gray-200 dark:border-slate-700 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-gray-50/50 dark:bg-slate-800/30 shrink-0">
                <div className="flex items-center gap-2 w-full min-w-0 flex-grow">
                    <button onClick={() => { if(typeof setSidebarOpen==='function') setSidebarOpen(true); }} className="md:hidden px-3 py-1.5 text-sm font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-2 shrink-0 shadow-sm">
                        <i className="fa-solid fa-folder-tree"></i> <span>Collections</span>
                    </button>

                    <div className="flex items-center flex-grow bg-white dark:bg-slate-800 md:bg-transparent md:dark:bg-transparent border border-gray-200 dark:border-slate-700 md:border-transparent md:hover:bg-gray-100 md:dark:hover:bg-slate-800 focus-within:border-blue-500 rounded-lg md:rounded px-2 py-1 md:py-0 group cursor-text shadow-sm md:shadow-none min-w-0 overflow-hidden">
                        <div className="relative flex items-center shrink-0">
                            <select value={currentRequest?.folder_id || ''} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({ ...p, folder_id: e.target.value ? parseInt(e.target.value) : null })); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                                <option value="">Root</option>
                                {safeFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <span className="text-gray-500 dark:text-gray-400 hover:text-blue-600 font-semibold text-sm md:text-base whitespace-nowrap pr-1 group-hover:text-blue-500 transition-colors">
                                {currentRequest?.folder_id ? safeFolders.find(f => f.id === currentRequest.folder_id)?.name || 'Root' : 'Root'} /
                            </span>
                        </div>
                        <input type="text" value={currentRequest?.name || ''} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, name: e.target.value})); }} placeholder="Untitled Request" className="bg-transparent font-bold text-base md:text-lg border-none outline-none py-0.5 w-full min-w-[50px] text-ellipsis text-gray-800 dark:text-gray-100" />
                    </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap">
                    <button onClick={() => setActiveTab('docs')} className="px-3 py-1.5 text-sm font-medium border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-book"></i> <span className="hidden md:inline">Docs</span>
                    </button>
                    <button onClick={() => setShowMonitorModal(true)} className="px-3 py-1.5 text-sm font-medium border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-clock"></i> <span className="hidden md:inline">Monitor</span>
                    </button>
                    <button onClick={() => setShowSnippetModal(true)} className="px-3 py-1.5 text-sm font-medium border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-code"></i> <span className="hidden md:inline">Snippet</span>
                    </button>
                    <button onClick={() => { if(typeof setImportModalOpen==='function') setImportModalOpen(true); }} className="px-3 py-1.5 text-sm font-medium border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-import"></i> <span className="hidden md:inline">Import</span>
                    </button>
                    <button onClick={exportRequest} className="px-3 py-1.5 text-sm font-medium border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-export"></i> <span className="hidden md:inline">Export</span>
                    </button>
                    
                    {currentRequest?.id && (
                        <button onClick={() => { if(typeof handleDeleteRequest==='function') handleDeleteRequest(); }} className="px-3 py-1.5 text-sm font-medium bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/50 rounded-lg transition-colors">
                            <i className="fa-solid fa-trash"></i>
                        </button>
                    )}
                    <button onClick={() => { if(typeof handleSaveRequest==='function') handleSaveRequest(); }} className="px-4 py-1.5 font-medium bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-save"></i> Save
                    </button>
                </div>
            </div>

            <div className="p-2 md:p-4 border-b border-gray-200 dark:border-slate-700 shrink-0 w-full overflow-hidden bg-white dark:bg-slate-900">
                <form onSubmit={sendRequest} className="flex flex-col md:flex-row gap-2 w-full">
                    <div className="flex w-full flex-grow min-w-0 gap-2">
                        <select value={currentRequest?.method || 'GET'} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, method: e.target.value})); }} className={`w-24 shrink-0 font-bold bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm method-${currentRequest?.method || 'GET'}`}>
                            <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="PATCH">PATCH</option><option value="DELETE">DELETE</option>
                        </select>
                        <input type="text" required value={currentRequest?.url || ''} onChange={e => syncUrlToParams(e.target.value)} placeholder="https://api.example.com/endpoint" className="w-full min-w-0 flex-grow bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
                    </div>
                    <button type="submit" disabled={responseState?.loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md shadow-blue-500/30 transition-colors flex items-center justify-center gap-2">
                        {responseState?.loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-paper-plane text-sm"></i> Send</>}
                    </button>
                </form>
            </div>

            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="flex-1 border-b border-gray-200 dark:border-slate-700 flex flex-col min-h-[40%] overflow-hidden">
                    <div className="flex border-b border-gray-200 dark:border-slate-700 px-4 pt-2 gap-4 shrink-0 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900">
                        {['params', 'authorization', 'headers', 'body', 'scripts', 'assertions', 'docs', 'comments'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 text-sm whitespace-nowrap transition-colors ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="flex-grow overflow-y-auto bg-gray-50/30 dark:bg-slate-900/50 p-4 pb-12 custom-scrollbar">
                        {activeTab === 'docs' && (
                            <div className="h-full flex flex-col">
                                <span className="text-xs mb-2 font-bold text-gray-600 dark:text-gray-300"><i className="fa-brands fa-markdown text-blue-500 mr-1"></i> Documentation (Markdown Supported)</span>
                                <textarea value={currentRequest?.description || ''} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, description: e.target.value})); }} className="flex-grow w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded p-4 font-sans text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write details, guides, or notes about this API endpoint here... (Click Save to store in DB)"></textarea>
                            </div>
                        )}

                        {activeTab === 'comments' && (
                            <div className="h-full flex flex-col">
                                {currentRequest?.id ? (
                                    <>
                                        <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-3 custom-scrollbar">
                                            {loadingComments ? (
                                                <div className="text-center py-10 text-gray-500"><i className="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>
                                            ) : comments.length === 0 ? (
                                                <div className="text-center py-10 text-gray-400 dark:text-gray-500 italic">Belum ada diskusi untuk request ini. Mulai percakapan tim!</div>
                                            ) : (
                                                comments.map(c => (
                                                    <div key={c.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-lg shadow-sm">
                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <span className="font-bold text-xs text-blue-600 dark:text-blue-400"><i className="fa-solid fa-user-circle mr-1"></i> {c.username}</span>
                                                            <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.content}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="flex gap-2 shrink-0 border-t border-gray-200 dark:border-slate-700 pt-3">
                                            <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} placeholder="Ketik komentar..." className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                            <button onClick={submitComment} disabled={!newComment.trim() || loadingComments} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 transition-colors shadow-sm"><i className="fa-solid fa-paper-plane"></i></button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col h-full items-center justify-center text-gray-400 gap-3 py-10">
                                        <i className="fa-regular fa-comments text-4xl mb-2"></i>
                                        <p className="text-sm text-center px-4">Silakan 'Save' request ini terlebih dahulu untuk memulai diskusi tim.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'params' && (
                            <div>
                                {(currentRequest?.params || []).map((param, i) => (
                                    <div key={i} className="flex gap-2 items-center mb-2">
                                        <input type="text" placeholder="Key" value={param.key} onChange={e => updateList('params', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <input type="text" placeholder="Value" value={param.value} onChange={e => updateList('params', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <button type="button" onClick={() => removeListItem('params', i)} className="p-1.5 text-gray-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addNewRow('params')} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"><i className="fa-solid fa-plus text-xs"></i> Add Parameter</button>
                            </div>
                        )}
                        
                        {activeTab === 'headers' && (
                            <div>
                                {(currentRequest?.headers || []).map((h, i) => (
                                    <div key={i} className="flex gap-2 items-center mb-2">
                                        <input type="text" placeholder="Key" value={h.key} onChange={e => updateList('headers', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <input type="text" placeholder="Value" value={h.value} onChange={e => updateList('headers', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <button type="button" onClick={() => removeListItem('headers', i)} className="p-1.5 text-gray-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addNewRow('headers')} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"><i className="fa-solid fa-plus text-xs"></i> Add Header</button>
                            </div>
                        )}
                        
                        {activeTab === 'authorization' && currentRequest?.authorization && (
                            <div>
                                <select value={currentRequest.authorization.type} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, authorization: {...p.authorization, type: e.target.value}})); }} className="mb-4 w-full md:w-1/2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                                    <option value="none">No Auth</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="apikey">API Key</option>
                                </select>
                                
                                {currentRequest.authorization.type === 'bearer' && (
                                    <input type="text" placeholder="Token" value={currentRequest.authorization.token} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, authorization: {...p.authorization, token: e.target.value}})); }} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" />
                                )}
                                {currentRequest.authorization.type === 'basic' && (
                                    <div className="space-y-2">
                                        <input type="text" placeholder="Username" value={currentRequest.authorization.username} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, authorization: {...p.authorization, username: e.target.value}})); }} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                        <input type="password" placeholder="Password" value={currentRequest.authorization.password} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, authorization: {...p.authorization, password: e.target.value}})); }} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                    </div>
                                )}
                                {currentRequest.authorization.type === 'apikey' && (
                                    <div className="space-y-2">
                                        <input type="text" placeholder="Key" value={currentRequest.authorization.apikey} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, authorization: {...p.authorization, apikey: e.target.value}})); }} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
                                        <input type="text" placeholder="Value" value={currentRequest.authorization.apivalue} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, authorization: {...p.authorization, apivalue: e.target.value}})); }} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
                                        <select value={currentRequest.authorization.addto} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, authorization: {...p.authorization, addto: e.target.value}})); }} className="w-full md:w-1/2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                                            <option value="header">Header</option><option value="query">Query Params</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'body' && (
                            <div className="flex flex-col h-full">
                                <div className="flex gap-4 mb-3 flex-wrap">
                                    {['none', 'json', 'form-data', 'urlencoded', 'xml', 'text', 'html'].map(t => (
                                        <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                            <input type="radio" name="bodyType" value={t} checked={currentRequest?.bodyType === t} onChange={e => {
                                                if(typeof setCurrentRequest==='function') {
                                                    setCurrentRequest(p => ({...p, bodyType: e.target.value}));
                                                    if(e.target.value === 'json' && currentRequest.headers) {
                                                        updateList('headers', currentRequest.headers.length-1, 'key', 'Content-Type'); 
                                                        updateList('headers', currentRequest.headers.length-1, 'value', 'application/json');
                                                    }
                                                }
                                            }} className="cursor-pointer accent-blue-600" /> 
                                            <span className={currentRequest?.bodyType === t ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}>{t}</span>
                                        </label>
                                    ))}
                                </div>
                                
                                {['json', 'xml', 'text', 'html'].includes(currentRequest?.bodyType) && (
                                    <textarea value={currentRequest?.body || ''} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, body: e.target.value})); }} className="flex-grow w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded p-3 font-mono text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px]" placeholder={`Enter your ${currentRequest.bodyType} payload here...`}></textarea>
                                )}
                                
                                {currentRequest?.bodyType === 'form-data' && (
                                    <div className="space-y-2 flex-grow overflow-y-auto pr-1">
                                        {(currentRequest.formData || []).map((item, i) => (
                                            <div key={i} className="flex gap-2 items-center mb-2">
                                                <input type="text" placeholder="Key" value={item.key} onChange={e => updateList('formData', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                <select value={item.type} onChange={e => { updateList('formData', i, 'type', e.target.value); updateList('formData', i, 'value', ''); updateList('formData', i, 'file', null); }} className="w-20 md:w-24 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-1 py-1.5 text-sm outline-none focus:border-blue-500">
                                                    <option value="text">Text</option><option value="file">File</option>
                                                </select>
                                                {item.type === 'file' ? (
                                                    <input type="file" onChange={(e) => handleFileUpload(e, i)} className="flex-1 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-blue-400 dark:hover:file:bg-slate-600 w-full overflow-hidden" />
                                                ) : (
                                                    <input type="text" placeholder="Value" value={item.value} onChange={e => updateList('formData', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                )}
                                                <button type="button" onClick={() => removeListItem('formData', i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addNewRow('formData')} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"><i className="fa-solid fa-plus text-xs"></i> Add Form Data</button>
                                    </div>
                                )}
                                
                                {currentRequest?.bodyType === 'urlencoded' && (
                                    <div className="space-y-2 flex-grow overflow-y-auto pr-1">
                                        {(currentRequest.urlencoded || []).map((param, i) => (
                                            <div key={i} className="flex gap-2 items-center mb-2">
                                                <input type="text" placeholder="Key" value={param.key} onChange={e => updateList('urlencoded', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                <input type="text" placeholder="Value" value={param.value} onChange={e => updateList('urlencoded', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                <button type="button" onClick={() => removeListItem('urlencoded', i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addNewRow('urlencoded')} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"><i className="fa-solid fa-plus text-xs"></i> Add Url-Encoded</button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* SCRIPTS TAB */}
                        {activeTab === 'scripts' && (
                            <div className="space-y-4 h-full flex flex-col">
                                <div className="flex-1 flex flex-col min-h-[120px]">
                                    <span className="text-xs mb-1 font-bold text-gray-600 dark:text-gray-300">Pre-request Script (Executed before sending)</span>
                                    <textarea value={currentRequest?.pre_request_script || ''} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, pre_request_script: e.target.value})); }} className="flex-grow w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded p-3 font-mono text-xs resize-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="request.headers.push({key: 'X-Time', value: Date.now()});"></textarea>
                                </div>
                                <div className="flex-1 flex flex-col min-h-[120px]">
                                    <span className="text-xs mb-1 font-bold text-gray-600 dark:text-gray-300">Post-request Script (Executed after response)</span>
                                    <textarea value={currentRequest?.post_request_script || ''} onChange={e => { if(typeof setCurrentRequest==='function') setCurrentRequest(p => ({...p, post_request_script: e.target.value})); }} className="flex-grow w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded p-3 font-mono text-xs resize-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="if (response.status === 200) { variables['token'] = response.data.token; }"></textarea>
                                </div>
                            </div>
                        )}
                        
                        {/* ASSERTIONS TAB */}
                        {activeTab === 'assertions' && (
                            <div>
                                {(currentRequest?.assertions || []).map((a, i) => (
                                    <div key={i} className="flex gap-2 items-center mb-2">
                                        <select value={a.type} onChange={e => updateList('assertions', i, 'type', e.target.value)} className="w-1/3 min-w-[100px] bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                                            <option value="status">Status Code</option><option value="time">Response Time (ms)</option><option value="body">Response Body</option><option value="header">Response Header</option>
                                        </select>
                                        <select value={a.operator} onChange={e => updateList('assertions', i, 'operator', e.target.value)} className="w-1/3 min-w-[100px] bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                                            <option value="equals">Equals</option><option value="not_equals">Not Equals</option><option value="contains">Contains</option><option value="not_contains">Not Contains</option><option value="less_than">Less Than</option><option value="greater_than">More Than</option>
                                        </select>
                                        <input type="text" placeholder="Value" value={a.value} onChange={e => updateList('assertions', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <button type="button" onClick={() => removeListItem('assertions', i)} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addNewRow('assertions')} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"><i className="fa-solid fa-plus text-xs"></i> Add Assertion</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-[45%] min-h-[250px] flex flex-col overflow-hidden bg-gray-50 dark:bg-slate-850 border-t border-gray-200 dark:border-slate-700">
                    <ResponsePane responseState={responseState} />
                </div>
            </div>

            {/* --- MODAL API MONITOR CRON --- */}
            {showMonitorModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-850 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 flex flex-col max-h-[80vh]">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800 shrink-0">
                            <div className="flex gap-4">
                                <button onClick={() => setMonitorModalTab('list')} className={`font-bold text-sm flex items-center gap-2 pb-1 border-b-2 transition-colors ${monitorModalTab === 'list' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                                    <i className="fa-solid fa-list"></i> Riwayat Monitor
                                </button>
                                <button onClick={() => setMonitorModalTab('create')} className={`font-bold text-sm flex items-center gap-2 pb-1 border-b-2 transition-colors ${monitorModalTab === 'create' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                                    <i className="fa-solid fa-plus"></i> Buat Jadwal Baru
                                </button>
                            </div>
                            <button onClick={() => setShowMonitorModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        
                        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                            {monitorModalTab === 'create' ? (
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                                        Setel jadwal otomatis (Cron) agar API Server menjalankan pengujian (Assertions) pada seluruh Request di dalam Folder <span className="font-bold text-gray-800 dark:text-gray-200">"{safeFolders.find(f => f.id === currentRequest?.folder_id)?.name || 'Root'}"</span> secara berkala.
                                    </p>
                                    <label className="block text-xs font-bold mb-1 dark:text-gray-300">Nama Task Monitor</label>
                                    <input type="text" value={monitorName} onChange={(e) => setMonitorName(e.target.value)} placeholder={`Monitor for ${currentRequest?.name}`} className="w-full mb-4 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                                    
                                    <label className="block text-xs font-bold mb-1 dark:text-gray-300">Cron Schedule</label>
                                    <input type="text" value={cronSchedule} onChange={(e) => setCronSchedule(e.target.value)} placeholder="0 * * * *" className="w-full mb-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 outline-none font-mono focus:ring-2 focus:ring-blue-500" />
                                    <p className="text-[10px] text-gray-400 italic mb-6">*Contoh: "0 * * * *" (Setiap jam), "0 0 * * *" (Setiap tengah malam).</p>
                                    
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowMonitorModal(false)} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors">Batal</button>
                                        <button onClick={handleSaveMonitor} disabled={isSavingMonitor} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2">
                                            {isSavingMonitor ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>} Simpan Jadwal
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {monitors.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400">Belum ada API Monitor yang didaftarkan untuk Workspace ini.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {monitors.map(m => (
                                                <div key={m.id} className="border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 shadow-sm overflow-hidden transition-all">
                                                    
                                                    {/* Header Card Monitor - Click to Expand */}
                                                    <div onClick={() => toggleMonitorHistory(m.id)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                                <i className={`fa-solid fa-chevron-${expandedMonitorId === m.id ? 'down' : 'right'} text-xs text-gray-400 transition-transform`}></i>
                                                                {m.name}
                                                            </h4>
                                                            <div className="flex items-center gap-3 mt-1.5 ml-5">
                                                                <span className="text-[11px] font-mono bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400"><i className="fa-solid fa-clock text-blue-500 mr-1"></i> {m.schedule_cron}</span>
                                                                <span className="text-[11px] text-gray-500">Target Folder: {m.folder_id || 'Root'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <div className="text-[10px] text-gray-400 mb-0.5">Status (Latest)</div>
                                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${m.last_run_status === 'SUCCESS' ? 'bg-green-100 text-green-700' : m.last_run_status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>
                                                                    {m.last_run_status || 'PENDING'}
                                                                </span>
                                                            </div>
                                                            {/* TOMBOL DELETE MONITOR */}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteMonitor(m.id); }} 
                                                                className="p-2 text-gray-400 hover:text-red-500 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md transition-colors"
                                                                title="Hapus Monitor"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Expanded History List */}
                                                    {expandedMonitorId === m.id && (
                                                        <div className="border-t border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h5 className="font-bold text-xs uppercase tracking-wider text-gray-500">10 Riwayat Terakhir</h5>
                                                                <button onClick={(e) => { e.stopPropagation(); fetchMonitors(); toggleMonitorHistory(m.id); }} className="text-xs text-blue-500 hover:text-blue-600"><i className="fa-solid fa-rotate-right"></i> Refresh</button>
                                                            </div>
                                                            
                                                            {loadingMonitorHistory ? (
                                                                <div className="text-center py-4"><i className="fa-solid fa-circle-notch fa-spin text-blue-500"></i></div>
                                                            ) : monitorHistories.length === 0 ? (
                                                                <div className="text-center py-4 text-xs text-gray-400 italic">Belum ada riwayat eksekusi untuk cron ini.</div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {monitorHistories.map((hist, idx) => (
                                                                        <div key={hist.id || idx} className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded border border-gray-100 dark:border-slate-700">
                                                                            <span className="text-xs text-gray-600 dark:text-gray-300 font-mono"><i className="fa-regular fa-calendar text-gray-400 mr-2"></i>{new Date(hist.run_at).toLocaleString()}</span>
                                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${hist.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{hist.status}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL SNIPPET CODE --- */}
            {showSnippetModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-850 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 flex flex-col h-[70vh]">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800 shrink-0">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <i className="fa-solid fa-code text-blue-500"></i> Code Snippet Generator
                            </h3>
                            <button onClick={() => setShowSnippetModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        
                        <div className="flex flex-1 overflow-hidden">
                            <div className="w-40 border-r border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex flex-col p-2 gap-1 overflow-y-auto">
                                {[{ id: 'curl', name: 'cURL' }, { id: 'axios', name: 'NodeJS - Axios' }, { id: 'fetch', name: 'JS - Fetch' }, { id: 'python-requests', name: 'Python - Requests' }].map(lang => (
                                    <button key={lang.id} onClick={() => setSnippetTarget(lang.id)} className={`text-left px-3 py-2 text-xs rounded font-medium transition-colors ${snippetTarget === lang.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700'}`}>
                                        {lang.name}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 bg-slate-900 flex flex-col relative group">
                                {snippetLoading ? (
                                    <div className="flex-1 flex items-center justify-center text-gray-500"><i className="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>
                                ) : (
                                    <>
                                        <button onClick={copyToClipboard} className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white p-2 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            {copied ? <i className="fa-solid fa-check text-green-400"></i> : <i className="fa-regular fa-copy"></i>}
                                        </button>
                                        <textarea readOnly value={snippetCode} className="flex-1 w-full h-full bg-transparent text-gray-300 font-mono text-xs p-4 outline-none resize-none code-scrollbar relative z-0" spellCheck="false" />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
