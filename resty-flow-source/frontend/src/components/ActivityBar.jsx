import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { ApiService } from '../utils/api';
import InviteModal from './InviteModal';

export default function ActivityBar({ sidebarOpen, setSidebarOpen, desktopCollapsed, setDesktopCollapsed, activeWorkspaceId, setActiveWorkspaceId }) {
    const [workspaces, setWorkspaces] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const workspaceDropdownRef = useRef(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [inviteWsModalOpen, setInviteWsModalOpen] = useState(false);
    
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameWsId, setRenameWsId] = useState(null);
    const [renameWsName, setRenameWsName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    
    const [isImporting, setIsImporting] = useState(false);
    const [newWsName, setNewWsName] = useState('');

    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

    const showAlert = (message, type = 'info', title = '') => { setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : 'Info') }); };
    const safeParse = (data, fallback) => {
        if (!data) return fallback; let parsed = data; let attempts = 0;
        while (typeof parsed === 'string' && attempts < 5) { try { const next = JSON.parse(parsed); if (next === parsed || typeof next !== 'object') break; parsed = next; } catch(e) { break; } attempts++; }
        return parsed !== undefined ? parsed : fallback;
    };

    useEffect(() => { loadWorkspaces(); }, [activeWorkspaceId]);

    useEffect(() => {
        const handleClickOutside = (e) => { if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(e.target)) setDropdownOpen(false); };
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadWorkspaces = async () => {
        try {
            const list = await ApiService.getWorkspaces(); setWorkspaces(list);
            if (list.length > 0 && !list.find(w => w.id === activeWorkspaceId)) { setActiveWorkspaceId(list[0].id); localStorage.setItem('rf_active_workspace', list[0].id); }
        } catch (e) { console.error(e); }
    };

    const exportWorkspace = async () => {
        if (!activeWorkspaceId) return;
        try {
            const [folders, reqs, vars, mocks, scenarios] = await Promise.all([ ApiService.getFolders(activeWorkspaceId), ApiService.getRequests(activeWorkspaceId), ApiService.getVariables(activeWorkspaceId), ApiService.getMocks(activeWorkspaceId), ApiService.getScenarios(activeWorkspaceId) ]);
            const wsName = workspaces.find(w => w.id === activeWorkspaceId)?.name || 'workspace';
            const data = { version: "1.1", type: "workspace", name: wsName, folders, requests: reqs.map(r => ({ ...r, headers: safeParse(r.headers, []), assertions: safeParse(r.assertions, []), authorization: safeParse(r.authorization, {}) })), variables: vars, mocks: mocks.map(m => ({ ...m, headers: safeParse(m.headers, []) })), scenarios: scenarios.map(s => ({ ...s, nodes: safeParse(s.nodes, {nodes: [], edges: []}) })) };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `resty-flow-${wsName.toLowerCase().replace(/\s+/g, '-')}.json`; a.click(); URL.revokeObjectURL(url);
        } catch (e) { showAlert('Export failed: ' + e.message, 'error'); }
    };

    const importWorkspace = (e) => {
        if (e.target.files.length === 0) return; const file = e.target.files[0]; const reader = new FileReader();
        reader.onload = async (ev) => {
            setIsImporting(true);
            try {
                const data = JSON.parse(ev.target.result); if (data.type !== 'workspace') throw new Error("Invalid workspace JSON");
                const wsResult = await ApiService.createWorkspace(`${data.name} (Imported)`); const newWsId = wsResult.id;
                const folderMap = {}; if (data.folders) for (const f of data.folders) { try { const res = await ApiService.createFolder(newWsId, f.name); folderMap[f.id] = res.id; } catch(e) {} }
                const requestMap = {}; if (data.requests) for (const r of data.requests) { try { const res = await ApiService.saveRequest(newWsId, { ...r, id: null, folder_id: r.folder_id ? (folderMap[r.folder_id] || null) : null }); requestMap[r.id] = res.id; } catch(e) {} }
                const mockMap = {}; if (data.mocks) for (const m of data.mocks) { try { const res = await ApiService.saveMock(newWsId, { ...m, id: null }); mockMap[m.id] = res.id; } catch(e) {} }
                if (data.variables) for (const v of data.variables) { try { await ApiService.saveVariable(newWsId, v.var_key, v.var_value); } catch(e) {} }
                if (data.scenarios) for (const s of data.scenarios) { try { let nodesObj = s.nodes; if (nodesObj && nodesObj.nodes) { nodesObj.nodes = nodesObj.nodes.map(n => { if (n.type === 'request' && n.refId) n.refId = requestMap[n.refId] || n.refId; if (n.type === 'mock' && n.refId) n.refId = mockMap[n.refId] || n.refId; return n; }); } await ApiService.saveScenario(newWsId, { id: null, name: s.name, nodes: nodesObj }); } catch(e) {} }
                setImportModalOpen(false); await loadWorkspaces(); setActiveWorkspaceId(newWsId); showAlert('Import success!', 'success');
            } catch (err) { showAlert('Import Error: ' + err.message, 'error'); } finally { setIsImporting(false); }
        }; reader.readAsText(file);
    };

    const handleCreateWorkspace = async () => {
        if (!newWsName.trim()) return showAlert('Name is required', 'warning');
        try { await ApiService.createWorkspace(newWsName); setModalOpen(false); setNewWsName(''); await loadWorkspaces(); showAlert('Created', 'success'); } catch (e) { showAlert(e.message, 'error'); }
    };

    const handleDeleteWorkspaceTrigger = (e, id, isOwnerFlag) => {
        e.stopPropagation(); 
        if (workspaces.length <= 1) {
            return showAlert('Workspace minimal harus 1. Anda tidak bisa menghapusnya.', 'warning');
        }
        setConfirmConfig({ isOpen: true, message: isOwnerFlag ? 'PERMANENTLY DELETE this workspace?' : 'LEAVE this workspace?', onConfirm: () => executeDeleteWorkspace(id) });
    };

    const executeDeleteWorkspace = async (id) => {
        try { await ApiService.deleteWorkspace(id); if (activeWorkspaceId === id) { setActiveWorkspaceId(null); localStorage.removeItem('rf_active_workspace'); } loadWorkspaces(); } catch(err) { showAlert(err.message, 'error'); } setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    const handleRenameWorkspaceTrigger = (e, ws) => {
        e.stopPropagation(); setRenameWsId(ws.id); setRenameWsName(ws.name); setRenameModalOpen(true); setDropdownOpen(false);
    };

    const executeRenameWorkspace = async () => {
        if (!renameWsName.trim()) return showAlert('Name is required', 'warning');
        setIsRenaming(true);
        try {
            const token = localStorage.getItem('rf_token');
            const res = await fetch(`/api/workspaces/${renameWsId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: renameWsName.trim() }) });
            if (!res.ok) throw new Error('Failed to rename workspace');
            setRenameModalOpen(false); await loadWorkspaces(); showAlert('Workspace renamed successfully', 'success');
        } catch (e) { showAlert(e.message, 'error'); } finally { setIsRenaming(false); }
    };

    const navLinkClass = ({ isActive }) =>
        `h-9 rounded-md flex items-center transition-all cursor-pointer relative ${
            desktopCollapsed ? 'md:w-9 md:justify-center md:px-0 w-full px-3 justify-start gap-2.5' : 'w-full px-3 justify-start gap-2.5'
        } ${ isActive ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30 font-bold' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700/50 font-medium' } mx-auto`;

    const activeWsObj = workspaces.find(w => w.id === activeWorkspaceId);
    const isOwner = activeWsObj ? activeWsObj.is_owner === 1 : false;

    return (
        <>
        <nav className={`bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col pt-4 pb-2 shrink-0 z-50 absolute md:relative h-full transition-transform duration-300 shadow-2xl md:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${desktopCollapsed ? 'md:w-[60px]' : 'md:w-[220px]'} w-[220px]`}>
            
            <div className={`flex-1 flex flex-col gap-1 w-full overflow-y-auto custom-scrollbar ${desktopCollapsed ? 'md:px-2 px-3' : 'px-3'}`}>
                <NavLink to="/dashboard" className={navLinkClass} onClick={() => setSidebarOpen(false)} title="Dashboard">
                    <i className="fa-solid fa-house text-sm w-4 text-center shrink-0"></i>
                    <span className={`text-xs ${desktopCollapsed ? 'md:hidden' : ''}`}>Dashboard</span>
                </NavLink>
                <NavLink to="/requests" className={navLinkClass} onClick={() => setSidebarOpen(false)} title="Requests">
                    <i className="fa-solid fa-paper-plane text-sm w-4 text-center shrink-0"></i>
                    <span className={`text-xs ${desktopCollapsed ? 'md:hidden' : ''}`}>Requests</span>
                </NavLink>
                <NavLink to="/variables" className={navLinkClass} onClick={() => setSidebarOpen(false)} title="Variables">
                    <i className="fa-solid fa-code text-sm w-4 text-center shrink-0"></i>
                    <span className={`text-xs ${desktopCollapsed ? 'md:hidden' : ''}`}>Variables</span>
                </NavLink>
                <NavLink to="/mocks" className={navLinkClass} onClick={() => setSidebarOpen(false)} title="Mocks">
                    <i className="fa-solid fa-server text-sm w-4 text-center shrink-0"></i>
                    <span className={`text-xs ${desktopCollapsed ? 'md:hidden' : ''}`}>Mocks</span>
                </NavLink>
                <NavLink to="/scenarios" className={navLinkClass} onClick={() => setSidebarOpen(false)} title="Scenarios">
                    <i className="fa-solid fa-flask text-sm w-4 text-center shrink-0"></i>
                    <span className={`text-xs ${desktopCollapsed ? 'md:hidden' : ''}`}>Scenarios</span>
                </NavLink>
            </div>

            <div className="mt-auto w-full flex flex-col pt-2 shrink-0 border-t border-gray-200 dark:border-slate-700/50 bg-white dark:bg-slate-900">
                <div className={`${desktopCollapsed ? 'md:hidden flex' : 'flex'} flex-col w-full px-2`}>
                    
                    <div className="relative w-full mb-1" ref={workspaceDropdownRef}>
                        <button onClick={() => setDropdownOpen(!dropdownOpen)} className="relative w-full flex items-center justify-between gap-1.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-800 py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 transition-colors shadow-sm text-gray-700 dark:text-gray-300">
                            <div className="flex items-center gap-1.5 truncate">
                                <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><i className="fa-solid fa-layer-group text-[8px]"></i></div>
                                <span className="truncate max-w-[120px]">{activeWsObj?.name || 'Unknown'}</span>
                            </div>
                            <i className="fa-solid fa-chevron-up text-[8px] text-gray-400 shrink-0"></i>
                        </button>

                        {dropdownOpen && (
                            <div className="absolute bottom-full mb-1 left-0 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 z-50">
                                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                    {workspaces.map(w => (
                                        <div key={w.id} className={`px-2 py-1.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 group ${w.id === activeWorkspaceId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : ''}`}>
                                            <div className="flex items-center gap-1.5 truncate flex-grow" onClick={() => { setActiveWorkspaceId(w.id); localStorage.setItem('rf_active_workspace', w.id); setDropdownOpen(false); }}>
                                                <i className={`fa-solid fa-check text-[10px] shrink-0 ${w.id === activeWorkspaceId ? '' : 'opacity-0'}`}></i><span className="text-xs font-medium truncate">{w.name}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {w.is_owner === 1 && <button onClick={(e) => handleRenameWorkspaceTrigger(e, w)} className="p-0.5 text-gray-400 hover:text-blue-500"><i className="fa-solid fa-pencil text-[10px]"></i></button>}
                                                <button onClick={(e) => handleDeleteWorkspaceTrigger(e, w.id, w.is_owner === 1)} className="p-0.5 text-gray-400 hover:text-red-500"><i className={`fa-solid ${w.is_owner === 1 ? 'fa-trash' : 'fa-door-open'} text-[10px]`}></i></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-2 pt-1.5 mt-1 border-t border-gray-100 dark:border-slate-700">
                                    <button onClick={() => { setModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"><i className="fa-solid fa-plus w-3"></i> Create</button>
                                    <button onClick={() => { setImportModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"><i className="fa-solid fa-file-import w-3"></i> Import</button>
                                    <button onClick={() => { exportWorkspace(); setDropdownOpen(false); }} className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"><i className="fa-solid fa-file-export w-3"></i> Export</button>
                                    {isOwner && <button onClick={() => { setInviteWsModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded"><i className="fa-solid fa-user-plus w-3"></i> Invite</button>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* DESAIN BARU: Powered by Autodev 2026 yang Modern & Stylish */}
                <div className={`${desktopCollapsed ? 'hidden' : 'flex'} justify-center w-full pb-3 pt-3 select-none px-2`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 w-full justify-center rounded-lg bg-gray-50/80 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/50 shadow-sm backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300">
                        <i className="fa-solid fa-bolt text-[10px] text-amber-500 animate-pulse"></i>
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 tracking-wide flex items-center gap-1">
                            Powered by <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400">Autodev</span> <span className="text-gray-400 dark:text-gray-500 font-bold">2026</span>
                        </span>
                    </div>
                </div>

                <div className="hidden md:flex justify-end px-2 py-1.5 w-full bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
                    <button onClick={() => setDesktopCollapsed(!desktopCollapsed)} className={`p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors flex items-center justify-center ${desktopCollapsed ? 'w-full' : ''}`} title={desktopCollapsed ? "Expand" : "Collapse"}>
                        <i className={`fa-solid fa-angles-${desktopCollapsed ? 'right' : 'left'} text-xs`}></i>
                    </button>
                </div>
            </div>
        </nav>

        <InviteModal isOpen={inviteWsModalOpen} onClose={() => setInviteWsModalOpen(false)} resourceType="workspace" resourceId={activeWorkspaceId} resourceName={activeWsObj?.name} />
        
        {modalOpen && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm m-0">
                <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-sm">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between"><h3 className="font-bold text-sm">Create Workspace</h3><button onClick={() => setModalOpen(false)}><i className="fa-solid fa-times text-gray-400"></i></button></div>
                    <div className="p-4"><input type="text" value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="Workspace Name" className="w-full px-2 py-1.5 text-sm border dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-900 mb-4 outline-none focus:border-blue-500" /><div className="flex justify-end gap-2"><button onClick={() => setModalOpen(false)} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-700 rounded">Cancel</button><button onClick={handleCreateWorkspace} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded">Create</button></div></div>
                </div>
            </div>
        )}

        {renameModalOpen && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm m-0">
                <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-sm">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between"><h3 className="font-bold text-sm">Rename Workspace</h3><button onClick={() => setRenameModalOpen(false)}><i className="fa-solid fa-times text-gray-400"></i></button></div>
                    <div className="p-4"><input type="text" value={renameWsName} onChange={e => setRenameWsName(e.target.value)} placeholder="Workspace Name" className="w-full px-2 py-1.5 text-sm border dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-900 mb-4 outline-none focus:border-blue-500" /><div className="flex justify-end gap-2"><button onClick={() => setRenameModalOpen(false)} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-700 rounded">Cancel</button><button onClick={executeRenameWorkspace} disabled={isRenaming} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded">{isRenaming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Rename'}</button></div></div>
                </div>
            </div>
        )}

        {importModalOpen && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm m-0">
                <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-sm">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between"><h3 className="font-bold text-sm">Import JSON</h3><button onClick={() => setImportModalOpen(false)}><i className="fa-solid fa-times text-gray-400"></i></button></div>
                    <div className="p-4"><input type="file" onChange={importWorkspace} disabled={isImporting} accept=".json" className="w-full text-xs mb-4" />{isImporting && <p className="text-xs text-blue-600 mb-2"><i className="fa-solid fa-circle-notch fa-spin mr-1"></i> Importing Workspace...</p>}<div className="flex justify-end"><button onClick={() => setImportModalOpen(false)} disabled={isImporting} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-700 rounded">Close</button></div></div>
                </div>
            </div>
        )}

        {alertConfig.isOpen && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm m-0">
                <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${alertConfig.type === 'success' ? 'bg-green-100 text-green-600' : alertConfig.type === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}><i className={`fa-solid ${alertConfig.type === 'success' ? 'fa-check' : alertConfig.type === 'warning' ? 'fa-exclamation' : 'fa-times'}`}></i></div>
                        <h3 className="text-sm font-bold">{alertConfig.title}</h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">{alertConfig.message}</p>
                    <div className="flex justify-end"><button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded">Okay</button></div>
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
        </>
    );
}
