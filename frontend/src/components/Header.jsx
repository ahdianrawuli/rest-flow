import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import AgentModal from './AgentModal';

export default function Header({ toggleTheme, toggleSidebar }) {
    const navigate = useNavigate();
    
    // Dropdown States
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const profileDropdownRef = useRef(null);

    // Modal States
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    
    // Profile Settings States
    const [profileData, setProfileData] = useState({ full_name: '', email: '', username: '' });
    const [newPassword, setNewPassword] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    // Global Alert & Confirm States
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });
    
    const [isAgentOnline, setIsAgentOnline] = useState(false);
    const username = localStorage.getItem('rf_username') || 'User';

    const showAlert = (message, type = 'info', title = '') => {
        setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info') });
    };

    useEffect(() => {
        checkAgentStatus();
        const agentInterval = setInterval(checkAgentStatus, 10000);
        return () => clearInterval(agentInterval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setUserDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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

    // PERBAIKAN BUG 4: Delete Account Implementation
    const handleDeleteAccount = () => {
        setConfirmConfig({
            isOpen: true,
            message: 'Apakah Anda yakin ingin menghapus akun secara permanen? Seluruh workspace, api requests, dan riwayat akan hilang.',
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

    return (
        <>
        <header className="h-12 border-b border-gray-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md flex items-center justify-between px-3 md:px-4 shrink-0 shadow-sm w-full transition-colors duration-200 relative z-30">
            
            <div className="flex items-center gap-3 shrink-0">
                <button onClick={toggleSidebar} className="md:hidden p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors" title="Toggle Sidebar">
                    <i className="fa-solid fa-bars text-base"></i>
                </button>
                <div className="text-blue-600 dark:text-blue-400 flex items-center gap-2 font-bold text-base tracking-tight">
                    <i className="fa-solid fa-bolt text-lg"></i> <span className="hidden sm:inline">Rest Flow</span>
                </div>
            </div>

            <div className="flex-1"></div>

            <div className="flex items-center justify-end gap-1.5 md:gap-2 shrink-0">
                <button onClick={() => setAgentModalOpen(true)} className="relative flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-600" title="Local Agent Tunnel">
                    <i className="fa-solid fa-network-wired text-indigo-500 text-sm"></i>
                    <span className="hidden md:inline">Agent</span>
                    <span className="absolute -top-1 -right-1 md:relative md:top-0 md:right-0 flex h-2 w-2">
                        {isAgentOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isAgentOnline ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'}`}></span>
                    </span>
                </button>
                
                <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
                
                <button onClick={toggleTheme} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors shrink-0">
                    <i className="fa-solid fa-circle-half-stroke text-sm"></i>
                </button>
                
                <div className="relative z-50" ref={profileDropdownRef}>
                    <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} className="relative z-50 flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 py-1 px-1.5 rounded-md transition-colors min-w-0">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center font-bold text-xs shadow-inner shrink-0"><span>{username.charAt(0).toUpperCase()}</span></div>
                        <span className="text-xs font-semibold hidden sm:block truncate max-w-[80px]">{username}</span>
                        <i className="fa-solid fa-chevron-down text-[9px] text-gray-400 hidden sm:block shrink-0"></i>
                    </button>

                    {userDropdownOpen && (
                        <div className="absolute top-full mt-1.5 right-0 w-44 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50">
                            <button onClick={() => { setUserDropdownOpen(false); setProfileModalOpen(true); loadProfile(); }} className="w-full text-left px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                <i className="fa-solid fa-user w-4 text-gray-400"></i> Profile
                            </button>
                            <button onClick={() => { ApiService.logout(); navigate('/auth'); }} className="w-full text-left px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors">
                                <i className="fa-solid fa-right-from-bracket w-4"></i> Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>

        <AgentModal isOpen={agentModalOpen} onClose={() => { setAgentModalOpen(false); checkAgentStatus(); }} />

        {profileModalOpen && (
            <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm m-0">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-slate-700">
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/80">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Profile Settings</h3>
                        <button onClick={() => setProfileModalOpen(false)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-times"></i></button>
                    </div>
                    <div className="p-5">
                        <form onSubmit={handleUpdateProfile} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                <input type="text" required value={profileData.full_name} onChange={e => setProfileData({...profileData, full_name: e.target.value})} className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                <input type="email" required value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">New Password <span className="font-normal text-gray-400 text-[10px]">(optional)</span></label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            
                            <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                                {/* Delete Account Button added here */}
                                <button type="button" onClick={handleDeleteAccount} className="text-xs font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                                    Delete Account
                                </button>
                                
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setProfileModalOpen(false)} className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600 rounded transition-colors">Cancel</button>
                                    <button type="submit" disabled={profileLoading} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70 rounded flex items-center gap-1.5 transition-colors">
                                        {profileLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>} Save
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* Global Alerts */}
        {alertConfig.isOpen && (
            <div className="fixed top-0 left-0 w-screen h-[100dvh] z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 m-0">
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
