import React from 'react';
import { NavLink } from 'react-router-dom';

export default function ActivityBar({ sidebarOpen, setSidebarOpen }) {
    const navLinkClass = ({ isActive }) =>
        `w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative ${
            isActive
                ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
        }`;

    return (
        <nav className={`w-20 bg-gray-100 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col items-center py-4 gap-6 shrink-0 z-50 absolute md:relative h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <NavLink to="/dashboard" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-house text-xl mb-1"></i>
                <span className="text-[10px] font-medium leading-none">Dashboard</span>
            </NavLink>
            <NavLink to="/requests" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-paper-plane text-xl mb-1"></i>
                <span className="text-[10px] font-medium leading-none">Requests</span>
            </NavLink>
            <NavLink to="/variables" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-v text-xl mb-1"></i>
                <span className="text-[10px] font-medium leading-none">Variables</span>
            </NavLink>
            <NavLink to="/mocks" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-server text-xl mb-1"></i>
                <span className="text-[10px] font-medium leading-none">Mocks</span>
            </NavLink>
            <NavLink to="/scenarios" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-flask text-xl mb-1"></i>
                <span className="text-[10px] font-medium leading-none">Scenarios</span>
            </NavLink>
        </nav>
    );
}
