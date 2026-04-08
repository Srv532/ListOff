import React from 'react';
import { Link } from 'react-router-dom';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-[#F5F5F0] text-black font-sans selection:bg-[#00FF00]">
      <style>{`
        @media print { header,footer,.no-print{display:none!important;} }
      `}</style>
      
      <header className="border-b-2 border-black p-4 sm:p-6 flex justify-between items-center bg-white sticky top-0 z-50">
        <Link to="/" className="text-2xl sm:text-4xl font-black tracking-tighter hover:bg-[#00FF00] hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all">
          ListOFF
        </Link>
      </header>

      {children}

      <footer className="border-t-4 border-black p-10 mt-24 bg-white no-print">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-3xl font-black tracking-tighter bg-[#00FF00] text-black border-4 border-black px-4 py-2 hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 transition-all cursor-default">
            ListOFF
          </div>
          <div className="text-right">
            <p className="text-sm font-black uppercase tracking-widest text-black">Human Positioning · AI Precision</p>
            <p className="text-xs font-bold opacity-30 uppercase tracking-widest mt-1">Curated ranked lists for serious data users.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
