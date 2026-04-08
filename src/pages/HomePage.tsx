import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, TrendingUp, ChevronRight, Loader2 } from 'lucide-react';
import { collection, doc, setDoc, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateList } from '../services/geminiService';
import { List as ListType, Tone } from '../types';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { ProgressBar } from '../components/ui/ProgressBar';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const TONE_INFO: Record<string, { emoji: string; headline: string; detail: string }> = {
  serious:       { emoji: '📊', headline: 'Data-driven & factual', detail: 'Rankings based on measurable metrics, expert reviews, and verified performance data. No fluff — just the most accurate list possible.' },
  funny:         { emoji: '😄', headline: 'Witty but accurate',    detail: 'Same rigorous rankings written with humor and personality. Perfect for sharing. Facts first, entertainment guaranteed.' },
  educational:   { emoji: '🎓', headline: 'Deep context & insight',detail: 'Every item comes with rich background: history, impact, key details, and why it matters. Ideal for learning.' },
  controversial: { emoji: '🔥', headline: 'Bold & contrarian',     detail: 'Challenges conventional wisdom with surprising, debated picks. Expect the unexpected — rankings that spark discussion.' },
};

export const HomePage = () => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('educational');
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStage, setGenStage] = useState('');
  const [trending, setTrending] = useState<ListType[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // SECURITY: Disable Inspect / Right Click
    const handleContext = (e: MouseEvent) => e.preventDefault();
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'i' || e.key === 'j')) e.preventDefault();
      if (e.key === 'F12') e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('keydown', handleKey);
    
    if (!db) {
      const localLists = JSON.parse(localStorage.getItem('listoff_lists') || '[]');
      setTrending(localLists.slice(0, 6));
    } else {
      const q = query(collection(db, 'lists'), orderBy('createdAt', 'desc'), limit(6));
      const unsub = onSnapshot(q, snap => setTrending(snap.docs.map(d => d.data() as ListType)),
        err => {
          console.warn('Trending from Firebase failed, using localStorage:', err);
          const localLists = JSON.parse(localStorage.getItem('listoff_lists') || '[]');
          setTrending(localLists.slice(0, 6));
        });
      return () => {
        unsub();
        document.removeEventListener('contextmenu', handleContext);
        document.removeEventListener('keydown', handleKey);
      };
    }
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setGenProgress(10);
    setGenStage('Thinking...');
    
    // Smooth progress simulation
    const interval = setInterval(() => {
      setGenProgress(prev => (prev < 90 ? prev + 1 : prev));
    }, 100);

    try {
      const items = await generateList(topic, tone, (p, s) => {
        // Sync with real emitter if available
        if (s) setGenStage(s);
      });
      clearInterval(interval);
      setGenProgress(100);
      
      const listId = crypto.randomUUID();
      const newList: ListType = { id: listId, topic, tone, items, createdAt: new Date().toISOString() };
      
      sessionStorage.setItem(`list_${listId}`, JSON.stringify(newList));
      navigate(`/list/${listId}`);
    } catch (error) {
      clearInterval(interval);
      setToast({ message: 'Speed limit exceeded or AI offline.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#F5F5F0]">
      <Toast message={toast?.message || null} type={toast?.type || 'info'} onClose={() => setToast(null)} />

      <main className="max-w-4xl mx-auto p-6 sm:p-12">
        <section className="mb-20 relative">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="text-6xl sm:text-8xl md:text-9xl font-black mb-4 leading-[0.9] tracking-tighter hover:text-[#00FF00] transition-colors duration-200 relative z-10"
          >
            ListOFF
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl sm:text-2xl font-bold mb-10 text-zinc-600 max-w-xl leading-snug"
          >
            Generate curated, ranked lists on any topic using deep data insights.
          </motion.p>

          <form onSubmit={handleSearch} className="space-y-6 relative z-10">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1 w-full">
                <div className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">List of _</div>
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="best sci-fi movies..." disabled={loading} autoComplete="off"
                  className="w-full text-2xl sm:text-4xl md:text-5xl font-bold bg-transparent border-b-4 border-black focus:outline-none focus:border-[#00FF00] focus:bg-[#00FF00]/5 transition-all placeholder:opacity-20 py-2 px-1" />
              </div>
              <Button type="submit" disabled={loading || !topic.trim()}
                className="w-full sm:w-auto h-14 sm:h-[70px] flex items-center justify-center gap-2 text-base sm:text-lg flex-shrink-0">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ChevronRight className="w-6 h-6" />}
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
            <ProgressBar active={loading} progressPercent={genProgress} progressStage={genStage} />
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {(['serious', 'funny', 'educational', 'controversial'] as Tone[]).map(t => (
                  <button key={t} type="button" onClick={() => setTone(t)} disabled={loading}
                    className={cn("px-4 py-2 border-2 border-black font-bold text-sm uppercase transition-all disabled:opacity-40",
                      tone === t ? "bg-black text-white shadow-[4px_4px_0_0_rgba(0,255,0,1)] -translate-y-0.5 -translate-x-0.5"
                                 : "bg-white hover:bg-zinc-100 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5")}>
                    {t}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={tone} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.12 }} className="overflow-hidden">
                  <div className="flex items-start gap-3 bg-white border-2 border-black p-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <span className="text-2xl flex-shrink-0 leading-none mt-0.5">{TONE_INFO[tone]?.emoji}</span>
                    <div>
                      <div className="text-sm font-black uppercase tracking-widest text-[#00FF00] bg-black inline-block px-2 py-0.5 mb-1.5">{TONE_INFO[tone]?.headline}</div>
                      <p className="text-sm font-medium text-zinc-600 leading-snug">{TONE_INFO[tone]?.detail}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </form>
          
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 py-10 border-t-2 border-black/10">
            <div>
              <div className="text-xl font-black mb-2 uppercase italic tracking-tighter">01. Intelligent Search</div>
              <p className="text-sm text-zinc-500 font-medium">We scan verified data sources across the entire knowledge graph to identify the most relevant candidates.</p>
            </div>
            <div>
              <div className="text-xl font-black mb-2 uppercase italic tracking-tighter">02. Data Ranking</div>
              <p className="text-sm text-zinc-500 font-medium">Rankings aren't arbitrary. We weight factors like expert consensus, user sentiment, and factual correctness.</p>
            </div>
            <div>
              <div className="text-xl font-black mb-2 uppercase italic tracking-tighter">03. Curated Export</div>
              <p className="text-sm text-zinc-500 font-medium">Get a pristine, shareable list in your preferred tone. Export to CSV or PDF for permanent reference.</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-[#00FF00] bg-black p-1 w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Lists you have generated</h2>
          </div>
          {trending.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {trending.map((list, i) => (
                <Link key={list.id} to={`/list/${list.id}`}>
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="bg-white border-2 border-black p-5 shadow-[5px_5px_0_0_rgba(0,0,0,1)] hover:shadow-[9px_9px_0_0_rgba(0,255,0,1)] hover:-translate-y-1 hover:-translate-x-1 transition-all cursor-pointer group">
                    <div className="text-xs font-bold uppercase mb-2 flex justify-between opacity-60">
                      <span className="bg-black text-[#00FF00] px-2 py-0.5">{list.tone}</span>
                      <span>{list.items?.length ?? 0} items</span>
                    </div>
                    <h3 className="text-lg font-black leading-tight group-hover:underline underline-offset-4 decoration-4 decoration-[#00FF00]">
                      List of {list.topic}
                    </h3>
                  </motion.div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border-4 border-dashed border-black/10 p-16 text-center bg-white/50">
              <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-black uppercase opacity-30">No lists generated yet</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
