import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, RefreshCcw, Clock, ShoppingCart, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateList } from '../services/geminiService';
import { List as ListType, ListItem } from '../types';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ExportMenu } from '../components/lists/ExportMenu';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const ListPage = () => {
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
    setRefreshing(false);
    window.scrollTo(0, 0);
    
    const sessionData = sessionStorage.getItem(`list_${id}`);
    if (sessionData) {
      setList(JSON.parse(sessionData));
      setLoading(false);
      return;
    }

    try {
      if (!db) throw new Error('Firestore not initialized');
      const snap = await getDoc(doc(db, 'lists', id));
      if (snap.exists()) {
        const data = snap.data();
        setList({ ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString() } as ListType);
        setLoading(false);
        return;
      }
    } catch (err) {
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

  const handleRefresh = async () => {
    if (!list) return;
    setRefreshing(true);
    setRefProgress(0);
    setRefStage('Regenerating...');
    setToast({ message: 'Regenerating list...', type: 'info' });
    try {
      const items = await generateList(list.topic, list.tone, (p, s) => {
        setRefProgress(p);
        setRefStage(s);
      }, true);
      const newId = crypto.randomUUID();
      const newList: ListType = { id: newId, topic: list.topic, tone: list.tone, items, createdAt: new Date().toISOString() };
      try {
        if (!db) throw new Error('Firestore not initialized');
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

  if (!list) return <div className="min-h-screen bg-[#F5F5F0]"><Toast message={toast?.message || null} type="error" onClose={() => setToast(null)} /></div>;

  return (
    <div className="bg-[#F5F5F0]">
      <Toast message={toast?.message || null} type={toast?.type || 'info'} onClose={() => setToast(null)} />

      <div className="border-b-2 border-black p-4 sm:p-5 flex justify-between items-center bg-white sticky top-0 z-50 no-print">
        <Link to="/" className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-1.5 bg-[#00FF00] text-black px-2 sm:px-3 py-1 border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] sm:shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Back
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" className="text-[10px] sm:text-xs px-2.5 sm:px-4 flex items-center gap-2" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", refreshing && "animate-spin")} />
            <span className="hidden xs:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <ExportMenu list={list} />
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-12 border-b-4 border-black pb-10">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="text-xs font-bold uppercase tracking-widest border-2 border-black inline-block px-3 py-1 shadow-[3px_3px_0_0_rgba(0,255,0,1)] bg-white">
              {list.tone} · {list.items?.length ?? 0} items
            </div>
            {list.createdAt && (
              <div className="text-xs font-bold uppercase tracking-widest border-2 border-black inline-flex items-center gap-1.5 px-3 py-1 bg-white opacity-80 shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
                <Clock className="w-3.5 h-3.5" /> {new Date(list.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
          </div>
          <h1 className="text-5xl sm:text-7xl font-black leading-none tracking-tighter">
            List of<br />
            <span className="text-[#00FF00] bg-black px-4 inline-block transform -skew-x-2 mt-2">{list.topic}</span>
          </h1>
        </motion.div>

        {refreshing && <div className="mb-6"><ProgressBar active={refreshing} progressPercent={refProgress} progressStage={refStage} /></div>}

        <div className={cn("space-y-5 transition-all duration-700", refreshing && "opacity-30 blur-[1px] grayscale pointer-events-none")}>
          {(list.items ?? []).map((item: ListItem, index: number) => (
            <motion.div key={item.title ?? index} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.035 }} className="group bg-white border-2 border-black shadow-[5px_5px_0_0_rgba(0,0,0,1)] hover:shadow-[9px_9px_0_0_rgba(0,255,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all overflow-hidden">
              <div className="flex flex-col sm:flex-row relative">
                <div className="hidden sm:flex flex-col items-center justify-center p-4 min-w-[80px] border-r-2 border-black bg-black/5 text-[#00FF00]">
                  <span className="text-3xl font-black bg-black px-2 py-1 leading-none shadow-[2px_2px_0_0_#00FF00]">#{String(item.rank ?? index + 1).padStart(2, '0')}</span>
                </div>
                <div className="flex-1 p-5 relative">
                  <div className="absolute top-0 right-0 sm:hidden bg-black text-[#00FF00] px-2 py-1 text-sm font-black m-3 shadow-[2px_2px_0_0_#00FF00]">#{String(item.rank ?? index + 1).padStart(2, '0')}</div>
                  <div className="flex items-start justify-between gap-2 mb-2 pr-12 sm:pr-0">
                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight">{item.title}</h3>
                    {item.isProduct && <span className="text-xs font-bold bg-[#00FF00] border border-black px-2 py-0.5 flex-shrink-0 uppercase whitespace-nowrap">Product</span>}
                  </div>
                  <p className="text-sm sm:text-base text-zinc-700 leading-snug mb-3">{item.description}</p>
                  {item.why && <p className="text-sm font-bold italic text-black bg-[#00FF00]/10 px-4 py-3 border-l-4 border-[#00FF00] mb-3">"{item.why}"</p>}
                  {item.isProduct && item.buyLinks && item.buyLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t-2 border-black/10">
                      <span className="text-xs font-black uppercase flex items-center gap-1 opacity-40 self-center"><ShoppingCart className="w-3 h-3" /> Buy:</span>
                      {item.buyLinks.map(link => (
                        <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase border-2 border-black px-3 py-1 bg-white hover:bg-black hover:text-[#00FF00] transition-all flex items-center gap-1 hover:shadow-[3px_3px_0_0_rgba(0,255,0,1)]">{link.name} <ExternalLink className="w-3 h-3" /></a>
                      ))}
                    </div>
                  )}
                  {item.sourceName && item.sourceUrl && (
                    <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t-2 border-black/10">
                      <span className="text-xs font-black uppercase flex items-center gap-1 text-black/50 self-center"><CheckCircle className="w-3 h-3 text-[#00FF00]" /> Verified Source:</span>
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold underline decoration-[#00FF00] decoration-2 underline-offset-4 hover:text-[#00FF00] transition-all flex items-center gap-1">{item.sourceName} <ExternalLink className="w-3 h-3 opacity-50" /></a>
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
