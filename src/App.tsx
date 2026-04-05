import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, TrendingUp, ChevronRight, Loader2, ArrowLeft,
  ExternalLink, X, ShoppingCart, 
  Download, RefreshCcw, Printer, Clock, CheckCircle
} from 'lucide-react';
import { 
  collection, doc, setDoc, getDoc, query, 
  orderBy, limit, onSnapshot, Timestamp, getDocFromServer
} from 'firebase/firestore';
import { db } from './firebase';
import { generateList } from './services/geminiService';
import { List as ListType, ListItem, Tone } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ─── Toast ───
const Toast = ({ message, type, onClose }: { message: string | null, type: 'error' | 'info', onClose: () => void }) => (
  <AnimatePresence>
    {message && (
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.15 }}
        className={cn("fixed bottom-8 right-8 p-5 border-4 border-black font-bold uppercase tracking-wider z-[100] shadow-[8px_8px_0_0_rgba(0,0,0,1)] max-w-sm text-sm",
          type === 'error' ? "bg-red-500 text-white" : "bg-[#00FF00] text-black")}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="leading-snug">{message}</span>
          <button onClick={onClose} className="hover:opacity-50 transition-opacity mt-0.5 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Button ───
const Button = ({ children, className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' }) => {
  const variants = {
    primary:   "bg-black text-white hover:bg-[#00FF00] hover:text-black border-2 border-black",
    secondary: "bg-[#00FF00] text-black hover:bg-black hover:text-[#00FF00] border-2 border-black",
    outline:   "border-2 border-black bg-white hover:bg-[#00FF00] hover:text-black",
  };
  return (
    <button className={cn("px-5 py-2.5 font-bold uppercase tracking-wider transition-all duration-150 outline-none active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5", variants[variant], className)} {...props}>
      {children}
    </button>
  );
};

// ─── Stunning Progress Bar ───
const STAGES = [
  { at: 0,  label: 'Starting up...' },
  { at: 20, label: 'Querying AI model...' },
  { at: 50, label: 'Ranking results...' },
  { at: 80, label: 'Curating top 17...' },
  { at: 95, label: 'Almost done...' },
];

const ProgressBar = ({ active, progressPercent, progressStage }: { active: boolean, progressPercent: number, progressStage: string }) => {
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
  }, [active, progressPercent]);

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

// ─── Tone descriptions ───
const TONE_INFO: Record<string, { emoji: string; headline: string; detail: string }> = {
  serious:       { emoji: '📊', headline: 'Data-driven & factual', detail: 'Rankings based on measurable metrics, expert reviews, and verified performance data. No fluff — just the most accurate list possible.' },
  funny:         { emoji: '😄', headline: 'Witty but accurate',    detail: 'Same rigorous rankings written with humor and personality. Perfect for sharing. Facts first, entertainment guaranteed.' },
  educational:   { emoji: '🎓', headline: 'Deep context & insight',detail: 'Every item comes with rich background: history, impact, key details, and why it matters. Ideal for learning.' },
  controversial: { emoji: '🔥', headline: 'Bold & contrarian',     detail: 'Challenges conventional wisdom with surprising, debated picks. Expect the unexpected — rankings that spark discussion.' },
};

// ─── Export Dropdown ───
const ExportMenu = ({ list }: { list: ListType }) => {
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
            initial={{ opacity: 0, y: -8, scaleY: 0.9 }} animate={{ opacity: 1, y: 0, scaleY: 1 }} exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full mt-2 w-52 bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] z-50 overflow-hidden"
          >
            {options.map(opt => (
              <button key={opt.label} onClick={opt.action}
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

const LOADING_TEXTS = [
  "Searching knowledge base...",
  "Ranking by quality & data...",
  "Curating the top 17...",
  "Running rigorous checks...",
  "Almost ready...",
];

// ─── Home Page ───
const HomePage = () => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('educational');
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStage, setGenStage] = useState('');
  const [trending, setTrending] = useState<ListType[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'lists'), orderBy('createdAt', 'desc'), limit(6));
    const unsub = onSnapshot(q, snap => setTrending(snap.docs.map(d => d.data() as ListType)),
      err => {
        console.warn('Trending from Firebase failed, using localStorage:', err);
        const localLists = JSON.parse(localStorage.getItem('listoff_lists') || '[]');
        setTrending(localLists.slice(0, 6));
      });
    return () => unsub();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setGenProgress(0);
    setGenStage('Starting up...');
    setToast(null);
    try {
      const items = await generateList(topic, tone, (p, s) => {
        setGenProgress(p);
        setGenStage(s);
      });
      const listId = Math.random().toString(36).substring(2, 15);
      const newList: ListType = { id: listId, topic, tone, items, createdAt: new Date().toISOString() };
      try {
        await setDoc(doc(db, 'lists', listId), { ...newList, createdAt: Timestamp.fromDate(new Date()) });
      } catch (dbErr) {
        console.warn('DB save failed, using localStorage:', dbErr);
        const existingLists = JSON.parse(localStorage.getItem('listoff_lists') || '[]');
        existingLists.unshift(newList);
        localStorage.setItem('listoff_lists', JSON.stringify(existingLists.slice(0, 50)));
      }
      sessionStorage.setItem(`list_${listId}`, JSON.stringify(newList));
      navigate(`/list/${listId}`);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Failed. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-black font-sans selection:bg-[#00FF00]">
      <style>{`
        @media print { header,footer,.no-print{display:none!important;} }
      `}</style>
      <Toast message={toast?.message || null} type={toast?.type || 'info'} onClose={() => setToast(null)} />

      <header className="border-b-2 border-black p-4 sm:p-6 flex justify-between items-center bg-white sticky top-0 z-50">
        <Link to="/" className="text-2xl sm:text-4xl font-black tracking-tighter hover:bg-[#00FF00] hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all">
          ListOFF
        </Link>
      </header>

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
              {/* Tone description panel */}
              <AnimatePresence mode="wait">
                <motion.div key={tone}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-3 bg-white border-2 border-black p-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <span className="text-2xl flex-shrink-0 leading-none mt-0.5">{TONE_INFO[tone]?.emoji}</span>
                    <div>
                      <div className="text-sm font-black uppercase tracking-widest text-[#00FF00] bg-black inline-block px-2 py-0.5 mb-1.5">
                        {TONE_INFO[tone]?.headline}
                      </div>
                      <p className="text-sm font-medium text-zinc-600 leading-snug">
                        {TONE_INFO[tone]?.detail}
                      </p>
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
            <h2 className="text-2xl font-black uppercase tracking-tight">Lists u have generated</h2>
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

      <footer className="border-t-4 border-black p-10 mt-24 bg-white">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-3xl font-black tracking-tighter bg-[#00FF00] text-black border-4 border-black px-4 py-2 hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 transition-all cursor-default">ListOFF</div>
          <div className="text-right">
            <p className="text-sm font-black uppercase tracking-widest text-black">Human Positioning · AI Precision</p>
            <p className="text-xs font-bold opacity-30 uppercase tracking-widest mt-1">Curated ranked lists for serious data users.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ─── List Page ───
const ListPage = () => {
  const { id } = useParams();
  const [list, setList] = useState<ListType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refProgress, setRefProgress] = useState(0);
  const [refStage, setRefStage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const navigate = useNavigate();

  const fetchList = async () => {
    if (!id) return;
    setLoading(true);
    setRefreshing(false); // Reset refreshing state on id change
    window.scrollTo(0, 0); // Always reset scroll
    
    // 1. Check session storage (just generated)
    const sessionData = sessionStorage.getItem(`list_${id}`);
    if (sessionData) {
      setList(JSON.parse(sessionData));
      setLoading(false);
      return;
    }

    // 2. Try Firebase
    try {
      const snap = await getDoc(doc(db, 'lists', id));
      if (snap.exists()) {
        const data = snap.data();
        setList({ ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString() } as ListType);
        setLoading(false);
        return;
      }
    } catch (err) {
      // 3. Fallback to localStorage
      console.warn('Firebase load failed, checking local storage', err);
      const localLists = JSON.parse(localStorage.getItem('listoff_lists') || '[]');
      const found = localLists.find((l: ListType) => l.id === id);
      if (found) {
        setList(found);
        setLoading(false);
        return;
      }
    }
    
    setToast({ message: 'List not found. Returning home...', type: 'error' });
    setTimeout(() => navigate('/'), 2000);
    setLoading(false);
  };

  useEffect(() => { fetchList(); }, [id]);

  // Refresh = regenerate the same topic/tone, save as new list
  const handleRefresh = async () => {
    if (!list) return;
    setRefreshing(true);
    setRefProgress(0);
    setRefStage('Regenerating...');
    setToast({ message: 'Regenerating list...', type: 'info' });
    try {
      // Pass bypass cache param to the backend for refresh
      const items = await generateList(list.topic, list.tone, (p, s) => {
        setRefProgress(p);
        setRefStage(s);
      }, true);
      const newId = Math.random().toString(36).substring(2, 15);
      const newList: ListType = { id: newId, topic: list.topic, tone: list.tone, items, createdAt: new Date().toISOString() };
      try {
        await setDoc(doc(db, 'lists', newId), { ...newList, createdAt: Timestamp.fromDate(new Date()) });
      } catch (dbErr) {
        console.warn('DB refresh save failed, using localStorage:', dbErr);
        const existingLists = JSON.parse(localStorage.getItem('listoff_lists') || '[]');
        existingLists.unshift(newList);
        localStorage.setItem('listoff_lists', JSON.stringify(existingLists.slice(0, 50)));
      }
      sessionStorage.setItem(`list_${newId}`, JSON.stringify(newList));
      navigate(`/list/${newId}`);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Refresh failed.', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F0] gap-4">
      <Loader2 className="w-14 h-14 animate-spin" />
      <h2 className="text-xl font-black uppercase tracking-tighter">Loading...</h2>
    </div>
  );

  if (!list) return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <Toast message={toast?.message || null} type="error" onClose={() => setToast(null)} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-black font-sans selection:bg-[#00FF00]">
      <Toast message={toast?.message || null} type={toast?.type || 'info'} onClose={() => setToast(null)} />

      <header className="border-b-2 border-black p-4 sm:p-5 flex justify-between items-center bg-white sticky top-0 z-50 no-print">
        <Link to="/" className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-1.5 bg-[#00FF00] text-black px-2 sm:px-3 py-1 border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] sm:shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> ListOFF
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" className="text-[10px] sm:text-xs px-2.5 sm:px-4 flex items-center gap-2" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", refreshing && "animate-spin")} />
            <span className="hidden xs:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <ExportMenu list={list} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-12 border-b-4 border-black pb-10">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="text-xs font-bold uppercase tracking-widest border-2 border-black inline-block px-3 py-1 shadow-[3px_3px_0_0_rgba(0,255,0,1)] bg-white">
              {list.tone} · {list.items?.length ?? 0} items
            </div>
            {list.createdAt && (
              <div className="text-xs font-bold uppercase tracking-widest border-2 border-black inline-flex items-center gap-1.5 px-3 py-1 bg-white opacity-80 shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
                <Clock className="w-3.5 h-3.5" /> 
                {new Date(list.createdAt).toLocaleString(undefined, { 
                  year: 'numeric', month: 'short', day: 'numeric', 
                  hour: 'numeric', minute: '2-digit' 
                })}
              </div>
            )}
          </div>
          <h1 className="text-5xl sm:text-7xl font-black leading-none tracking-tighter">
            List of<br />
            <span className="text-[#00FF00] bg-black px-4 inline-block transform -skew-x-2 mt-2">{list.topic}</span>
          </h1>
        </motion.div>

        {/* Refresh progress */}
        {refreshing && <div className="mb-6"><ProgressBar active={refreshing} progressPercent={refProgress} progressStage={refStage} /></div>}

        <div className={cn("space-y-5 transition-all duration-700", refreshing && "opacity-30 blur-[1px] grayscale pointer-events-none")}>
          {(list.items ?? []).map((item: ListItem, index: number) => (
            <motion.div key={item.title ?? index}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.035 }}
              className="group bg-white border-2 border-black shadow-[5px_5px_0_0_rgba(0,0,0,1)] hover:shadow-[9px_9px_0_0_rgba(0,255,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row relative">
                {/* Ranking Number */}
                <div className="hidden sm:flex flex-col items-center justify-center p-4 min-w-[80px] border-r-2 border-black bg-black/5 text-[#00FF00]">
                  <span className="text-3xl font-black bg-black px-2 py-1 leading-none shadow-[2px_2px_0_0_#00FF00]">
                    #{String(item.rank ?? index + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 p-5 relative">
                  <div className="absolute top-0 right-0 sm:hidden bg-black text-[#00FF00] px-2 py-1 text-sm font-black m-3 shadow-[2px_2px_0_0_#00FF00]">
                    #{String(item.rank ?? index + 1).padStart(2, '0')}
                  </div>
                  
                  <div className="flex items-start justify-between gap-2 mb-2 pr-12 sm:pr-0">
                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight">{item.title}</h3>
                    {item.isProduct && (
                      <span className="text-xs font-bold bg-[#00FF00] border border-black px-2 py-0.5 flex-shrink-0 uppercase whitespace-nowrap">Product</span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-zinc-700 leading-snug mb-3">{item.description}</p>
                  {item.why && (
                    <p className="text-sm font-bold italic text-black bg-[#00FF00]/10 px-4 py-3 border-l-4 border-[#00FF00] mb-3">
                      "{item.why}"
                    </p>
                  )}
                  {item.isProduct && item.buyLinks && item.buyLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t-2 border-black/10">
                      <span className="text-xs font-black uppercase flex items-center gap-1 opacity-40 self-center">
                        <ShoppingCart className="w-3 h-3" /> Buy:
                      </span>
                      {item.buyLinks.map(link => (
                        <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-bold uppercase border-2 border-black px-3 py-1 bg-white hover:bg-black hover:text-[#00FF00] transition-all flex items-center gap-1 hover:shadow-[3px_3px_0_0_rgba(0,255,0,1)]">
                          {link.name} <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                  {item.sourceName && item.sourceUrl && (
                    <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t-2 border-black/10">
                      <span className="text-xs font-black uppercase flex items-center gap-1 text-black/50 self-center">
                        <CheckCircle className="w-3 h-3 text-[#00FF00]" /> Verified Source:
                      </span>
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold underline decoration-[#00FF00] decoration-2 underline-offset-4 hover:text-[#00FF00] transition-all flex items-center gap-1">
                        {item.sourceName} <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 p-10 border-4 border-black bg-[#00FF00] text-center shadow-[14px_14px_0_0_rgba(0,0,0,1)] no-print">
          <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Want another list?</h2>
          <Link to="/"><Button className="h-12 px-8 text-base bg-black text-white hover:bg-white hover:text-black">Back to home</Button></Link>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  useEffect(() => {
    async function ping() { try { await getDocFromServer(doc(db, 'test', 'connection')); } catch { /* silent */ } }
    ping();
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/list/:id" element={<ListPage />} />
      </Routes>
    </Router>
  );
}
