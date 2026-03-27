import React, { useState, useEffect } from 'react';
import { ApiService } from '../utils/api';

export default function AgentModal({ isOpen, onClose }) {
    const [token, setToken] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [loading, setLoading] = useState(true);
    const [copying, setCopying] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

    useEffect(() => {
        if (isOpen) {
            loadAgentData();
            const interval = setInterval(loadAgentData, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const loadAgentData = async () => {
        try {
            const data = await ApiService.getAgentData();
            setToken(data.token);
            setIsOnline(data.online);
        } catch (error) {
            console.error('Failed to load agent data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyToken = async () => {
        try {
            await navigator.clipboard.writeText(token);
            setCopying(true);
            setTimeout(() => setCopying(false), 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };

    const handleRegenerate = async () => {
        if (!confirm('Are you sure? This will disconnect any currently running agent.')) return;
        setRegenerating(true);
        try {
            const data = await ApiService.regenerateAgentToken();
            setToken(data.token);
            setIsOnline(false);
        } catch (error) {
            alert('Failed to regenerate token');
        } finally {
            setRegenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm m-0 transition-opacity duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-slate-700 flex flex-col max-h-[90vh] relative">
                
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <i className="fa-solid fa-network-wired text-lg"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">Local Agent Tunnel</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Connect localhost to Rest Flow</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto text-left">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700 mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="relative flex h-4 w-4 shrink-0">
                                {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-4 w-4 ${isOnline ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-600'}`}></span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Agent Status</p>
                                <p className={`text-lg font-extrabold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {loading ? 'Checking...' : (isOnline ? 'ONLINE & CONNECTED' : 'OFFLINE')}
                                </p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 md:text-right">
                            <p>Requests to <code className="bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs text-pink-500 font-bold">localhost</code></p>
                            <p>will be routed through this agent.</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Your Secret Tunnel Token</label>
                            <button 
                                onClick={handleRegenerate} 
                                disabled={loading || regenerating}
                                className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                            >
                                <i className={`fa-solid fa-rotate ${regenerating ? 'fa-spin' : ''}`}></i> Reset Token
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={loading ? 'Loading token...' : token} 
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-900/80 outline-none text-gray-600 dark:text-gray-300 font-mono text-sm" 
                            />
                            <button 
                                onClick={handleCopyToken}
                                disabled={loading || !token}
                                className={`px-4 py-3 rounded-lg font-bold text-white transition-all w-28 shrink-0 flex items-center justify-center gap-2 ${copying ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {copying ? <><i className="fa-solid fa-check"></i> Copied</> : <><i className="fa-solid fa-copy"></i> Copy</>}
                            </button>
                        </div>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2 font-medium flex items-center gap-1.5">
                            <i className="fa-solid fa-triangle-exclamation"></i> Keep this token secret. Anyone with this token can proxy requests through your machine.
                        </p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">1. Download Local Agent</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <a href={`${currentDomain}/downloads/restflow-agent-windows.exe`} download className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-bold text-sm">
                                <i className="fa-brands fa-windows text-xl"></i> 
                                <div className="text-left"><p className="leading-none">Windows</p><p className="text-[10px] opacity-70 font-medium">x64 (.exe)</p></div>
                            </a>
                            <a href={`${currentDomain}/downloads/restflow-agent-linux`} download className="flex items-center gap-3 px-4 py-2.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors font-bold text-sm">
                                <i className="fa-brands fa-linux text-xl"></i> 
                                <div className="text-left"><p className="leading-none">Linux</p><p className="text-[10px] opacity-70 font-medium">x64 Binary</p></div>
                            </a>
                            <a href={`${currentDomain}/downloads/restflow-agent-mac-intel`} download className="flex items-center gap-3 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors font-bold text-sm">
                                <i className="fa-brands fa-apple text-xl"></i> 
                                <div className="text-left"><p className="leading-none">Mac (Intel)</p><p className="text-[10px] opacity-70 font-medium">x64 Binary</p></div>
                            </a>
                            <a href={`${currentDomain}/downloads/restflow-agent-mac-arm`} download className="flex items-center gap-3 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors font-bold text-sm">
                                <i className="fa-brands fa-apple text-xl"></i> 
                                <div className="text-left"><p className="leading-none">Mac (M-Series)</p><p className="text-[10px] opacity-70 font-medium">ARM64 Silicon</p></div>
                            </a>
	    <a href={`${currentDomain}/downloads/restflow-agent-android-arm64`} download className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-bold text-sm">
    <i className="fa-brands fa-android text-xl"></i>
    <div className="text-left"><p className="leading-none">Android</p><p className="text-[10px] opacity-70 font-medium">Termux ARM64</p></div>
</a>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">2. Run the agent via Terminal / CMD</label>
                        <div className="bg-[#0f172a] rounded-xl overflow-hidden shadow-inner border border-slate-700/50">
                            <div className="flex items-center px-4 py-2 bg-slate-800/80 border-b border-slate-700 gap-1.5 shrink-0">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="ml-2 text-xs font-mono text-slate-400">terminal</span>
                            </div>
                            <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
                                <p className="text-emerald-400 mb-1"># For Mac / Linux (Give Permission First):</p>
                                <p className="text-slate-300 mb-1">$ chmod +x restflow-agent-*</p>
                                <p className="text-pink-400 break-all whitespace-pre-wrap mb-5">
                                    <span className="text-slate-300">$ ./restflow-agent-* --url=</span>{currentDomain}<span className="text-slate-300"> --token=</span>{token || 'YOUR_TOKEN'}
                                </p>
                                
                                <p className="text-emerald-400 mb-1"># For Windows (CMD / PowerShell):</p>
                                <p className="text-pink-400 break-all whitespace-pre-wrap">
                                    <span className="text-slate-300">&gt; restflow-agent-windows.exe --url=</span>{currentDomain}<span className="text-slate-300"> --token=</span>{token || 'YOUR_TOKEN'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

