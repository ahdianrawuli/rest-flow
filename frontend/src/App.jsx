import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import Variables from './pages/Variables';
import Mocks from './pages/Mocks';
import Scenarios from './pages/Scenarios';
import Header from './components/Header';
import ActivityBar from './components/ActivityBar';
import Functions from './pages/Functions';

function RequireAuth({ children }) {
    const token = localStorage.getItem('rf_token');
    return token ? children : <Navigate to="/auth" />;
}

export default function App() {
    const [theme, setTheme] = useState(localStorage.getItem('rf_theme') || 'light');
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(parseInt(localStorage.getItem('rf_active_workspace')) || null);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('rf_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    return (
        <HashRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/*" element={
                    <RequireAuth>
                        <MainLayout
                            theme={theme}
                            toggleTheme={toggleTheme}
                            activeWorkspaceId={activeWorkspaceId}
                            setActiveWorkspaceId={setActiveWorkspaceId}
                        />
                    </RequireAuth>
                } />
            </Routes>
        </HashRouter>
    );
}

function MainLayout({ theme, toggleTheme, activeWorkspaceId, setActiveWorkspaceId }) {
    const [sidebarOpen, setSidebarOpen] = useState(false); // Untuk Mobile
    const [desktopCollapsed, setDesktopCollapsed] = useState(true); // Untuk Desktop (Default: Ringkas)

    return (
        <div id="app" className="fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-gray-50 dark:bg-slate-900 text-sm">
            
            {/* HEADER MELAYANG (Absolute) - Ketinggian diperkecil jadi h-12 */}
            <div className="absolute top-0 left-0 right-0 z-50">
                <Header
                    toggleTheme={toggleTheme}
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                />
            </div>

            {/* BODY / MAIN LAYOUT */}
            <div className="flex-1 flex flex-row relative z-0 h-full w-full overflow-hidden">
                
                {/* ACTIVITY BAR - Ketinggian menyesuaikan header (mt-12) */}
                <div className="mt-12 h-[calc(100%-3rem)] flex shrink-0 z-40 relative">
                    <ActivityBar 
                        sidebarOpen={sidebarOpen} 
                        setSidebarOpen={setSidebarOpen} 
                        desktopCollapsed={desktopCollapsed}
                        setDesktopCollapsed={setDesktopCollapsed}
                        activeWorkspaceId={activeWorkspaceId}
                        setActiveWorkspaceId={setActiveWorkspaceId}
                    />
                </div>

                {/* Overlay for mobile sidebar */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 md:hidden mt-12"
                        onClick={() => setSidebarOpen(false)}
                    ></div>
                )}

                {/* KONTEN UTAMA */}
                <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden relative flex flex-col bg-white dark:bg-slate-850">
                    
                    {/* Spacer Setinggi Header (48px / h-12) */}
                    <div className="h-12 w-full shrink-0 block pointer-events-none"></div>

                    {/* Pembungkus Routing */}
                    <div className="flex-1 w-full flex flex-col relative min-h-0">
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" />} />
                            <Route path="/dashboard" element={<Dashboard activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/requests" element={<Requests activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/variables" element={<Variables activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/mocks" element={<Mocks activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/scenarios" element={<Scenarios activeWorkspaceId={activeWorkspaceId} />} />
                 	    <Route path="/functions" element={<Functions activeWorkspaceId={activeWorkspaceId} />} />
                        </Routes>
                    </div>
                </div>
            </div>
        </div>
    );
}
