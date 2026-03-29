import React, { useState, useEffect } from 'react';
import { ApiService } from '../utils/api';
import RequestsSidebar from '../components/RequestsSidebar';
import RequestEditor from '../components/RequestEditor';

export default function Requests({ activeWorkspaceId }) {
    const [requestsHistory, setRequestsHistory] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [variablesList, setVariablesList] = useState([]);
    const [currentRequest, setCurrentRequest] = useState(getEmptyRequest());

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [responseState, setResponseState] = useState({ loading: false, data: null, error: null, time: 0 });

    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const showAlert = (message, type = 'info', title = '') => {
        let defaultTitle = title;
        if (!title) {
            if (type === 'error') defaultTitle = 'Error';
            else if (type === 'success') defaultTitle = 'Success';
            else if (type === 'warning') defaultTitle = 'Warning';
            else defaultTitle = 'Information';
        }
        setAlertConfig({ isOpen: true, message, type, title: defaultTitle });
    };

    function getEmptyRequest() {
        return {
            id: null, folder_id: null, name: 'Untitled Request', method: 'GET', url: 'https://jsonplaceholder.typicode.com/users/1',
            params: [{ key: '', value: '' }], headers: [{ key: '', value: '' }],
            authorization: { type: 'none', token: '', username: '', password: '', apikey: '', apivalue: '', addto: 'header' },
            bodyType: 'none', body: '', formData: [{ key: '', value: '', type: 'text', file: null }], urlencoded: [{ key: '', value: '' }],
            pre_request_script: '', post_request_script: '', assertions: [{ type: 'status', operator: 'equals', value: '' }],
            description: ''
        };
    }

    const safeParse = (data, fallback) => {
        if (!data) return fallback;
        let parsed = data;
        let attempts = 0;
        
        while (typeof parsed === 'string' && attempts < 5) {
            try { 
                const next = JSON.parse(parsed); 
                if (next === parsed || typeof next !== 'object') break;
                parsed = next;
            } catch(e) { break; }
            attempts++;
        }
        
        if (Array.isArray(fallback)) return Array.isArray(parsed) ? [...parsed] : fallback;
        else if (typeof fallback === 'object') return (typeof parsed === 'object' && !Array.isArray(parsed)) ? {...parsed} : fallback;
        
        return parsed !== undefined ? parsed : fallback;
    };

    useEffect(() => {
        if (activeWorkspaceId) { loadHistory(); loadVariables(); }
    }, [activeWorkspaceId]);

    const loadHistory = async () => {
        try {
            const [folders, requests] = await Promise.all([
                ApiService.getFolders(activeWorkspaceId),
                ApiService.getRequests(activeWorkspaceId)
            ]);
            setFoldersList(folders || []);
            setRequestsHistory(requests || []);
        } catch (e) { console.error(e); }
    };

    const loadVariables = async () => {
        try {
            const vars = await ApiService.getVariables(activeWorkspaceId);
            setVariablesList(vars || []);
        } catch (e) { console.error(e); }
    };

    const handleLoadRequest = (req) => {
        try {
            let auth = safeParse(req.authorization, { type: 'none', token: '', username: '', password: '', apikey: '', apivalue: '', addto: 'header' });
            
            let loadedHeaders = safeParse(req.headers, []);
            if (loadedHeaders.length === 0 || loadedHeaders[loadedHeaders.length - 1].key !== '') loadedHeaders.push({ key: '', value: '' });

            let loadedAssertions = safeParse(req.assertions, []);
            if (loadedAssertions.length === 0 || loadedAssertions[loadedAssertions.length - 1].value !== '') loadedAssertions.push({ type: 'status', operator: 'equals', value: '' });

            let bType = req.body_type || req.bodyType || 'none';
            let rawBody = req.body || '';
            let fData = []; 
            let urlData = [];

            if (bType === 'form-data') { fData = safeParse(req.body, []); rawBody = ''; } 
            else if (bType === 'urlencoded') { urlData = safeParse(req.body, []); rawBody = ''; } 
            else if (bType === 'none' && req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) bType = 'json';

            if (fData.length === 0 || fData[fData.length - 1].key !== '') fData.push({ key: '', value: '', type: 'text', file: null });
            if (urlData.length === 0 || urlData[urlData.length - 1].key !== '') urlData.push({ key: '', value: '' });

            // PERBAIKAN BUG 1: Parsing Parameter Manual (Aman untuk Variabel {{...}})
            let parsedParams = [{ key: '', value: '' }];
            if (req.url && req.url.includes('?')) {
                const queryString = req.url.split('?').slice(1).join('?');
                const searchParams = new URLSearchParams(queryString);
                const p = [];
                for (const [key, value] of searchParams.entries()) p.push({ key, value });
                if (p.length > 0) parsedParams = [...p, {key:'', value:''}];
            }

            setCurrentRequest({
                id: req.id, folder_id: req.folder_id, name: req.name, method: req.method, url: req.url || '',
                params: parsedParams, headers: loadedHeaders, authorization: auth, 
                pre_request_script: req.pre_request_script || '', post_request_script: req.post_request_script || '',
                bodyType: bType, body: rawBody, formData: fData, urlencoded: urlData, assertions: loadedAssertions,
                description: req.description || '' 
            });

            setSidebarOpen(false);
            setResponseState({ loading: false, data: null, error: null, time: 0 });
            
        } catch (error) {
            console.error("Gagal memuat request:", error);
            showAlert("Terjadi kesalahan saat memuat request ini.", "error");
        }
    };

    const handleSaveRequest = async () => {
        if (!currentRequest.url) return showAlert('URL is required to save', 'warning');
        try {
            const cleanHeaders = currentRequest.headers.filter(h => h.key.trim() !== '');
            const cleanAssertions = currentRequest.assertions.filter(a => a.value.trim() !== '');
            
            let finalBody = null;
            if (['json', 'xml', 'text', 'html'].includes(currentRequest.bodyType)) finalBody = currentRequest.body;
            else if (currentRequest.bodyType === 'form-data') finalBody = JSON.stringify(currentRequest.formData.filter(f => f.key.trim() !== '').map(f => ({ key: f.key, type: f.type, value: f.type === 'text' ? f.value : '' })));
            else if (currentRequest.bodyType === 'urlencoded') finalBody = JSON.stringify(currentRequest.urlencoded.filter(f => f.key.trim() !== ''));

            const payload = {
                id: currentRequest.id, 
                folder_id: currentRequest.folder_id, 
                name: currentRequest.name,
                method: currentRequest.method, 
                url: currentRequest.url, 
                headers: JSON.stringify(cleanHeaders), 
                bodyType: currentRequest.bodyType, 
                body_type: currentRequest.bodyType, 
                body: finalBody, 
                assertions: JSON.stringify(cleanAssertions), 
                authorization: JSON.stringify(currentRequest.authorization), 
                pre_request_script: currentRequest.pre_request_script, 
                post_request_script: currentRequest.post_request_script,
                description: currentRequest.description || '' 
            };

            const result = await ApiService.saveRequest(activeWorkspaceId, payload);
            setCurrentRequest(prev => ({ ...prev, id: prev.id || result.id }));
            loadHistory();
            showAlert('Request saved successfully', 'success');
        } catch (err) { showAlert(err.message, 'error'); }
    };

    const handleDeleteRequestTrigger = () => {
        if (!currentRequest.id) return;
        setDeleteModalOpen(true);
    };

    const executeDeleteRequest = async () => {
        try {
            await ApiService.deleteRequest(activeWorkspaceId, currentRequest.id);
            setCurrentRequest(getEmptyRequest());
            loadHistory();
            setDeleteModalOpen(false);
            showAlert('Request deleted successfully', 'success');
        } catch (err) { 
            setDeleteModalOpen(false);
            showAlert(err.message, 'error'); 
        }
    };

    const importRequest = async () => {
        const textToImport = importText.trim();
        if (!textToImport) return showAlert('Please paste JSON or cURL', 'warning');
        
        try {
            let newReq = getEmptyRequest();
            newReq.folder_id = currentRequest.folder_id;

            if (textToImport.startsWith('{')) {
                const data = JSON.parse(textToImport);
                const r = data.type === 'request' ? data.request : data;

                newReq.name = r.name || 'Imported Request';
                newReq.method = r.method || 'GET';
                newReq.url = r.url || '';
                
                if (r.headers) {
                    let h = typeof r.headers === 'string' ? JSON.parse(r.headers) : r.headers;
                    newReq.headers = Array.isArray(h) ? h : [];
                }
                if (newReq.headers.length === 0 || newReq.headers[newReq.headers.length - 1].key !== '') newReq.headers.push({ key: '', value: '' });

                if (r.authorization) newReq.authorization = typeof r.authorization === 'string' ? JSON.parse(r.authorization) : r.authorization;

                if (r.assertions) {
                    let a = typeof r.assertions === 'string' ? JSON.parse(r.assertions) : r.assertions;
                    newReq.assertions = Array.isArray(a) ? a : [];
                }
                if (newReq.assertions.length === 0 || newReq.assertions[newReq.assertions.length - 1].value !== '') newReq.assertions.push({ type: 'status', operator: 'equals', value: '' });

                newReq.bodyType = r.bodyType || r.body_type || 'none';
                newReq.pre_request_script = r.pre_request_script || '';
                newReq.post_request_script = r.post_request_script || '';
                newReq.description = r.description || '';

                if (newReq.bodyType === 'form-data') { 
                    try { 
                        let f = typeof r.body === 'string' ? JSON.parse(r.body) : r.body; 
                        newReq.formData = Array.isArray(f) ? f : [];
                    } catch(e) {} 
                    if (newReq.formData.length === 0 || newReq.formData[newReq.formData.length - 1].key !== '') newReq.formData.push({ key: '', value: '', type: 'text', file: null });
                    newReq.body = '';
                }
                else if (newReq.bodyType === 'urlencoded') { 
                    try { 
                        let u = typeof r.body === 'string' ? JSON.parse(r.body) : r.body; 
                        newReq.urlencoded = Array.isArray(u) ? u : [];
                    } catch(e) {} 
                    if (newReq.urlencoded.length === 0 || newReq.urlencoded[newReq.urlencoded.length - 1].key !== '') newReq.urlencoded.push({ key: '', value: '' });
                    newReq.body = '';
                } else {
                    newReq.body = typeof r.body === 'string' ? r.body : (r.body ? JSON.stringify(r.body) : '');
                }

                // PERBAIKAN BUG 1: Parsing Parameter Manual untuk Injeksi
                if (newReq.url && newReq.url.includes('?')) {
                    const queryString = newReq.url.split('?').slice(1).join('?');
                    const searchParams = new URLSearchParams(queryString);
                    const p = [];
                    for (const [key, value] of searchParams.entries()) p.push({ key, value });
                    if (p.length > 0) newReq.params = [...p, {key:'', value:''}];
                }

            } else if (textToImport.toLowerCase().startsWith('curl')) {
                let method = 'GET';
                let cleanText = textToImport.replace(/\\\r?\n/g, ' ').replace(/\\\s+-/g, ' -').replace(/\\-/g, '-').replace(/\s+/g, ' ');    

                const methodMatch = cleanText.match(/-X\s+([A-Z]+)/i);
                if (methodMatch) method = methodMatch[1].toUpperCase();
                else if (cleanText.match(/(?:-d|--data|-F|--form)\s/)) method = 'POST';
                newReq.method = method;

                const urlMatch = cleanText.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/);
                if (urlMatch) newReq.url = urlMatch[1];

                const extractArgs = (flagPattern, text) => {
                    const regex = new RegExp(`(?:${flagPattern})\\s+(?:(["'])(.*?)\\1|([^\\s"']+))`, 'g');
                    let matches = []; let match;
                    while ((match = regex.exec(text)) !== null) matches.push(match[2] || match[3]);
                    return matches;
                };

                const headers = [];
                const headerStrs = extractArgs('-H|--header', cleanText);
                headerStrs.forEach(h => {
                    let colonIdx = h.indexOf(':');
                    if (colonIdx > -1) headers.push({ key: h.substring(0, colonIdx).trim(), value: h.substring(colonIdx + 1).trim() });
                });
                if (headers.length > 0) newReq.headers = headers;
                newReq.headers.push({ key: '', value: '' });

                const formData = [];
                const formStrs = extractArgs('-F|--form', cleanText);
                formStrs.forEach(f => {
                    let eqIdx = f.indexOf('=');
                    if (eqIdx > -1) {
                        let key = f.substring(0, eqIdx).trim();
                        let val = f.substring(eqIdx + 1).trim();
                        let type = 'text';
                        if (val.startsWith('@')) { type = 'file'; val = val.substring(1); }
                        formData.push({ key, value: val, type, file: null });
                    }
                });

                if (formData.length > 0) {
                    newReq.bodyType = 'form-data';
                    newReq.formData = formData;
                    newReq.formData.push({ key: '', value: '', type: 'text', file: null });
                } else {
                    const dataStrs = extractArgs('-d|--data|--data-raw|--data-binary', cleanText);
                    if (dataStrs.length > 0) {
                        newReq.body = dataStrs.join('&');
                        newReq.bodyType = newReq.body.trim().startsWith('{') ? 'json' : 'text';
                    }
                }

                newReq.name = 'Imported cURL';
                
                // PERBAIKAN BUG 1: Parsing Parameter Manual untuk cURL
                if (newReq.url && newReq.url.includes('?')) {
                    const queryString = newReq.url.split('?').slice(1).join('?');
                    const searchParams = new URLSearchParams(queryString);
                    const p = [];
                    for (const [key, value] of searchParams.entries()) p.push({ key, value });
                    if (p.length > 0) newReq.params = [...p, {key:'', value:''}];
                }

            } else { throw new Error("Unrecognized format"); }

            const cleanHeaders = newReq.headers.filter(h => h.key.trim() !== '');
            const cleanAssertions = newReq.assertions.filter(a => a.value.trim() !== '');
            
            let finalBody = null;
            if (['json', 'xml', 'text', 'html'].includes(newReq.bodyType)) finalBody = newReq.body;
            else if (newReq.bodyType === 'form-data') finalBody = JSON.stringify(newReq.formData.filter(f => f.key.trim() !== ''));
            else if (newReq.bodyType === 'urlencoded') finalBody = JSON.stringify(newReq.urlencoded.filter(f => f.key.trim() !== ''));

            const payload = {
                id: null, 
                folder_id: newReq.folder_id, 
                name: newReq.name,
                method: newReq.method, 
                url: newReq.url, 
                headers: JSON.stringify(cleanHeaders), 
                bodyType: newReq.bodyType, 
                body_type: newReq.bodyType, 
                body: finalBody, 
                assertions: JSON.stringify(cleanAssertions), 
                authorization: JSON.stringify(newReq.authorization), 
                pre_request_script: newReq.pre_request_script, 
                post_request_script: newReq.post_request_script,
                description: newReq.description || ''
            };

            const result = await ApiService.saveRequest(activeWorkspaceId, payload);
            newReq.id = result.id;
            
            setCurrentRequest(newReq);
            loadHistory();
            setImportModalOpen(false); 
            setImportText(''); 
            showAlert('Request imported and saved to Workspace!', 'success');

        } catch (e) { showAlert('Failed to parse import format: ' + e.message, 'error'); }
    };

    return (
        <div className="flex-grow flex overflow-hidden w-full h-full relative">
            <RequestsSidebar
                activeWorkspaceId={activeWorkspaceId} foldersList={foldersList} requestsHistory={requestsHistory}
                currentRequest={currentRequest} setCurrentRequest={setCurrentRequest} sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen} loadHistory={loadHistory} handleLoadRequest={handleLoadRequest} getEmptyRequest={getEmptyRequest}
            />

            {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

            <RequestEditor
                currentRequest={currentRequest} setCurrentRequest={setCurrentRequest} foldersList={foldersList}
                responseState={responseState} sendRequest={async (e) => {
                    e.preventDefault();
                    if (!currentRequest.url) return;

                    setResponseState({ loading: true, data: null, error: null, time: 0, assertions: [] });

                    let context = {
                        request: { url: currentRequest.url, method: currentRequest.method, headers: [...currentRequest.headers], body: currentRequest.body },
                        response: null,
                        variables: variablesList.reduce((acc, v) => ({ ...acc, [v.var_key]: v.var_value }), {})
                    };

                    const applyVariables = (text) => {
                        if (!text) return text; let result = text;
                        variablesList.forEach(v => {
                            if (v.var_key && v.var_value) {
                                const regex = new RegExp(`{{${v.var_key}}}`, 'g');
                                result = result.replace(regex, v.var_value);
                            }
                        });
                        return result;
                    };

                    try {
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        if(currentRequest.pre_request_script) {
                            const preFunc = new AsyncFunction('request', 'response', 'variables', currentRequest.pre_request_script);
                            await preFunc(context.request, context.response, context.variables);
                        }
                    } catch (e) {}

                    let url = applyVariables(context.request.url);
                    let finalUrl;
                    try { finalUrl = new URL(url); } 
                    catch (err) { return setResponseState({ loading: false, data: null, error: 'Invalid URL format', time: 0, assertions: [] }); }

                    let finalHeaders = context.request.headers.filter(h => h.key.trim() !== '').map(h => ({ key: applyVariables(h.key), value: applyVariables(h.value) }));

                    const auth = currentRequest.authorization;
                    if (auth.type === 'bearer' && auth.token) {
                        finalHeaders.push({ key: 'Authorization', value: `Bearer ${applyVariables(auth.token)}` });
                    } else if (auth.type === 'basic' && auth.username) {
                        finalHeaders.push({ key: 'Authorization', value: `Basic ${btoa(`${applyVariables(auth.username)}:${applyVariables(auth.password)}`)}` });
                    } else if (auth.type === 'apikey' && auth.apikey) {
                        if (auth.addto === 'header') finalHeaders.push({ key: applyVariables(auth.apikey), value: applyVariables(auth.apivalue) });
                        else finalUrl.searchParams.append(applyVariables(auth.apikey), applyVariables(auth.apivalue));
                    }

                    try {
                        const rawBody = ['json', 'xml', 'text', 'html'].includes(currentRequest.bodyType) ? context.request.body : '';
                        const processedBody = applyVariables(rawBody);

                        const proxyData = {
                            method: context.request.method, url: finalUrl.toString(), headersStr: JSON.stringify(finalHeaders),
                            bodyType: currentRequest.bodyType, bodyContent: processedBody,
                            formDataEntries: currentRequest.bodyType === 'form-data' ? currentRequest.formData.filter(f => f.key.trim() !== '') : [],
                            urlencodedEntries: currentRequest.bodyType === 'urlencoded' ? currentRequest.urlencoded.filter(f => f.key.trim() !== '') : []
                        };

                        const response = await ApiService.proxyRequest(proxyData);
                        context.response = response;

                        try {
                            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                            if(currentRequest.post_request_script) {
                                const postFunc = new AsyncFunction('request', 'response', 'variables', currentRequest.post_request_script);
                                await postFunc(context.request, context.response, context.variables);
                            }
                        } catch (e) {}

                        let variablesUpdated = false;
                        for (const key in context.variables) {
                            const existingVar = variablesList.find(v => v.var_key === key);
                            if (!existingVar || existingVar.var_value !== context.variables[key]) {
                                try { await ApiService.saveVariable(activeWorkspaceId, key, context.variables[key]); variablesUpdated = true; } catch(err) {}
                            }
                        }
                        if (variablesUpdated) loadVariables(); 

                        const assertionsResults = [];
                        const assertionsToRun = currentRequest.assertions.filter(a => a.value && a.value.trim() !== '');
                        let responseBodyStr = typeof response.data === 'object' ? JSON.stringify(response.data) : (response.data || '');

                        assertionsToRun.forEach(a => {
                            let passed = false;
                            try {
                                let targetValue = '';
                                if (a.type === 'status') targetValue = response.status.toString();
                                else if (a.type === 'time') targetValue = parseInt(response.time);
                                else if (a.type === 'body' || a.type === 'body_contains') targetValue = responseBodyStr;
                                else if (a.type === 'header') targetValue = JSON.stringify(response.headers || {});
                                
                                if (a.type === 'time') {
                                    const expectVal = parseInt(a.value);
                                    if (a.operator === 'equals') passed = targetValue === expectVal;
                                    else if (a.operator === 'not_equals') passed = targetValue !== expectVal;
                                    else if (a.operator === 'less_than') passed = targetValue < expectVal;
                                    else if (a.operator === 'greater_than') passed = targetValue > expectVal;
                                } else {
                                    const expectValStr = a.value.toString();
                                    if (a.operator === 'equals') passed = targetValue === expectValStr;
                                    else if (a.operator === 'not_equals') passed = targetValue !== expectValStr;
                                    else if (a.operator === 'contains') passed = targetValue.includes(expectValStr);
                                    else if (a.operator === 'not_contains') passed = !targetValue.includes(expectValStr);
                                    else if (a.operator === 'less_than') passed = parseInt(targetValue) < parseInt(expectValStr);
                                    else if (a.operator === 'greater_than') passed = parseInt(targetValue) > parseInt(expectValStr);
                                }
                            } catch(e) { passed = false; }
                            assertionsResults.push({ ...a, passed });
                        });

                        setResponseState({ loading: false, data: response, error: null, time: response.time, assertions: assertionsResults });
                    } catch (err) {
                        setResponseState({ loading: false, data: null, error: err.message, time: 0, assertions: [] });
                    }
                }} handleSaveRequest={handleSaveRequest}
                handleDeleteRequest={handleDeleteRequestTrigger} setSidebarOpen={setSidebarOpen} setImportModalOpen={setImportModalOpen}
                showAlert={showAlert}
            />

            {/* Import Modal */}
            {importModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">Import Request</h3>
                            <button onClick={() => setImportModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        <div className="p-5">
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Paste cURL or JSON</label>
                                <textarea value={importText} onChange={e => setImportText(e.target.value)} rows="6" className="w-full px-3 py-2 font-mono text-sm rounded border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200" placeholder="curl -X POST https://api.example.com..."></textarea>
                            </div>
                            <div className="flex justify-between items-center mt-6">
                                <div className="relative overflow-hidden inline-block">
                                    <button className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Select File</button>
                                    <input type="file" onChange={(e) => {
                                        if (e.target.files.length > 0) {
                                            const r = new FileReader(); r.onload = ev => setImportText(ev.target.result); r.readAsText(e.target.files[0]);
                                        }
                                    }} accept=".json" className="absolute left-0 top-0 opacity-0 cursor-pointer w-full h-full" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setImportModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors">Cancel</button>
                                    <button onClick={importRequest} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">Import</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Alert Modal */}
            {alertConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5 transform transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                alertConfig.type === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                                alertConfig.type === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
                                alertConfig.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                'bg-blue-100 dark:bg-blue-900/30'
                            }`}>
                                {alertConfig.type === 'success' && <i className="fa-solid fa-check text-green-600 dark:text-green-400 text-lg"></i>}
                                {alertConfig.type === 'error' && <i className="fa-solid fa-circle-xmark text-red-600 dark:text-red-400 text-lg"></i>}
                                {alertConfig.type === 'warning' && <i className="fa-solid fa-triangle-exclamation text-yellow-600 dark:text-yellow-400 text-lg"></i>}
                                {alertConfig.type === 'info' && <i className="fa-solid fa-circle-info text-blue-600 dark:text-blue-400 text-lg"></i>}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{alertConfig.title}</h3>
                        </div>
                        <p className={`text-sm text-gray-600 dark:text-gray-400 mb-6 border-l-4 pl-3 py-1 ${
                            alertConfig.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/10' :
                            alertConfig.type === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/10' :
                            alertConfig.type === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' :
                            'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                        }`}>
                            {alertConfig.message}
                        </p>
                        <div className="flex justify-end">
                            <button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">Okay</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Request Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5 transform transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-trash text-red-600 dark:text-red-400 text-lg"></i>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Delete Request</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-gray-800 dark:text-gray-200">"{currentRequest.name || 'this request'}"</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md transition-colors">Cancel</button>
                            <button onClick={executeDeleteRequest} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors">Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
