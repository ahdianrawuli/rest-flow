import React from 'react';

export default function Footer() {
    return (
        <footer className="h-10 border-t border-gray-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md flex items-center justify-center w-full text-center px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-200 z-10">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span className="select-none">Powered by</span>
                
                <div className="group relative flex items-center gap-1.5 cursor-default mx-0.5">
                    {/* Ikon Sparkles */}
                    <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 dark:text-indigo-400 group-hover:animate-pulse transition-all text-[10px]"></i>
                    
                    {/* Teks AutoDev Gradasi */}
                    <span className="font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 text-sm">
                        AutoDev
                    </span>
                    
                    {/* Animasi Garis Bawah */}
                    <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300 ease-out rounded-full"></span>
                </div>
                
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 select-none ml-0.5">© 2026</span>
            </div>
        </footer>
    );
}

