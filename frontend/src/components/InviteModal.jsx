import React, { useState, useEffect } from 'react';
import { ApiService } from '../utils/api';

export default function InviteModal({ isOpen, onClose, resourceType, resourceId, resourceName }) {
    const [username, setUsername] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [status, setStatus] = useState({ loading: false, error: null, success: false });

    // Memuat daftar kolaborator yang ada saat ini
    useEffect(() => {
        if (isOpen && resourceId && resourceType === 'workspace') {
            loadCollaborators();
            setUsername('');
            setSuggestions([]);
        }
    }, [isOpen, resourceId]);

    const loadCollaborators = async () => {
        try {
            const data = await ApiService.getCollaborators(resourceId);
            setCollaborators(data);
        } catch(e) { console.error("Error loading collaborators", e); }
    };

    // Fungsi Autocomplete
    const handleSearch = async (val) => {
        setUsername(val);
        if (val.length < 2) {
            setSuggestions([]);
            return;
        }
        try {
            const users = await ApiService.searchUsers(val);
            setSuggestions(users);
        } catch(e) { 
            setSuggestions([]); 
        }
    };

    const handleSelectSuggestion = (uname) => {
        setUsername(uname);
        setSuggestions([]);
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        setStatus({ loading: true, error: null, success: false });
        try {
            await ApiService.sendInvitation(username, resourceType, resourceId);
            setStatus({ loading: false, error: null, success: true });
            setSuggestions([]);
            
            setTimeout(() => {
                setUsername('');
                setStatus({ loading: false, error: null, success: false });
                loadCollaborators(); // Refresh daftar setelah invite
            }, 1500);
        } catch (err) {
            setStatus({ loading: false, error: err.message, success: false });
        }
    };

    const handleRevoke = async (userId, uname) => {
        if (confirm(`Revoke access for user ${uname}?`)) {
            try {
                await ApiService.revokeCollaborator(resourceId, userId);
                loadCollaborators();
            } catch(e) {
                alert(e.message);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm m-0">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-slate-700 transform transition-all">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/80">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <i className="fa-solid fa-users"></i>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">Workspace Access</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-times"></i></button>
                </div>
                
                <div className="p-6">
                    {/* FORM INVITE AUTOCOMPLETE */}
                    <form onSubmit={handleInvite} className="mb-6 relative">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Invite New User</label>
                        <div className="flex gap-2 relative">
                            <div className="relative flex-grow">
                                <i className="fa-solid fa-at absolute left-3 top-2.5 text-gray-400"></i>
                                <input 
                                    type="text" 
                                    value={username} 
                                    onChange={e => handleSearch(e.target.value)} 
                                    placeholder="Type username..." 
                                    required
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                                />
                                {/* Dropdown Suggestions */}
                                {suggestions.length > 0 && (
                                    <div className="absolute top-full mt-1 left-0 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden z-50">
                                        {suggestions.map(s => (
                                            <div 
                                                key={s.id} 
                                                onClick={() => handleSelectSuggestion(s.username)}
                                                className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-medium transition-colors"
                                            >
                                                {s.username}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button type="submit" disabled={status.loading || status.success} className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors disabled:opacity-50">
                                {status.loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Invite'}
                            </button>
                        </div>

                        {status.error && <div className="mt-2 text-red-500 text-xs font-bold"><i className="fa-solid fa-circle-exclamation"></i> {status.error}</div>}
                        {status.success && <div className="mt-2 text-green-500 text-xs font-bold"><i className="fa-solid fa-check-circle"></i> Invitation sent!</div>}
                    </form>

                    {/* MANAGE COLLABORATORS */}
                    <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Existing Collaborators</label>
                        {collaborators.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No one else has access to this workspace yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {collaborators.map(c => (
                                    <div key={c.user_id} className="flex justify-between items-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">{c.username.charAt(0).toUpperCase()}</div>
                                            <span className="text-sm font-semibold">{c.username}</span>
                                        </div>
                                        <button onClick={() => handleRevoke(c.user_id, c.username)} className="text-xs text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-bold transition-colors">Revoke</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-lg transition-colors">Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

