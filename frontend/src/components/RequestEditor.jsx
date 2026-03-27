import React, { useState } from 'react';
import ResponsePane from './ResponsePane';

export default function RequestEditor({
    currentRequest, setCurrentRequest, foldersList, responseState,
    sendRequest, handleSaveRequest, handleDeleteRequest,
    setSidebarOpen, setImportModalOpen, showAlert
}) {
    const [activeTab, setActiveTab] = useState('params');
    
    const updateList = (field, index, subfield, value) => {
        const list = [...currentRequest[field]];
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
        const list = [...currentRequest[field]];
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
        try {
            const urlObj = new URL(urlString || currentRequest.url);
            const params = [];
            for (const [key, value] of urlObj.searchParams.entries()) params.push({ key, value });
            if (params.length === 0) params.push({ key: '', value: '' });
            setCurrentRequest(prev => ({ ...prev, url: urlString, params }));
        } catch (e) {
            setCurrentRequest(prev => ({ ...prev, url: urlString }));
        }
    };

    const syncParamsToUrl = () => {
        setCurrentRequest(prev => {
            try {
                if (!prev.url) return prev;
                const urlObj = new URL(prev.url);
                urlObj.search = '';
                prev.params.forEach(p => { if (p.key) urlObj.searchParams.append(p.key, p.value); });
                return { ...prev, url: urlObj.toString() };
            } catch(e) { return prev; }
        });
    };

    const handleFileUpload = (e, index) => {
        if (e.target.files.length > 0) {
            updateList('formData', index, 'file', e.target.files[0]);
        }
    };

    const exportRequest = () => {
        if (!currentRequest.url) {
            if (showAlert) return showAlert('Cannot export an empty request. URL is missing.', 'warning');
            return alert('Request is empty');
        }
        
        let finalBody = currentRequest.body;
        
        // Memastikan form-data dan urlencoded ikut diekspor
        if (currentRequest.bodyType === 'form-data') {
            finalBody = JSON.stringify(currentRequest.formData.filter(f => f.key.trim() !== ''));
        } else if (currentRequest.bodyType === 'urlencoded') {
            finalBody = JSON.stringify(currentRequest.urlencoded.filter(f => f.key.trim() !== ''));
        }

        const data = {
            version: "1.0",
            type: "request",
            request: {
                name: currentRequest.name, 
                method: currentRequest.method, 
                url: currentRequest.url,
                headers: currentRequest.headers.filter(h => h.key.trim() !== ''),
                bodyType: currentRequest.bodyType, 
                body: finalBody, 
                authorization: currentRequest.authorization,
                pre_request_script: currentRequest.pre_request_script, 
                post_request_script: currentRequest.post_request_script,
                assertions: currentRequest.assertions.filter(a => a.value.trim() !== '')
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resty-flow-request-${currentRequest.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <main className="flex-grow flex flex-col bg-white dark:bg-slate-900 min-w-0 h-full overflow-hidden">
            {/* Top Action Bar */}
            <div className="p-2 md:p-3 border-b border-gray-200 dark:border-slate-700 flex flex-col md:flex-row md:justify-between md:items-center gap-2 bg-gray-50/50 dark:bg-slate-800/30 shrink-0">
                <div className="flex items-center gap-2 w-full min-w-0 flex-grow">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors">
                        <i className="fa-solid fa-folder-tree"></i>
                    </button>
                    <div className="flex items-center truncate min-w-0 flex-grow bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent hover:border-gray-300 dark:hover:border-slate-600 focus-within:border-blue-500 rounded px-1 group cursor-text">
                        <select 
                            value={currentRequest.folder_id || ''} 
                            onChange={e => setCurrentRequest(p => ({ ...p, folder_id: e.target.value ? parseInt(e.target.value) : null }))}
                            className="text-gray-500 dark:text-gray-400 font-semibold text-sm md:text-base bg-transparent outline-none cursor-pointer hover:text-blue-600 appearance-none pr-1"
                            title="Move Request to Folder"
                        >
                            <option value="">Root /</option>
                            {foldersList.map(f => <option key={f.id} value={f.id}>{f.name} /</option>)}
                        </select>
                        <input 
                            type="text" 
                            value={currentRequest.name} 
                            onChange={e => setCurrentRequest(p => ({...p, name: e.target.value}))} 
                            placeholder="Untitled Request" 
                            className="bg-transparent font-semibold text-base md:text-lg border-none outline-none py-0.5 w-full min-w-0 text-ellipsis" 
                        />
                    </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap">
                    <button onClick={() => setImportModalOpen(true)} className="px-3 py-1.5 text-sm font-medium border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-import"></i> <span className="hidden md:inline">Import</span>
                    </button>
                    <button onClick={exportRequest} className="px-3 py-1.5 text-sm font-medium border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-export"></i> <span className="hidden md:inline">Export</span>
                    </button>
                    
                    {currentRequest.id && (
                        <button onClick={handleDeleteRequest} className="px-3 py-1.5 text-sm font-medium bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/50 rounded-lg transition-colors">
                            <i className="fa-solid fa-trash"></i>
                        </button>
                    )}
                    <button onClick={handleSaveRequest} className="px-4 py-1.5 font-medium bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-save"></i> Save
                    </button>
                </div>
            </div>

            {/* URL Input Bar */}
            <div className="p-2 md:p-4 border-b border-gray-200 dark:border-slate-700 shrink-0 w-full overflow-hidden bg-white dark:bg-slate-900">
                <form onSubmit={sendRequest} className="flex flex-col md:flex-row gap-2 w-full">
                    <div className="flex w-full flex-grow min-w-0 gap-2">
                        <select 
                            value={currentRequest.method} 
                            onChange={e => setCurrentRequest(p => ({...p, method: e.target.value}))} 
                            className={`w-24 shrink-0 font-bold bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm method-${currentRequest.method}`}
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <input 
                            type="text" 
                            required 
                            value={currentRequest.url} 
                            onChange={e => syncUrlToParams(e.target.value)} 
                            placeholder="https://api.example.com/endpoint" 
                            className="w-full min-w-0 flex-grow bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" 
                        />
                    </div>
                    <button type="submit" disabled={responseState.loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md shadow-blue-500/30 transition-colors flex items-center justify-center gap-2">
                        {responseState.loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-paper-plane text-sm"></i> Send</>}
                    </button>
                </form>
            </div>

            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                {/* Tabs Pane (Params, Auth, Headers, Body, Scripts, Assertions) */}
                <div className="flex-1 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-700 flex flex-col min-h-[50%] md:min-h-0 overflow-hidden">
                    <div className="flex border-b border-gray-200 dark:border-slate-700 px-4 pt-2 gap-4 shrink-0 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900">
                        {['params', 'authorization', 'headers', 'body', 'scripts', 'assertions'].map(tab => (
                            <button 
                                key={tab} 
                                onClick={() => setActiveTab(tab)} 
                                className={`pb-2 text-sm whitespace-nowrap transition-colors ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="flex-grow overflow-y-auto bg-gray-50/30 dark:bg-slate-900/50 p-4 pb-12">
                        
                        {/* PARAMS TAB */}
                        {activeTab === 'params' && (
                            <div>
                                {currentRequest.params.map((param, i) => (
                                    <div key={i} className="flex gap-2 items-center mb-2">
                                        <input type="text" placeholder="Key" value={param.key} onChange={e => updateList('params', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <input type="text" placeholder="Value" value={param.value} onChange={e => updateList('params', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <button onClick={() => removeListItem('params', i)} className="p-1.5 text-gray-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* HEADERS TAB */}
                        {activeTab === 'headers' && (
                            <div>
                                {currentRequest.headers.map((h, i) => (
                                    <div key={i} className="flex gap-2 items-center mb-2">
                                        <input type="text" placeholder="Key" value={h.key} onChange={e => updateList('headers', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <input type="text" placeholder="Value" value={h.value} onChange={e => updateList('headers', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <button onClick={() => removeListItem('headers', i)} className="p-1.5 text-gray-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* AUTHORIZATION TAB */}
                        {activeTab === 'authorization' && (
                            <div>
                                <select 
                                    value={currentRequest.authorization.type} 
                                    onChange={e => setCurrentRequest(p => ({...p, authorization: {...p.authorization, type: e.target.value}}))} 
                                    className="mb-4 w-1/2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="none">No Auth</option>
                                    <option value="bearer">Bearer Token</option>
                                    <option value="basic">Basic Auth</option>
                                    <option value="apikey">API Key</option>
                                </select>
                                
                                {currentRequest.authorization.type === 'bearer' && (
                                    <input type="text" placeholder="Token" value={currentRequest.authorization.token} onChange={e => setCurrentRequest(p => ({...p, authorization: {...p.authorization, token: e.target.value}}))} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" />
                                )}
                                {currentRequest.authorization.type === 'basic' && (
                                    <div className="space-y-2">
                                        <input type="text" placeholder="Username" value={currentRequest.authorization.username} onChange={e => setCurrentRequest(p => ({...p, authorization: {...p.authorization, username: e.target.value}}))} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                        <input type="password" placeholder="Password" value={currentRequest.authorization.password} onChange={e => setCurrentRequest(p => ({...p, authorization: {...p.authorization, password: e.target.value}}))} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                    </div>
                                )}
                                {currentRequest.authorization.type === 'apikey' && (
                                    <div className="space-y-2">
                                        <input type="text" placeholder="Key" value={currentRequest.authorization.apikey} onChange={e => setCurrentRequest(p => ({...p, authorization: {...p.authorization, apikey: e.target.value}}))} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
                                        <input type="text" placeholder="Value" value={currentRequest.authorization.apivalue} onChange={e => setCurrentRequest(p => ({...p, authorization: {...p.authorization, apivalue: e.target.value}}))} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
                                        <select value={currentRequest.authorization.addto} onChange={e => setCurrentRequest(p => ({...p, authorization: {...p.authorization, addto: e.target.value}}))} className="w-1/2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                                            <option value="header">Header</option>
                                            <option value="query">Query Params</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* BODY TAB */}
                        {activeTab === 'body' && (
                            <div className="flex flex-col h-full">
                                <div className="flex gap-4 mb-3 flex-wrap">
                                    {['none', 'json', 'form-data', 'urlencoded', 'xml', 'text', 'html'].map(t => (
                                        <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                            <input type="radio" name="bodyType" value={t} checked={currentRequest.bodyType === t} onChange={e => {
                                                setCurrentRequest(p => ({...p, bodyType: e.target.value}));
                                                if(e.target.value === 'json') {
                                                    updateList('headers', currentRequest.headers.length-1, 'key', 'Content-Type'); 
                                                    updateList('headers', currentRequest.headers.length-1, 'value', 'application/json');
                                                }
                                            }} className="text-blue-600" /> {t}
                                        </label>
                                    ))}
                                </div>
                                {['json', 'xml', 'text', 'html'].includes(currentRequest.bodyType) && (
                                    <textarea 
                                        value={currentRequest.body} 
                                        onChange={e => setCurrentRequest(p => ({...p, body: e.target.value}))} 
                                        className="flex-grow w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded p-3 font-mono text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder={`Enter your ${currentRequest.bodyType} payload here...`}
                                    ></textarea>
                                )}
                                {currentRequest.bodyType === 'form-data' && (
                                    <div className="space-y-2 flex-grow overflow-y-auto pr-1">
                                        {currentRequest.formData.map((item, i) => (
                                            <div key={i} className="flex gap-2 items-center mb-2">
                                                <input type="text" placeholder="Key" value={item.key} onChange={e => updateList('formData', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                <select value={item.type} onChange={e => { updateList('formData', i, 'type', e.target.value); updateList('formData', i, 'value', ''); updateList('formData', i, 'file', null); }} className="w-24 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                                                    <option value="text">Text</option>
                                                    <option value="file">File</option>
                                                </select>
                                                {item.type === 'file' ? (
                                                    <input type="file" onChange={(e) => handleFileUpload(e, i)} className="flex-1 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-blue-400 dark:hover:file:bg-slate-600" />
                                                ) : (
                                                    <input type="text" placeholder="Value" value={item.value} onChange={e => updateList('formData', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                )}
                                                <button onClick={() => removeListItem('formData', i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {currentRequest.bodyType === 'urlencoded' && (
                                    <div className="space-y-2 flex-grow overflow-y-auto pr-1">
                                        {currentRequest.urlencoded.map((param, i) => (
                                            <div key={i} className="flex gap-2 items-center mb-2">
                                                <input type="text" placeholder="Key" value={param.key} onChange={e => updateList('urlencoded', i, 'key', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                <input type="text" placeholder="Value" value={param.value} onChange={e => updateList('urlencoded', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                                <button onClick={() => removeListItem('urlencoded', i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* SCRIPTS TAB */}
                        {activeTab === 'scripts' && (
                            <div className="space-y-4 h-full flex flex-col">
                                <div className="flex-1 flex flex-col">
                                    <span className="text-xs mb-1 font-bold text-gray-600 dark:text-gray-300">Pre-request Script (Executed before sending)</span>
                                    <textarea value={currentRequest.pre_request_script} onChange={e => setCurrentRequest(p => ({...p, pre_request_script: e.target.value}))} className="flex-grow w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded p-3 font-mono text-xs resize-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="request.headers.push({key: 'X-Time', value: Date.now()});"></textarea>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <span className="text-xs mb-1 font-bold text-gray-600 dark:text-gray-300">Post-request Script (Executed after response)</span>
                                    <textarea value={currentRequest.post_request_script} onChange={e => setCurrentRequest(p => ({...p, post_request_script: e.target.value}))} className="flex-grow w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded p-3 font-mono text-xs resize-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="if (response.status === 200) { variables['token'] = response.data.token; }"></textarea>
                                </div>
                            </div>
                        )}
                        
                        {/* ASSERTIONS (TESTS) TAB */}
                        {activeTab === 'assertions' && (
                            <div>
                                {currentRequest.assertions.map((a, i) => (
                                    <div key={i} className="flex gap-2 items-center mb-2">
                                        <select value={a.type} onChange={e => updateList('assertions', i, 'type', e.target.value)} className="w-1/3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                                            <option value="status">Status Code</option>
                                            <option value="time">Response Time (ms)</option>
                                            <option value="body_contains">Body Contains</option>
                                        </select>
                                        <select value={a.operator} onChange={e => updateList('assertions', i, 'operator', e.target.value)} className="w-1/4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                                            <option value="equals">Equals</option>
                                            <option value="contains">Contains</option>
                                            <option value="less_than">Less Than</option>
                                        </select>
                                        <input type="text" placeholder="Value" value={a.value} onChange={e => updateList('assertions', i, 'value', e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                                        <button onClick={() => removeListItem('assertions', i)} className="p-1.5 text-gray-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <ResponsePane responseState={responseState} />
            </div>
        </main>
    );
}
