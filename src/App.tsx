import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { Layout } from './components/ui/Layout';
import { HomePage } from './pages/HomePage';
import { ListPage } from './pages/ListPage';

export default function App() {
  // Connection ping for Firestore warmth
  useEffect(() => {
    async function ping() { 
      try { await getDocFromServer(doc(db, 'test', 'connection')); } catch { /* silent fallback */ } 
    }
    ping();
  }, []);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/list/:id" element={<ListPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
