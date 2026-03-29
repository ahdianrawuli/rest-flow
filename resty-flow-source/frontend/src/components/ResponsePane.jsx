import React, { useState } from 'react';

export default function ResponsePane({ responseState }) {
    const [activeTab, setActiveTab] = useState('Body');

    if (!responseState) return null;

    const { loading, data: response, error, time, assertions = [] } = responseState;

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 justify-center items-center text-gray-400 gap-3 border-t border-gray-200 dark:border-slate-700">
                <i className="fa-solid fa-rocket fa-bounce text-2xl text-blue-500"></i>
                <span className="text-xs font-medium animate-pulse">Sending request...</span>
            </div>
        );
    }

    if (!response && !error) {
        return (
            <div className="flex flex-col h-full bg-gray-50/50 dark:bg-slate-850 justify-center items-center text-gray-400 gap-2 border-t border-gray-200 dark:border-slate-700">
                <i className="fa-solid fa-reply-all text-2xl opacity-20"></i>
                <span className="text-xs font-medium opacity-50">Hit Send to get a response</span>
            </div>
        );
    }

    const isError = !!error;
    const statusColor = isError ? 'text-red-500' : (response?.status >= 200 && response?.status < 300 ? 'text-green-500' : (response?.status >= 400 ? 'text-red-500' : 'text-yellow-500'));
    
    let formattedBody = response?.data;
    if (typeof response?.data === 'object') {
        formattedBody = JSON.stringify(response.data, null, 2);
    } else if (typeof response?.data === 'string') {
        try {
            formattedBody = JSON.stringify(JSON.parse(response.data), null, 2);
        } catch(e) {}
    }

    let sizeText = '0 B';
    if (formattedBody) {
        const bytes = new Blob([formattedBody]).size;
        sizeText = bytes > 1024 ? `${(bytes/1024).toFixed(2)} KB` : `${bytes} B`;
    }

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 text-sm overflow-hidden relative">
            
            {/* Top Bar Response Info */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-850 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-xs text-gray-700 dark:text-gray-300">Response</span>
                </div>
                {!isError && response && (
                    <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="flex items-center gap-1.5" title="Status">
                            <span className="text-gray-500 dark:text-gray-400">Status:</span>
                            <span className={`font-bold ${statusColor}`}>{response.status} {response.statusText}</span>
                        </span>
                        <span className="text-gray-300 dark:text-slate-600">|</span>
                        <span className="flex items-center gap-1.5" title="Time">
                            <span className="text-gray-500 dark:text-gray-400">Time:</span>
                            <span className="font-bold text-emerald-500 dark:text-emerald-400">{time} ms</span>
                        </span>
                        <span className="text-gray-300 dark:text-slate-600">|</span>
                        <span className="flex items-center gap-1.5" title="Size">
                            <span className="text-gray-500 dark:text-gray-400">Size:</span>
                            <span className="font-bold text-blue-500 dark:text-blue-400">{sizeText}</span>
                        </span>
                    </div>
                )}
            </div>

            {/* Tabs Response */}
            <div className="flex px-3 border-b border-gray-100 dark:border-slate-800 shrink-0 gap-4">
                {['Body', 'Headers', 'Tests'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-1.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab ? 'border-green-500 text-green-600 dark:border-green-400 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                    >
                        {tab} 
                        {tab === 'Headers' && response?.headers && <span className="ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-[9px]">{Object.keys(response.headers).length}</span>}
                        {tab === 'Tests' && assertions?.length > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${assertions.every(a => a.passed) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{assertions.length}</span>}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col relative bg-white dark:bg-slate-900">
                {isError ? (
                    <div className="p-4 text-red-500 text-xs font-mono break-words overflow-auto">
                        <span className="font-bold">Error:</span> {error}
                    </div>
                ) : (
                    <>
                        {activeTab === 'Body' && (
                            <div className="flex-1 relative overflow-hidden flex flex-col">
                                <textarea 
                                    readOnly 
                                    value={formattedBody || ''} 
                                    className="flex-1 w-full bg-transparent text-gray-800 dark:text-gray-200 font-mono text-xs p-3 outline-none resize-none code-scrollbar"
                                    spellCheck="false"
                                />
                            </div>
                        )}

                        {activeTab === 'Headers' && (
                            <div className="flex-1 overflow-auto custom-scrollbar p-3">
                                <div className="grid grid-cols-12 gap-2 mb-2 pb-1 border-b border-gray-200 dark:border-slate-700 text-[11px] font-bold text-gray-500 uppercase">
                                    <div className="col-span-4">Key</div>
                                    <div className="col-span-8">Value</div>
                                </div>
                                {response?.headers && Object.entries(response.headers).map(([k, v], i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 mb-1 border-b border-gray-100 dark:border-slate-800 pb-1 last:border-0 hover:bg-gray-100 dark:hover:bg-slate-800 px-1 rounded">
                                        <div className="col-span-4 font-mono text-xs text-gray-700 dark:text-gray-300 truncate font-semibold" title={k}>{k}</div>
                                        <div className="col-span-8 font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{v}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'Tests' && (
                            <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-2">
                                <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-flask text-blue-500"></i> Assertion Results
                                </div>
                                {assertions.length === 0 ? (
                                    <div className="text-xs text-gray-500 italic">No assertions defined for this request.</div>
                                ) : (
                                    assertions.map((a, i) => (
                                        <div key={i} className={`p-2 rounded border text-xs flex items-center gap-3 ${a.passed ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'}`}>
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${a.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                <i className={`fa-solid ${a.passed ? 'fa-check' : 'fa-times'}`}></i>
                                            </div>
                                            <div className="flex-1 text-gray-700 dark:text-gray-300">
                                                Expected <span className="font-mono font-bold">{a.type}</span> to <span className="font-mono italic">{a.operator}</span> <span className="font-mono font-bold px-1 bg-white dark:bg-slate-800 rounded">{a.value}</span>
                                            </div>
                                            <div className={`font-bold ${a.passed ? 'text-green-600' : 'text-red-600'}`}>
                                                {a.passed ? 'PASS' : 'FAIL'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
