import React, { useState } from 'react';

export default function ResponsePane({ responseState }) {
    const [resTab, setResTab] = useState('body');

    return (
        <div className="flex-1 flex flex-col min-h-[50%] md:min-h-0 overflow-hidden bg-white dark:bg-slate-900 relative">
            {responseState.loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex flex-col items-center justify-center backdrop-blur-sm">
                    <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-600 mb-3"></i>
                </div>
            )}
            {!responseState.data && !responseState.error ? (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-400">
                    <i className="fa-solid fa-satellite-dish text-4xl mb-3 opacity-50"></i>
                    <p className="text-sm">Enter the URL and click Send to get a response</p>
                </div>
            ) : responseState.error ? (
                <div className="flex-grow flex flex-col items-center justify-center text-red-500">
                    <i className="fa-solid fa-triangle-exclamation text-4xl mb-3 opacity-50"></i>
                    <p className="text-sm">{responseState.error}</p>
                </div>
            ) : (
                <div className="flex-grow flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800 shrink-0">
                        <h3 className="font-semibold text-sm">Response</h3>
                        <div className="flex gap-4 text-xs font-medium">
                            <span className="flex items-center gap-1">Status: <span className={`px-1.5 py-0.5 rounded text-white ${responseState.data.status < 300 ? 'bg-green-500' : responseState.data.status < 400 ? 'bg-yellow-500' : 'bg-red-500'}`}>{responseState.data.status} {responseState.data.statusText}</span></span>
                            <span className="flex items-center gap-1 text-gray-500">Time: <span className="text-gray-800 dark:text-gray-200">{responseState.time} ms</span></span>
                        </div>
                    </div>
                    <div className="flex border-b border-gray-200 dark:border-slate-700 px-4 pt-2 gap-4 shrink-0 bg-gray-50 dark:bg-slate-800">
                        <button onClick={() => setResTab('body')} className={`pb-2 text-sm ${resTab === 'body' ? 'border-b-2 border-blue-500 text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>Body</button>
                        <button onClick={() => setResTab('headers')} className={`pb-2 text-sm ${resTab === 'headers' ? 'border-b-2 border-blue-500 text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>Headers</button>
                        <button onClick={() => setResTab('tests')} className={`pb-2 text-sm ${resTab === 'tests' ? 'border-b-2 border-blue-500 text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>Tests</button>
                    </div>
                    
                    <div className="flex-grow overflow-auto relative bg-gray-50 dark:bg-[#1e1e1e] pb-12">
                        {resTab === 'body' && (
                            <pre className="p-4 font-mono text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-all">
                                {typeof responseState.data.data === 'object' ? JSON.stringify(responseState.data.data, null, 2) : responseState.data.data}
                            </pre>
                        )}
                        {resTab === 'headers' && (
                            <table className="w-full text-sm text-left">
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {Object.entries(responseState.data.headers || {}).map(([k, v]) => (
                                        <tr key={k} className="bg-white dark:bg-slate-900">
                                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 font-mono text-xs w-1/3">{k}</td>
                                            <td className="px-4 py-2 text-gray-700 dark:text-gray-400 font-mono text-xs break-all">{v}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {resTab === 'tests' && (
                            <div className="p-4 space-y-3">
                                {responseState.assertions.length === 0 ? <div className="text-gray-500 italic text-sm">No assertions executed.</div> :
                                    responseState.assertions.map((a, i) => (
                                        <div key={i} className={`p-3 rounded-lg border ${a.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                            <div className={`flex items-center gap-2 font-medium text-sm ${a.passed ? 'text-green-700' : 'text-red-700'}`}>
                                                <i className={`fa-solid ${a.passed ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                                <span>{a.type} {a.operator} {a.value}</span>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

