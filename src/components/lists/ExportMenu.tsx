import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Printer } from 'lucide-react';
import { Button } from '../ui/Button';
import { List as ListType } from '../../types';

export const ExportMenu = ({ list }: { list: ListType }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exportAsCSV = () => {
    const header = 'Rank,Title,Description,Why,Is Product\n';
    const rows = (list.items ?? []).map(item =>
      `${item.rank},"${item.title.replace(/"/g, '""')}","${item.description.replace(/"/g, '""')}","${(item.why || '').replace(/"/g, '""')}",${item.isProduct ? 'Yes' : 'No'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `listoff-${list.topic.replace(/\s+/g, '-')}.csv`; a.click();
    setOpen(false);
  };

  const printList = () => { window.print(); setOpen(false); };

  const options = [
    { icon: <Download       className="w-4 h-4" />, label: 'Download Excel / CSV', action: exportAsCSV },
    { icon: <Printer        className="w-4 h-4" />, label: 'Print / PDF',          action: printList },
  ];

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" className="text-xs flex items-center gap-2" onClick={() => setOpen(o => !o)}>
        <Download className="w-4 h-4" /> Export
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.9 }} 
            animate={{ opacity: 1, y: 0, scaleY: 1 }} 
            exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full mt-2 w-52 bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] z-50 overflow-hidden"
          >
            {options.map(opt => (
              <button 
                key={opt.label} 
                onClick={opt.action}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wide hover:bg-[#00FF00] transition-colors border-b-2 border-black/10 last:border-0 text-left"
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
