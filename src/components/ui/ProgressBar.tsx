import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const STAGES = [
  { at: 0,  label: 'Starting up...' },
  { at: 20, label: 'Querying AI model...' },
  { at: 50, label: 'Ranking results...' },
  { at: 80, label: 'Curating top 17...' },
  { at: 95, label: 'Almost done...' },
];

export const ProgressBar = ({ active, progressPercent, progressStage }: { active: boolean, progressPercent: number, progressStage: string }) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (active) {
      setDisplayProgress(progressPercent);
    } else {
      if (displayProgress > 0) {
        setDisplayProgress(100);
        setTimeout(() => setDisplayProgress(0), 700);
      }
    }
  }, [active, progressPercent, displayProgress]);

  const currentStage = STAGES.slice().reverse().find(s => displayProgress >= s.at) || STAGES[0];
  const activeLabel = progressStage || currentStage.label;

  if (displayProgress === 0 && !active) return null;
  
  return (
    <div className="space-y-3 py-2">
      {/* Stage dots */}
      <div className="flex items-center justify-between gap-1">
        {STAGES.map((stage, i) => (
          <div key={i} className="flex items-center gap-1 flex-1 last:flex-none">
            <div className={`w-2.5 h-2.5 rounded-full border-2 border-black transition-all duration-300 flex-shrink-0 ${
              displayProgress >= stage.at ? 'bg-[#00FF00] shadow-[0_0_6px_#00FF00]' : 'bg-white'
            }`} />
            {i < STAGES.length - 1 && (
              <div className="h-0.5 flex-1 bg-black/10 overflow-hidden">
                <div className="h-full bg-[#00FF00]/40 transition-all duration-300"
                  style={{ width: displayProgress >= STAGES[i + 1].at ? '100%' : displayProgress >= stage.at ? '60%' : '0%' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main bar */}
      <div className="relative h-6 bg-black border-2 border-black overflow-hidden">
        {/* Fill */}
        <div className="absolute inset-y-0 left-0 bg-[#00FF00] transition-all duration-300 ease-out"
          style={{ width: `${displayProgress}%` }} />
        {/* Percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black tracking-widest text-black">
            {Math.round(displayProgress)}%
          </span>
        </div>
      </div>

      {/* Stage label */}
      <AnimatePresence mode="wait">
        <motion.div key={activeLabel}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          className="text-xs font-bold uppercase tracking-widest text-black/50 flex items-center gap-2">
          {activeLabel}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
