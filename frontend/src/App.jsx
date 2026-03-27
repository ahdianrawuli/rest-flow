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
import Footer from './components/Footer';

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
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div id="app" className="fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-gray-50 dark:bg-slate-900">
            
            {/* HEADER MELAYANG (Absolute) */}
            <div className="absolute top-0 left-0 right-0 z-50">
                <Header
                    toggleTheme={toggleTheme}
                    activeWorkspaceId={activeWorkspaceId}
                    setActiveWorkspaceId={setActiveWorkspaceId}
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                />
            </div>

            {/* BODY / MAIN LAYOUT */}
            <div className="flex-1 flex flex-row relative z-0 h-full w-full overflow-hidden">
                
                {/* ACTIVITY BAR */}
                <div className="mt-14 h-[calc(100%-3.5rem)] flex shrink-0 z-40 relative">
                    <ActivityBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
                </div>

                {/* Overlay for mobile sidebar */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 md:hidden mt-14"
                        onClick={() => setSidebarOpen(false)}
                    ></div>
                )}

                {/* KONTEN UTAMA */}
                <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden relative flex flex-col">
                    
                    {/* Spacer Setinggi Header (56px) - Mencegah konten awal tertutup header */}
                    <div className="h-14 w-full shrink-0 block pointer-events-none"></div>

                    {/* PERBAIKAN: Padding dihapus total agar konten (seperti sidebar) membentang full screen ke ujung bawah dan samping layar */}
                    <div className="flex-1 w-full flex flex-col relative min-h-0">
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" />} />
                            <Route path="/dashboard" element={<Dashboard activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/requests" element={<Requests activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/variables" element={<Variables activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/mocks" element={<Mocks activeWorkspaceId={activeWorkspaceId} />} />
                            <Route path="/scenarios" element={<Scenarios activeWorkspaceId={activeWorkspaceId} />} />
                        </Routes>
                    </div>
                </div>
            </div>

            {/* FOOTER MELAYANG (Absolute) */}
            <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none">
                <div className="pointer-events-auto">
                    <Footer />
                </div>
            </div>
        </div>
    );
}
