import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import InviteModal from './InviteModal';
import AgentModal from './AgentModal';

export default function Header({ toggleTheme, activeWorkspaceId, setActiveWorkspaceId, toggleSidebar }) {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    
    // Dropdown States
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    
    // Refs for detecting clicks outside to close dropdowns
    const workspaceDropdownRef = useRef(null);
    const profileDropdownRef = useRef(null);

    // Modal States
    const [modalOpen, setModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [inviteWsModalOpen, setInviteWsModalOpen] = useState(false);
    const [agentModalOpen, setAgentModalOpen] = useState(false);

    // Profile Settings States
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [profileData, setProfileData] = useState({ full_name: '', email: '', username: '' });
    const [newPassword, setNewPassword] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    // Global Alert & Confirm States
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });
    
    const [isImporting, setIsImporting] = useState(false);
    const [newWsName, setNewWsName] = useState('');
    const [isAgentOnline, setIsAgentOnline] = useState(false);
    
    const username = localStorage.getItem('rf_username') || 'User';

    const showAlert = (message, type = 'info', title = '') => {
        setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info') });
    };

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
        return parsed !== undefined ? parsed : fallback;
    };

    useEffect(() => {
        loadWorkspaces();
        checkAgentStatus();
        const agentInterval = setInterval(checkAgentStatus, 10000);
        return () => clearInterval(agentInterval);
    }, []);

    // PERBAIKAN 1: Event Listener untuk mendeteksi klik di luar Dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setUserDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const checkAgentStatus = async () => {
        try {
            const data = await ApiService.getAgentData();
            setIsAgentOnline(data.online);
        } catch(e) {}
    };

    const loadProfile = async () => {
        try {
            const data = await ApiService.getProfile();
            setProfileData(data);
            setNewPassword('');
        } catch(e) { showAlert("Error loading profile", "error"); }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            const payload = { full_name: profileData.full_name, email: profileData.email };
            if (newPassword.trim()) payload.password = newPassword;
            await ApiService.updateProfile(payload);
            setProfileModalOpen(false);
            showAlert('Profile updated successfully!', 'success');
        } catch(err) {
            showAlert(err.message, 'error');
        } finally {
            setProfileLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        setConfirmConfig({
            isOpen: true,
            message: 'Are you absolutely sure you want to permanently delete your account? This action cannot be undone and will erase all your workspaces, requests, and data.',
            onConfirm: executeDeleteAccount
        });
    };

    const executeDeleteAccount = async () => {
        try {
            await ApiService.deleteAccount();
            ApiService.logout();
            navigate('/auth');
        } catch(e) {
            showAlert(e.message, 'error');
        }
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    const exportWorkspace = async () => {
        if (!activeWorkspaceId) return;
        try {
            const [folders, reqs, vars, mocks, scenarios] = await Promise.all([
                ApiService.getFolders(activeWorkspaceId), ApiService.getRequests(activeWorkspaceId),
                ApiService.getVariables(activeWorkspaceId), ApiService.getMocks(activeWorkspaceId), ApiService.getScenarios(activeWorkspaceId)
            ]);

            const cleanReqs = reqs.map(r => ({ ...r, headers: safeParse(r.headers, []), assertions: safeParse(r.assertions, []), authorization: safeParse(r.authorization, {}) }));
            const cleanMocks = mocks.map(m => ({ ...m, headers: safeParse(m.headers, []) }));
            const cleanScenarios = scenarios.map(s => ({ ...s, nodes: safeParse(s.nodes, {nodes: [], edges: []}) }));

            const wsName = workspaces.find(w => w.id === activeWorkspaceId)?.name || 'workspace';
            const data = { version: "1.1", type: "workspace", name: wsName, folders: folders, requests: cleanReqs, variables: vars, mocks: cleanMocks, scenarios: cleanScenarios };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `resty-flow-${wsName.toLowerCase().replace(/\s+/g, '-')}.json`; a.click(); URL.revokeObjectURL(url);
        } catch (e) { showAlert('Export failed: ' + e.message, 'error'); }
    };

    const importWorkspace = (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (ev) => {
            setIsImporting(true);
            try {
                const data = JSON.parse(ev.target.result);
                if (data.type !== 'workspace') throw new Error("Invalid workspace JSON");

                const wsResult = await ApiService.createWorkspace(`${data.name} (Imported)`);
                const newWsId = wsResult.id;

                const folderMap = {};
                if (data.folders) {
                    for (const f of data.folders) {
                        try { const res = await ApiService.createFolder(newWsId, f.name); folderMap[f.id] = res.id; } catch(e) {}
                    }
                }

                const requestMap = {};
                if (data.requests) {
                    for (const r of data.requests) {
                        try {
                            const payload = { ...r, id: null, folder_id: r.folder_id ? (folderMap[r.folder_id] || null) : null };
                            const res = await ApiService.saveRequest(newWsId, payload);
                            requestMap[r.id] = res.id;
                        } catch(e) {}
                    }
                }

                const mockMap = {};
                if (data.mocks) {
                    for (const m of data.mocks) {
                        try { const res = await ApiService.saveMock(newWsId, { ...m, id: null }); mockMap[m.id] = res.id; } catch(e) {}
                    }
                }

                if (data.variables) {
                    for (const v of data.variables) {
                        try { await ApiService.saveVariable(newWsId, v.var_key, v.var_value); } catch(e) {}
                    }
                }

                if (data.scenarios) {
                    for (const s of data.scenarios) {
                        try {
                            let nodesObj = s.nodes;
                            if (nodesObj && nodesObj.nodes) {
                                nodesObj.nodes = nodesObj.nodes.map(n => {
                                    if (n.type === 'request' && n.refId) n.refId = requestMap[n.refId] || n.refId;
                                    if (n.type === 'mock' && n.refId) n.refId = mockMap[n.refId] || n.refId;
                                    return n;
                                });
                            }
                            await ApiService.saveScenario(newWsId, { id: null, name: s.name, nodes: nodesObj });
                        } catch(e) {}
                    }
                }

                setImportModalOpen(false);
                await loadWorkspaces();
                setActiveWorkspaceId(newWsId);
                showAlert('Workspace imported successfully!', 'success');
            } catch (err) { showAlert('Import Error: ' + err.message, 'error'); } finally { setIsImporting(false); }
        };
        reader.readAsText(file);
    };

    const loadWorkspaces = async () => {
        try {
            const list = await ApiService.getWorkspaces();
            setWorkspaces(list);
            if (list.length > 0 && !list.find(w => w.id === activeWorkspaceId)) {
                setActiveWorkspaceId(list[0].id);
                localStorage.setItem('rf_active_workspace', list[0].id);
            }
        } catch (e) { console.error(e); }
    };

    const handleCreateWorkspace = async () => {
        if (!newWsName.trim()) return showAlert('Name is required to create a workspace', 'warning');
        try {
            await ApiService.createWorkspace(newWsName);
            setModalOpen(false); setNewWsName(''); await loadWorkspaces();
            showAlert('Workspace created successfully', 'success');
        } catch (e) { showAlert(e.message, 'error'); }
    };

    const handleDeleteWorkspaceTrigger = (e, id, isOwnerFlag) => {
        e.stopPropagation();
        const msg = isOwnerFlag ? 'Are you sure you want to PERMANENTLY DELETE this workspace and all its data?' : 'Are you sure you want to LEAVE this workspace?';
        setConfirmConfig({ isOpen: true, message: msg, onConfirm: () => executeDeleteWorkspace(id) });
    };

    const executeDeleteWorkspace = async (id) => {
        try {
            await ApiService.deleteWorkspace(id);
            if (activeWorkspaceId === id) { setActiveWorkspaceId(null); localStorage.removeItem('rf_active_workspace'); }
            loadWorkspaces();
            showAlert('Action completed successfully', 'success');
        } catch(err) { showAlert(err.message, 'error'); }
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    const activeWsObj = workspaces.find(w => w.id === activeWorkspaceId);
    const activeWorkspaceName = activeWsObj?.name || 'Unknown';
    const isOwner = activeWsObj ? activeWsObj.is_owner === 1 : false;

    return (
        <>
        <header className="h-14 md:h-16 border-b border-gray-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md flex items-center justify-between px-3 md:px-6 shrink-0 shadow-sm w-full transition-colors duration-200 relative z-30">
            
            {/* Bagian Kiri: Logo & Hamburger */}
            <div className="flex items-center gap-3 shrink-0">
                <button onClick={toggleSidebar} className="md:hidden p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"><i className="fa-solid fa-bars text-lg"></i></button>
                <div className="text-blue-600 dark:text-blue-400 flex items-center gap-2 font-bold text-lg md:text-xl tracking-tight">
                    <i className="fa-solid fa-bolt"></i> <span className="hidden sm:inline">Rest Flow</span>
                </div>
            </div>

            {/* Bagian Tengah: Workspace Dropdown */}
            <div className="flex-1 flex justify-center min-w-0 px-2 md:px-4">
                <div className="relative w-full max-w-[140px] sm:max-w-xs md:max-w-md flex justify-center z-50" ref={workspaceDropdownRef}>
                    <button onClick={() => setDropdownOpen(!dropdownOpen)} className="relative z-50 flex items-center justify-between gap-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 py-1.5 px-3 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 transition-colors w-full shadow-sm">
                        <div className="flex items-center gap-2 truncate">
                            <i className="fa-solid fa-layer-group text-blue-500 shrink-0"></i>
                            <span className="truncate">{activeWorkspaceName}</span>
                        </div>
                        <i className="fa-solid fa-chevron-down text-[10px] text-gray-400 shrink-0"></i>
                    </button>

                    {dropdownOpen && (
                        <div className="absolute top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-2 z-50 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0">
                            <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Workspaces</span></div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {workspaces.map(w => (
                                    <div key={w.id} className={`px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 group ${w.id === activeWorkspaceId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}`}>
                                        <div className="flex items-center gap-2 truncate flex-grow" onClick={() => { setActiveWorkspaceId(w.id); setDropdownOpen(false); }}>
                                            <i className={`fa-solid fa-check text-xs shrink-0 ${w.id === activeWorkspaceId ? '' : 'opacity-0'}`}></i><span className="text-sm font-medium truncate">{w.name}</span>
                                            {w.is_owner === 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded ml-1 shrink-0">Guest</span>}
                                        </div>
                                        <button onClick={(e) => handleDeleteWorkspaceTrigger(e, w.id, w.is_owner === 1)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0 ml-1" title={w.is_owner === 1 ? "Delete Workspace" : "Leave Workspace"}>
                                            <i className={`fa-solid ${w.is_owner === 1 ? 'fa-trash' : 'fa-door-open'} text-xs`}></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="px-3 pt-2 mt-2 border-t border-gray-100 dark:border-slate-700">
                                <button onClick={() => { setModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg flex items-center justify-start gap-3 transition-colors mb-1"><i className="fa-solid fa-plus shrink-0 w-4 text-center"></i> Create Workspace</button>
                                <button onClick={() => { setImportModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg flex items-center justify-start gap-3 transition-colors mb-1"><i className="fa-solid fa-file-import shrink-0 w-4 text-center"></i> Import Workspace</button>
                                <button onClick={() => { exportWorkspace(); setDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg flex items-center justify-start gap-3 transition-colors mb-1"><i className="fa-solid fa-file-export shrink-0 w-4 text-center"></i> Export Workspace</button>
                                {isOwner && <button onClick={() => { setInviteWsModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-lg flex items-center justify-start gap-3 transition-colors mb-1"><i className="fa-solid fa-user-plus shrink-0 w-4 text-center"></i> Invite to Workspace</button>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bagian Kanan: Agent, Theme, Profile */}
            <div className="flex items-center justify-end gap-1.5 md:gap-3 shrink-0">
                {/* PERBAIKAN 2: Agent Indicator Tidak Saling Tumpuk, ditempatkan persis di pojok seperti notifikasi */}
                <button onClick={() => setAgentModalOpen(true)} className="relative flex items-center gap-2 py-1.5 px-2 md:px-3 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-600" title="Local Agent Tunnel">
                    <i className="fa-solid fa-network-wired text-indigo-500"></i>
                    <span className="hidden md:inline">Agent</span>
                    
                    {/* Badge Indicator diletakkan absolute di pojok kanan atas untuk HP, dan relative sejajar untuk Desktop */}
                    <span className="absolute -top-1 -right-1 md:relative md:top-0 md:right-0 flex h-2.5 w-2.5">
                        {isAgentOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isAgentOnline ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'}`}></span>
                    </span>
                </button>
                
                <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
                
                <button onClick={toggleTheme} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"><i className="fa-solid fa-circle-half-stroke"></i></button>
                
                <div className="relative z-50" ref={profileDropdownRef}>
                    <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} className="relative z-50 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700 py-1 px-1.5 md:px-2 rounded-lg transition-colors min-w-0">
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shadow-inner shrink-0"><span>{username.charAt(0).toUpperCase()}</span></div>
                        <span className="text-sm font-medium hidden sm:block truncate max-w-[100px]">{username}</span>
                        <i className="fa-solid fa-chevron-down text-[10px] text-gray-400 hidden sm:block shrink-0"></i>
                    </button>

                    {userDropdownOpen && (
                        <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50">
                            <button onClick={() => { setUserDropdownOpen(false); setProfileModalOpen(true); loadProfile(); }} className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                <i className="fa-solid fa-user w-5 text-gray-400"></i> Profile Settings
                            </button>
                            <button onClick={() => { ApiService.logout(); navigate('/auth'); }} className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors">
                                <i className="fa-solid fa-right-from-bracket w-5"></i> Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Settings Modal */}
            {profileModalOpen && (
                <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-slate-700">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/80">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Profile Settings</h3>
                            <button onClick={() => setProfileModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                    <input type="text" required value={profileData.full_name} onChange={e => setProfileData({...profileData, full_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input type="email" required value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">New Password <span className="font-normal text-gray-400 text-xs">(optional)</span></label>
                                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="pt-2 flex justify-end gap-2">
                                    <button type="button" onClick={() => setProfileModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={profileLoading} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70 rounded-lg flex items-center gap-2 transition-colors">
                                        {profileLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>} Save
                                    </button>
                                </div>
                            </form>

                            {/* Danger Zone: Delete Account */}
                            <div className="border-t border-red-100 dark:border-red-900/30 mt-6 pt-6">
                                <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">Danger Zone</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Permanently delete your account and all associated workspaces and data. This action cannot be undone.</p>
                                <button type="button" onClick={handleDeleteAccount} className="w-full px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors border border-red-200 dark:border-red-800">
                                    <i className="fa-solid fa-trash mr-2"></i> Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals for Create & Import Workspace */}
            {modalOpen && (
                <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-slate-700">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Create Workspace</h3>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>
                        </div>
                        <div className="p-5">
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Workspace Name</label>
                                <input type="text" value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="e.g. Production APIs" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">Cancel</button>
                                <button onClick={handleCreateWorkspace} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {importModalOpen && (
                <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm m-0">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-slate-700">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Import Workspace</h3>
                            {!isImporting && <button onClick={() => setImportModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="fa-solid fa-times"></i></button>}
                        </div>
                        <div className="p-5">
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Workspace JSON File</label>
                                <input type="file" onChange={importWorkspace} disabled={isImporting} accept=".json" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                            </div>
                            {isImporting && <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-2"><i className="fa-solid fa-circle-notch fa-spin"></i> Importing data, please wait...</p>}
                            <div className="flex justify-end mt-4">
                                <button onClick={() => setImportModalOpen(false)} disabled={isImporting} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded disabled:opacity-50">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <InviteModal isOpen={inviteWsModalOpen} onClose={() => setInviteWsModalOpen(false)} resourceType="workspace" resourceId={activeWorkspaceId} resourceName={activeWorkspaceName} />
            <AgentModal isOpen={agentModalOpen} onClose={() => { setAgentModalOpen(false); checkAgentStatus(); }} />
        </header>

        {/* Global Alert & Confirm Modals */}
        {alertConfig.isOpen && (
            <div className="fixed top-0 left-0 w-screen h-[100dvh] z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 m-0">
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
            <div className="fixed top-0 left-0 w-screen h-[100dvh] z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 m-0">
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
