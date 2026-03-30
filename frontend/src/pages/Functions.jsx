import React, { useState, useEffect } from 'react';
import { ApiService } from '../utils/api';

export default function Functions({ activeWorkspaceId }) {
    const [functions, setFunctions] = useState([]);
    const [currentFn, setCurrentFn] = useState(null);
    const [search, setSearch] = useState('');
    
    // Test Output States
    const [testResult, setTestResult] = useState('');
    const [testStatus, setTestStatus] = useState(null); // 'success' | 'error' | null

    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

    const showAlert = (message, type = 'info', title = '') => setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : 'Info') });

    useEffect(() => {
        if (activeWorkspaceId) loadFunctions();
    }, [activeWorkspaceId]);

    const loadFunctions = async () => {
        try {
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/workspaces/${activeWorkspaceId}/functions`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setFunctions(data);
            }
        } catch (e) {
            showAlert('Failed to load functions', 'error');
        }
    };

    const handleNew = () => {
        setCurrentFn({
            id: null,
            name: 'newFunction',
            script: '// Tulis script JavaScript Anda di sini.\n// Gunakan return untuk mengembalikan nilai ke variabel.\n// Objek `variables` tersedia untuk membaca Env/Global vars.\n\nconst timestamp = Date.now();\nreturn `DATA-${timestamp}`;\n'
        });
        setTestResult('');
        setTestStatus(null);
    };

    const handleSave = async () => {
        if (!currentFn.name.trim()) return showAlert('Function name is required', 'warning');
        try {
            const token = localStorage.getItem('rf_token');
            const payload = { name: currentFn.name.trim(), script: currentFn.script };
            let res;
            
            if (currentFn.id) {
                res = await fetch(`/api/workspaces/${activeWorkspaceId}/functions/${currentFn.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch(`/api/workspaces/${activeWorkspaceId}/functions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error('Failed to save function (Name might already exist)');
            const data = await res.json();
            if (!currentFn.id) setCurrentFn({ ...currentFn, id: data.id });
            
            loadFunctions();
            showAlert('Function saved successfully!', 'success');
        } catch (e) {
            showAlert(e.message, 'error');
        }
    };

    const handleDeleteTrigger = (id) => {
        setConfirmConfig({
            isOpen: true,
            message: 'Are you sure you want to delete this function? Any request using {{fn:name}} will break.',
            onConfirm: () => executeDelete(id)
        });
    };

    const executeDelete = async (id) => {
        try {
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/workspaces/${activeWorkspaceId}/functions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to delete function');
            
            if (currentFn?.id === id) setCurrentFn(null);
            loadFunctions();
            showAlert('Function deleted', 'success');
        } catch (e) {
            showAlert(e.message, 'error');
        }
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    const testFunction = async () => {
        if (!currentFn || !currentFn.script) return;
        setTestStatus(null);
        setTestResult('Running...');
        
        try {
            // Ambil Global/Env Variables untuk disimulasikan ke dalam fungsi
            const token = localStorage.getItem('rf_token');
            let varsObj = {};
            try {
                const varsRes = await ApiService.getVariables(activeWorkspaceId);
                varsRes.forEach(v => { varsObj[v.var_key] = v.var_value; });
                
                const activeEnvId = localStorage.getItem(`rf_env_${activeWorkspaceId}`);
                if (activeEnvId) {
                    const envVarRes = await fetch(`/api/environments/${activeEnvId}/variables`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (envVarRes.ok) {
                        const envVars = await envVarRes.json();
                        envVars.forEach(ev => { varsObj[ev.var_key] = ev.var_value; });
                    }
                }
            } catch(e) {}

            // Eksekusi Fungsi dengan AsyncFunction
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const func = new AsyncFunction('variables', currentFn.script);
            
            const result = await func(varsObj);
            
            setTestStatus('success');
            if (result === undefined) setTestResult('undefined (Did you forget to use return?)');
            else if (typeof result === 'object') setTestResult(JSON.stringify(result, null, 2));
            else setTestResult(String(result));

        } catch (e) {
            setTestStatus('error');
            setTestResult(e.toString());
        }
    };

    const filteredList = functions.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex-grow flex overflow-hidden w-full h-full relative bg-gray-50 dark:bg-slate-900">
            
            {/* Sidebar Kiri: List of Functions */}
            <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col shrink-0 z-10 h-full">
                <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200"><i className="fa-solid fa-puzzle-piece text-indigo-500 mr-2"></i> Functions</h3>
                    <button onClick={handleNew} className="p-1.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 rounded hover:bg-indigo-200 transition-colors">
                        <i className="fa-solid fa-plus text-xs"></i>
                    </button>
                </div>
                <div className="p-2 border-b border-gray-200 dark:border-slate-700 shrink-0">
                    <div className="relative">
                        <i className="fa-solid fa-search absolute left-2.5 top-2 text-gray-400 text-xs"></i>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded outline-none focus:border-indigo-500" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {filteredList.length === 0 && <div className="text-center p-4 text-xs text-gray-400 italic">No functions found.</div>}
                    {filteredList.map(f => (
                        <div key={f.id} onClick={() => { setCurrentFn(f); setTestResult(''); setTestStatus(null); }} className={`p-2 rounded cursor-pointer transition-colors group border-l-2 ${currentFn?.id === f.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-400' : 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                            <div className="flex justify-between items-center">
                                <div className="font-mono text-xs truncate flex-1 font-bold">
                                    <span className="text-gray-400 font-normal">fn:</span>{f.name}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteTrigger(f.id); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"><i className="fa-solid fa-trash text-[10px]"></i></button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Panel Kanan: Editor */}
            <main className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-slate-900">
                {currentFn ? (
                    <>
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/30 shrink-0">
                            <div className="flex items-center gap-3 w-1/2">
                                <span className="font-mono text-gray-500 font-bold bg-gray-200 dark:bg-slate-700 px-2 py-1 rounded text-xs shrink-0">&#123;&#123;fn:</span>
                                <input 
                                    type="text" 
                                    value={currentFn.name} 
                                    onChange={e => setCurrentFn({...currentFn, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})} 
                                    placeholder="functionName" 
                                    className="font-mono font-bold text-base bg-transparent border-b border-dashed border-gray-400 outline-none focus:border-indigo-500 w-full text-gray-800 dark:text-gray-200" 
                                />
                                <span className="font-mono text-gray-500 font-bold bg-gray-200 dark:bg-slate-700 px-2 py-1 rounded text-xs shrink-0">&#125;&#125;</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={testFunction} className="px-4 py-1.5 text-sm font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg transition-colors flex items-center gap-2"><i className="fa-solid fa-play"></i> Test Function</button>
                                <button onClick={handleSave} className="px-4 py-1.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"><i className="fa-solid fa-save"></i> Save Function</button>
                            </div>
                        </div>
                        
                        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4">
                            <div className="flex-1 flex flex-col border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                                    <span><i className="fa-brands fa-js text-yellow-500 mr-1"></i> JavaScript Code</span>
                                    <span className="font-normal text-[10px] text-gray-400">Context available: <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded">variables</code></span>
                                </div>
                                <textarea 
                                    value={currentFn.script} 
                                    onChange={e => setCurrentFn({...currentFn, script: e.target.value})} 
                                    className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 outline-none resize-none code-scrollbar"
                                    spellCheck="false"
                                />
                            </div>

                            <div className="h-40 shrink-0 flex flex-col border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700">
                                    <i className="fa-solid fa-terminal mr-1"></i> Test Output
                                </div>
                                <div className={`flex-1 p-3 overflow-y-auto scroll-custom font-mono text-xs ${testStatus === 'error' ? 'bg-red-50 dark:bg-red-900/10 text-red-600' : testStatus === 'success' ? 'bg-white dark:bg-slate-950 text-emerald-600' : 'bg-gray-50 dark:bg-slate-900 text-gray-500 italic'}`}>
                                    {testResult || 'Click "Test Function" to see the return value here.'}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <i className="fa-solid fa-puzzle-piece text-5xl mb-4 opacity-20"></i>
                        <p className="text-sm font-medium">Select a function from the sidebar or create a new one.</p>
                        <p className="text-xs mt-2 opacity-70">Functions allow you to run dynamic JavaScript generating values for your requests.</p>
                    </div>
                )}
            </main>

            {/* Alert & Confirm Modals */}
            {alertConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5 transform transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                alertConfig.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                alertConfig.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                alertConfig.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                                'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            }`}><i className={`fa-solid ${alertConfig.type === 'success' ? 'fa-check' : alertConfig.type === 'warning' ? 'fa-exclamation' : 'fa-times'}`}></i></div>
                            <h3 className="text-lg font-semibold">{alertConfig.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 border-l-4 pl-3 py-1 border-gray-300">{alertConfig.message}</p>
                        <div className="flex justify-end"><button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md">Okay</button></div>
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
                            <button onClick={confirmConfig.onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md">Yes, delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
