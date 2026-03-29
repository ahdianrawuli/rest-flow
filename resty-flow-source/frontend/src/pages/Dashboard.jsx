import React, { useState, useEffect } from 'react';
import { ApiService } from '../utils/api';

export default function Dashboard({ activeWorkspaceId }) {
    const [stats, setStats] = useState({ requests: 0, folders: 0, variables: 0, mocks: 0, scenarios: 0 });
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(true);

    // Modal States
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

    const showAlert = (message, type = 'info', title = '') => {
        setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info') });
    };

    useEffect(() => {
        if (activeWorkspaceId) loadDashboardData();
        loadInvitations();
    }, [activeWorkspaceId]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const wsList = await ApiService.getWorkspaces();
            const currentWs = wsList.find(w => w.id === activeWorkspaceId);
            if (currentWs) setIsOwner(currentWs.is_owner === 1);

            const [reqs, flds, vars, mks, scn] = await Promise.all([
                ApiService.getRequests(activeWorkspaceId),
                ApiService.getFolders(activeWorkspaceId),
                ApiService.getVariables(activeWorkspaceId),
                ApiService.getMocks(activeWorkspaceId),
                ApiService.getScenarios(activeWorkspaceId)
            ]);
            setStats({ requests: reqs.length, folders: flds.length, variables: vars.length, mocks: mks.length, scenarios: scn.length });
        } catch (e) {
            console.error("Failed to load dashboard data:", e);
        }
        setLoading(false);
    };

    const loadInvitations = async () => {
        try {
            const data = await ApiService.getInvitations();
            setInvitations(data);
        } catch(e) { console.error("Failed to load invitations:", e); }
    };

    const handleRespond = async (id, status) => {
        try {
            await ApiService.respondInvitation(id, status);
            loadInvitations(); 
            if(status === 'accepted') {
                showAlert('Invitation accepted! Please refresh to see the new shared content.', 'success');
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch(e) { showAlert(e.message, 'error'); }
    };

    const handleLeaveWorkspaceTrigger = () => {
        setConfirmConfig({
            isOpen: true,
            message: 'Are you sure you want to LEAVE this workspace? You will lose access to it immediately.',
            onConfirm: executeLeaveWorkspace
        });
    };

    const executeLeaveWorkspace = async () => {
        try {
            await ApiService.deleteWorkspace(activeWorkspaceId);
            showAlert('You have successfully left the workspace.', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch(e) {
            showAlert(e.message, 'error');
        }
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    };

    if (!activeWorkspaceId) {
        return (
            <div className="flex-grow flex items-center justify-center text-gray-500 bg-white dark:bg-slate-900">
                <div className="text-center"><i className="fa-solid fa-layer-group text-4xl mb-4 opacity-50"></i><p>Please select or create a workspace from the header to begin.</p></div>
            </div>
        );
    }

    return (
        <div className="flex-grow p-4 md:p-8 overflow-y-auto bg-gray-50 dark:bg-slate-900 max-w-6xl mx-auto w-full pb-16 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900 dark:text-white">Workspace Overview</h1>
                    <p className="text-gray-500 dark:text-gray-400">Here's a quick summary of your active workspace data.</p>
                </div>
                {!isOwner && (
                    <button onClick={handleLeaveWorkspaceTrigger} className="px-5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-800/50 dark:text-red-400 font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2 text-sm border border-red-200 dark:border-red-800">
                        <i className="fa-solid fa-person-walking-arrow-right"></i> Leave Shared Workspace
                    </button>
                )}
            </div>

            {invitations.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><i className="fa-solid fa-bell text-yellow-500"></i> Pending Invitations ({invitations.length})</h2>
                    <div className="grid gap-3">
                        {invitations.map(inv => (
                            <div key={inv.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 shrink-0 mt-0.5"><i className="fa-solid fa-user-group"></i></div>
                                    <div>
                                        <p className="text-sm text-gray-800 dark:text-gray-200"><span className="font-bold">{inv.sender_name}</span> invited you to collaborate on a <span className="font-semibold capitalize text-blue-600 dark:text-blue-400">{inv.resource_type}</span>:</p>
                                        <p className="text-base font-bold font-mono mt-0.5 text-gray-900 dark:text-white">{inv.resource_name || 'Unknown Resource'}</p>
                                        <p className="text-xs text-gray-500 mt-1"><i className="fa-regular fa-clock mr-1"></i> {new Date(inv.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => handleRespond(inv.id, 'declined')} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Decline</button>
                                    <button onClick={() => handleRespond(inv.id, 'accepted')} className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors flex items-center gap-2"><i className="fa-solid fa-check"></i> Accept</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shrink-0"><i className="fa-solid fa-paper-plane"></i></div>
                    <div><h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Total Requests</h3><p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '-' : stats.requests}</p></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0"><i className="fa-solid fa-folder"></i></div>
                    <div><h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Folders</h3><p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '-' : stats.folders}</p></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0"><i className="fa-solid fa-code"></i></div>
                    <div><h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Variables</h3><p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '-' : stats.variables}</p></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xl shrink-0"><i className="fa-solid fa-server"></i></div>
                    <div><h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Mock Servers</h3><p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '-' : stats.mocks}</p></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl shrink-0"><i className="fa-solid fa-flask"></i></div>
                    <div><h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Scenarios</h3><p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '-' : stats.scenarios}</p></div>
                </div>
            </div>

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

