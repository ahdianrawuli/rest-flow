import React, { useState, useEffect } from 'react';
import { ApiService } from '../utils/api';

export default function Variables({ activeWorkspaceId }) {
    const [variables, setVariables] = useState([]);
    
    // Modal States
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'info', title: 'Info' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

    const showAlert = (message, type = 'info', title = '') => {
        setAlertConfig({ isOpen: true, message, type, title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info') });
    };

    useEffect(() => {
        if (activeWorkspaceId) loadVariables();
    }, [activeWorkspaceId]);

    const loadVariables = async () => {
        try {
            const vars = await ApiService.getVariables(activeWorkspaceId);
            setVariables(vars);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAdd = () => {
        setVariables([...variables, { id: null, var_key: '', var_value: '', isNew: true }]);
    };

    const handleChange = (index, field, value) => {
        const newVars = [...variables];
        newVars[index][field] = value;
        setVariables(newVars);
    };

    const handleSave = async (index) => {
        const v = variables[index];
        if (!v.var_key) return showAlert('Key required', 'warning');
        try {
            await ApiService.saveVariable(activeWorkspaceId, v.var_key, v.var_value);
            loadVariables();
            showAlert('Variable saved successfully', 'success');
        } catch (e) {
            showAlert(e.message, 'error');
        }
    };

    const handleDeleteTrigger = (index) => {
        setConfirmConfig({
            isOpen: true,
            message: 'Are you sure you want to delete this variable?',
            onConfirm: () => executeDelete(index)
        });
    };

    const executeDelete = async (index) => {
        const v = variables[index];
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
        if (v.id) {
            try {
                await ApiService.deleteVariable(activeWorkspaceId, v.id);
                showAlert('Variable deleted', 'success');
            } catch (e) {
                return showAlert(e.message, 'error');
            }
        }
        const newVars = [...variables];
        newVars.splice(index, 1);
        setVariables(newVars);
    };

    return (
        <div className="flex-grow flex flex-col w-full h-full bg-white dark:bg-slate-900 overflow-y-auto pb-12 relative">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-bold">Global Variables</h2>
                <button onClick={handleAdd} className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-plus"></i> Add Variable
                </button>
            </div>
            <div className="p-6 max-w-4xl w-full mx-auto">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Variables can be used in URLs, Headers, and Request Bodies using the <code className="bg-gray-200 dark:bg-slate-700 px-1 rounded">{"{{variable_name}}"}</code> syntax.</p>

                <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                            <tr><th className="px-6 py-3 w-1/3">Key</th><th className="px-6 py-3">Value</th><th className="px-6 py-3 w-16">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {variables.length === 0 ? (
                                <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">No variables found</td></tr>
                            ) : (
                                variables.map((v, idx) => (
                                    <tr key={idx} className="bg-white dark:bg-slate-800">
                                        <td className="px-6 py-2"><input type="text" className="w-full bg-transparent border-b border-gray-300 dark:border-slate-600 focus:border-blue-500 outline-none text-sm font-mono" placeholder="Key" value={v.var_key} onChange={(e) => handleChange(idx, 'var_key', e.target.value)} /></td>
                                        <td className="px-6 py-2"><input type="text" className="w-full bg-transparent border-b border-gray-300 dark:border-slate-600 focus:border-blue-500 outline-none text-sm" placeholder="Value" value={v.var_value} onChange={(e) => handleChange(idx, 'var_value', e.target.value)} /></td>
                                        <td className="px-6 py-2 whitespace-nowrap">
                                            <button onClick={() => handleSave(idx)} className="text-gray-400 hover:text-green-500 mx-1" title="Save"><i className="fa-solid fa-check"></i></button>
                                            <button onClick={() => handleDeleteTrigger(idx)} className="text-gray-400 hover:text-red-500 mx-1" title="Delete"><i className="fa-solid fa-trash"></i></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {alertConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><i className="fa-solid fa-trash"></i></div>
                            <h3 className="text-lg font-semibold">Delete Variable</h3>
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

