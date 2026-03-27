import React, { useState, useEffect } from 'react';
import { ApiService } from '../utils/api';

export default function Mocks({ activeWorkspaceId }) {
    const [mocksList, setMocksList] = useState([]);
    const [currentMock, setCurrentMock] = useState(getEmptyMock());
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Modal States
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

    const showAlert = (message, type = 'info', title = '') => {
        setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info') });
    };

    function getEmptyMock() {
        return {
            id: null, name: 'New Mock Server', method: 'GET', path: '/users/1', status: 200,
            headers: '[{"key":"Content-Type","value":"application/json"}]', body: '{"message": "success"}'
        };
    }

    useEffect(() => {
        if (activeWorkspaceId) loadMocks();
    }, [activeWorkspaceId]);

    const loadMocks = async () => {
        try {
            const mocks = await ApiService.getMocks(activeWorkspaceId);
            setMocksList(mocks);
            if (mocks.length > 0 && !currentMock.id) handleLoadMock(mocks[0]);
        } catch (e) { console.error(e); }
    };

    const handleLoadMock = (mock) => {
        let headStr = mock.headers;
        if (Array.isArray(mock.headers)) headStr = JSON.stringify(mock.headers);
        setCurrentMock({ ...mock, headers: headStr });
        setSidebarOpen(false);
    };

    const handleNewMock = () => {
        setCurrentMock(getEmptyMock());
        setSidebarOpen(false);
    };

    const handleSaveMock = async (e) => {
        e.preventDefault();
        try {
            let headersParsed = [];
            if (currentMock.headers.trim() !== '') headersParsed = JSON.parse(currentMock.headers);

            const payload = {
                id: currentMock.id, name: currentMock.name, method: currentMock.method,
                path: currentMock.path, status: parseInt(currentMock.status), headers: headersParsed, body: currentMock.body
            };

            const result = await ApiService.saveMock(activeWorkspaceId, payload);
            setCurrentMock(prev => ({ ...prev, id: prev.id || result.id }));
            loadMocks();
            showAlert('Mock saved successfully', 'success');
        } catch (err) { showAlert(err.message, 'error'); }
    };

    const handleDeleteMockTrigger = (e) => {
        e.preventDefault();
        if (!currentMock.id) return;
        setConfirmConfig({
            isOpen: true,
            message: 'Are you sure you want to delete this mock server?',
            onConfirm: executeDeleteMock
        });
    };

    const executeDeleteMock = async () => {
        try {
            await ApiService.deleteMock(activeWorkspaceId, currentMock.id);
            handleNewMock();
            loadMocks();
            showAlert('Mock deleted successfully', 'success');
        } catch (err) {
            showAlert(err.message, 'error');
        }
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCurrentMock(prev => ({ ...prev, [name]: value }));
    };

    let fullPath = currentMock.path;
    if (!fullPath.startsWith('/')) fullPath = '/' + fullPath;
    const endpointUrl = `${window.location.origin}/api/mock/${activeWorkspaceId || 'USER_ID'}${fullPath}`;

    return (
        <div className="flex-grow flex overflow-hidden w-full h-full relative">
            <aside className={`w-64 bg-gray-50 dark:bg-slate-800/50 border-r border-gray-200 dark:border-slate-700 flex flex-col shrink-0 z-30 absolute md:relative h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300"><i className="fa-solid fa-server mr-2"></i>Mock Servers</h3>
                    <button onClick={handleNewMock} className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors" title="New Mock"><i className="fa-solid fa-plus text-sm"></i></button>
                </div>
                <div className="flex-grow overflow-y-auto p-2 pb-12 space-y-1">
                    {mocksList.length === 0 ? <div className="text-center p-4 text-sm text-gray-500">No mock servers</div> : mocksList.map(m => (
                        <div key={m.id} onClick={() => handleLoadMock(m)} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer transition-colors group relative border-l-2 border-transparent ${currentMock.id === m.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''}`}>
                            <div className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate pr-6">{m.name}</div>
                            <div className="flex gap-2 items-center text-xs mt-1"><span className={`font-bold method-${m.method}`}>{m.method}</span><span className="text-gray-500 truncate">{m.path}</span></div>
                        </div>
                    ))}
                </div>
            </aside>

            {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

            <main className="flex-grow flex flex-col bg-white dark:bg-slate-900 min-w-0 h-full overflow-y-auto relative">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 md:hidden flex items-center shrink-0">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors mr-2"><i className="fa-solid fa-bars"></i></button>
                    <span className="font-semibold text-sm">Mocks Sidebar</span>
                </div>

                <div className="p-4 md:p-6 max-w-5xl w-full mx-auto space-y-6 pb-16">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold">{currentMock.id ? currentMock.name : 'Create Mock Server'}</h2>
                        <div className="flex gap-2">
                            <button onClick={handleSaveMock} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2"><i className="fa-solid fa-save"></i> Save Mock</button>
                            {currentMock.id && <button onClick={handleDeleteMockTrigger} className="px-4 py-2 text-sm font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-colors flex items-center gap-2"><i className="fa-solid fa-trash"></i> Delete</button>}
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <p className="text-sm font-medium mb-1">Mock Endpoint URL:</p>
                        <code className="text-blue-600 dark:text-blue-400 text-sm break-all">{endpointUrl}</code>
                    </div>

                    <form className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input type="text" name="name" value={currentMock.name} onChange={handleChange} required className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="w-full sm:w-1/3">
                                <label className="block text-sm font-medium mb-1">Method</label>
                                <select name="method" value={currentMock.method} onChange={handleChange} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="PATCH">PATCH</option><option value="DELETE">DELETE</option>
                                </select>
                            </div>
                            <div className="w-full sm:w-2/3">
                                <label className="block text-sm font-medium mb-1">Path (e.g. /users/1)</label>
                                <input type="text" name="path" value={currentMock.path} onChange={handleChange} required className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Response Status Code</label>
                            <input type="number" name="status" value={currentMock.status} onChange={handleChange} required className="w-full sm:w-1/3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Response Headers (JSON format)</label>
                            <textarea name="headers" value={currentMock.headers} onChange={handleChange} rows="3" className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Response Body</label>
                            <textarea name="body" value={currentMock.body} onChange={handleChange} rows="8" className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"></textarea>
                        </div>
                    </form>
                </div>
            </main>

            {/* Modals */}
            {alertConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${alertConfig.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><i className={`fa-solid ${alertConfig.type === 'success' ? 'fa-check' : 'fa-times'}`}></i></div>
                            <h3 className="text-lg font-semibold">{alertConfig.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{alertConfig.message}</p>
                        <div className="flex justify-end"><button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md">Okay</button></div>
                    </div>
                </div>
            )}
            {confirmConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><i className="fa-solid fa-trash"></i></div>
                            <h3 className="text-lg font-semibold">Delete Mock</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{confirmConfig.message}</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmConfig({ isOpen: false, message: '', onConfirm: null })} className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 rounded-md">Cancel</button>
                            <button onClick={confirmConfig.onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

