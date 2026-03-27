import React, { useState } from 'react';
import { ApiService } from '../utils/api';

export default function RequestsSidebar({
    activeWorkspaceId, foldersList, requestsHistory, currentRequest, setCurrentRequest,
    sidebarOpen, setSidebarOpen, loadHistory, handleLoadRequest, getEmptyRequest
}) {
    const [historySearch, setHistorySearch] = useState('');
    const [expandedFolders, setExpandedFolders] = useState({}); // State tracking folder collapse
    
    // State untuk Modal Create Folder
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [folderNameInput, setFolderNameInput] = useState('');

    // State untuk Modal Delete Folder
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);

    // State untuk Modal Alert (Error)
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');

    const toggleFolder = (e, folderId) => {
        e.stopPropagation();
        setExpandedFolders(prev => ({
            ...prev,
            [folderId]: prev[folderId] !== undefined ? !prev[folderId] : false // toggle false jika sblmnya belum diset (krn default expanded)
        }));
    };

    const handleNewFolderClick = () => {
        setFolderNameInput('');
        setShowCreateModal(true);
    };

    const executeCreateFolder = async () => {
        if (!folderNameInput.trim()) return;
        try {
            await ApiService.createFolder(activeWorkspaceId, folderNameInput.trim());
            loadHistory();
            setShowCreateModal(false);
        } catch(e) { 
            setShowCreateModal(false);
            setAlertMessage(e.message);
            setShowAlertModal(true);
        }
    };

    const handleDeleteFolderClick = (e, folderId) => {
        e.stopPropagation();
        setFolderToDelete(folderId);
        setShowDeleteModal(true);
    };

    const executeDeleteFolder = async () => {
        if (!folderToDelete) return;
        try {
            await ApiService.deleteFolder(activeWorkspaceId, folderToDelete);
            if (currentRequest.folder_id === folderToDelete) {
                setCurrentRequest(getEmptyRequest());
            }
            loadHistory();
            setShowDeleteModal(false);
            setFolderToDelete(null);
        } catch(err) { 
            setShowDeleteModal(false);
            setAlertMessage(err.message);
            setShowAlertModal(true);
        }
    };

    const q = historySearch.toLowerCase();
    const filteredReqs = requestsHistory.filter(r => 
        (r.name || '').toLowerCase().includes(q) || 
        (r.url || '').toLowerCase().includes(q)
    );

    return (
        <>
            <aside className={`w-64 bg-gray-50 dark:bg-slate-800/50 border-r border-gray-200 dark:border-slate-700 flex flex-col shrink-0 z-30 absolute md:relative h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                
                {/* Header Sidebar */}
                <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                        <i className="fa-solid fa-folder-tree mr-2"></i>Collections
                    </h3>
                    <div className="flex gap-1">
                        <button onClick={handleNewFolderClick} className="p-1.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors" title="New Folder">
                            <i className="fa-solid fa-folder-plus text-sm"></i>
                        </button>
                        <button onClick={() => { setCurrentRequest(getEmptyRequest()); setSidebarOpen(false); }} className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors" title="New Request">
                            <i className="fa-solid fa-plus text-sm"></i>
                        </button>
                    </div>
                </div>
                
                {/* Search Bar */}
                <div className="p-2 border-b border-gray-200 dark:border-slate-700 shrink-0">
                    <div className="relative">
                        <i className="fa-solid fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                        <input 
                            type="text" 
                            value={historySearch} 
                            onChange={e => setHistorySearch(e.target.value)} 
                            placeholder="Filter requests..." 
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:border-blue-500 transition-colors" 
                        />
                    </div>
                </div>
                
                {/* List Folder & Request */}
                <div className="flex-grow overflow-y-auto p-2 pb-12 space-y-1">
                    {foldersList.map(folder => {
                        const folderReqs = filteredReqs.filter(r => r.folder_id === folder.id);
                        
                        // Sembunyikan folder jika sedang mencari dan tidak ada request yang cocok di dalamnya
                        if (q !== '' && folderReqs.length === 0 && !(folder.name||'').toLowerCase().includes(q)) return null;
                        
                        // Default expanded adalah true, kecuali secara eksplisit diset false di state
                        const isExpanded = expandedFolders[folder.id] !== false;

                        return (
                            <div key={folder.id} className="mb-2">
                                <div onClick={(e) => toggleFolder(e, folder.id)} className="flex justify-between items-center px-1.5 py-1.5 hover:bg-gray-200 dark:hover:bg-slate-700/50 rounded-md cursor-pointer group mb-1 transition-colors">
                                    <div className="flex items-center gap-2 font-semibold text-sm truncate text-gray-800 dark:text-gray-200">
                                        <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} w-3 text-center text-[10px] text-gray-500`}></i>
                                        <i className="fa-solid fa-folder text-blue-500 text-xs"></i>
                                        <span className="truncate">{folder.name}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity rounded px-1">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentRequest({...getEmptyRequest(), folder_id: folder.id}); 
                                                setSidebarOpen(false);
                                            }} 
                                            className="p-1 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400" 
                                            title="Add Request to Folder"
                                        >
                                            <i className="fa-solid fa-plus text-xs"></i>
                                        </button>
                                        
                                        <button 
                                            onClick={(e) => handleDeleteFolderClick(e, folder.id)} 
                                            className="p-1 text-gray-500 hover:text-red-500 dark:hover:text-red-400" 
                                            title="Delete Folder"
                                        >
                                            <i className="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="pl-6 space-y-1">
                                        {folderReqs.map(req => (
                                            <div 
                                                key={req.id} 
                                                onClick={() => handleLoadRequest(req)} 
                                                className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer transition-colors border-l-2 border-transparent ${currentRequest.id === req.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''}`}
                                            >
                                                <div className="font-medium text-xs text-gray-800 dark:text-gray-200 truncate">{req.name}</div>
                                                <div className="flex gap-2 items-center text-[10px] mt-0.5">
                                                    <span className={`font-bold method-${req.method}`}>{req.method}</span>
                                                    <span className="text-gray-500 truncate">{req.url}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {/* Request yang tidak memiliki Folder (Root) */}
                    <div className="mt-3 space-y-1">
                        {filteredReqs.filter(r => !r.folder_id).map(req => (
                            <div 
                                key={req.id} 
                                onClick={() => handleLoadRequest(req)} 
                                className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer transition-colors border-l-2 border-transparent ${currentRequest.id === req.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''}`}
                            >
                                <div className="font-medium text-xs text-gray-800 dark:text-gray-200 truncate">{req.name}</div>
                                <div className="flex gap-2 items-center text-[10px] mt-0.5">
                                    <span className={`font-bold method-${req.method}`}>{req.method}</span>
                                    <span className="text-gray-500 truncate">{req.url}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* --- MODALS OVERLAY --- */}

            {/* Modal Create Folder */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
                        <div className="p-5">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Create New Folder</h3>
                            <input 
                                type="text" 
                                value={folderNameInput}
                                onChange={(e) => setFolderNameInput(e.target.value)}
                                placeholder="Enter folder name..."
                                className="w-full p-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all mb-5"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') executeCreateFolder(); }}
                            />
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => setShowCreateModal(false)} 
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={executeCreateFolder} 
                                    disabled={!folderNameInput.trim()}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirm Delete */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-triangle-exclamation text-red-600 dark:text-red-400"></i>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Delete Folder</h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                Are you sure you want to delete this folder and all its requests? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => setShowDeleteModal(false)} 
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={executeDeleteFolder} 
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Alert (Error) */}
            {showAlertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-circle-xmark text-red-600 dark:text-red-400 text-lg"></i>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Error Occurred</h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 border-l-4 border-red-500 pl-3 py-1 bg-red-50 dark:bg-red-900/10">
                                {alertMessage}
                            </p>
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setShowAlertModal(false)} 
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                >
                                    Acknowledge
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

