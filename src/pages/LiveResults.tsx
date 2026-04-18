import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, ShieldCheck, ArrowLeft, Bell, X, User, AlertTriangle
} from 'lucide-react';

export default function LiveResults({ socket }: { socket: any }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPu: 0,
    reportedPu: 0,
    totalAccredited: 0,
    totalVotes: 0,
    totalInvalid: 0,
    totalRegistered: 0,
    totalActiveVoters: 0,
    totalVotesCast: 0,
    totalWards: 0,
    reportedWards: 0,
    candidateVotes: [] as any[]
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    socket.on('stats_updated', fetchStats);
    socket.on('new_result_pending', (data: any) => {
      fetchStats();
      const newNotif = { 
        id: Date.now(), 
        type: 'report',
        message: `New result from ${data.agent_name}`,
        agent_name: data.agent_name,
        agent_photo: data.agent_photo,
        ward: data.ward,
        polling_unit: data.polling_unit
      };
      setNotifications(prev => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 6000);
    });

    socket.on('incident_alert', (data: any) => {
      const newNotif = { 
        id: Date.now(), 
        type: 'incident',
        message: data.description,
        agent_name: data.agent_name,
        agent_photo: data.agent_photo,
        ward: data.ward,
        polling_unit: data.polling_unit
      };
      setNotifications(prev => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 10000);
    });
    const interval = setInterval(fetchStats, 30000); // Auto refresh every 30s

    return () => {
      socket.off('stats_updated');
      socket.off('new_result_pending');
      clearInterval(interval);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full mb-8"
        />
        <h2 className="text-2xl font-black uppercase tracking-[0.3em] animate-pulse">Synchronizing Live Data</h2>
      </div>
    );
  }

  const winner = stats.candidateVotes[0];
  const runnerUp = stats.candidateVotes[1];

  return (
    <div className="h-screen bg-[#05080a] text-white font-sans selection:bg-emerald-500 selection:text-white flex flex-col relative overflow-hidden">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] -mr-96 -mt-96"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] -ml-64 -mb-64"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
      </div>

      {/* Real-time Notifications */}
      <div className="fixed top-24 right-6 z-50 space-y-3 w-80">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div 
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`bg-white border-l-4 shadow-2xl p-4 rounded-r-xl flex items-start gap-3 ${n.type === 'incident' ? 'border-rose-600' : 'border-emerald-500'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border ${n.type === 'incident' ? 'bg-rose-50 border-rose-100' : 'bg-slate-100 border-slate-200'}`}>
                {n.agent_photo ? (
                  <img src={n.agent_photo} alt={n.agent_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${n.type === 'incident' ? 'text-rose-400' : 'text-slate-400'}`}>
                    <User size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center gap-1 ${n.type === 'incident' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {n.type === 'incident' ? (
                    <>
                      <AlertTriangle size={10} className="animate-pulse" />
                      CRITICAL INCIDENT
                    </>
                  ) : 'Live Report'}
                </p>
                <p className="text-sm font-bold text-slate-900 truncate">{n.agent_name}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate">Ward: {n.ward}</p>
                {n.type === 'incident' && (
                  <p className="text-[9px] text-rose-500 font-bold mt-1 line-clamp-2 italic">"{n.message}"</p>
                )}
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                className="text-slate-300 hover:text-slate-500"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="relative z-10 p-4 md:p-5 max-w-[1400px] mx-auto w-full flex-1 flex flex-col space-y-3">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group w-fit"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
          </button>

          <header className="flex flex-col xl:flex-row justify-between items-center gap-8 border-b border-white/10 pb-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <ShieldCheck size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter uppercase font-display leading-none">
                  AK-27 <span className="text-emerald-500">Live Results</span>
                </h1>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-2 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Live Collation</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Update: {lastUpdate.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-auto flex justify-between xl:justify-start gap-4 md:gap-6 bg-white/5 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.3)]">
              <div className="text-center flex-1 xl:flex-none xl:min-w-[100px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Registered</p>
                <p className="text-3xl md:text-4xl font-black text-white font-display tracking-tighter leading-none">{stats.totalRegistered.toLocaleString()}</p>
              </div>
              <div className="w-px h-10 md:h-12 bg-white/20 self-center"></div>
              <div className="text-center flex-1 xl:flex-none xl:min-w-[100px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Accredited</p>
                <p className="text-3xl md:text-4xl font-black text-blue-400 font-display tracking-tighter leading-none">{stats.totalAccredited.toLocaleString()}</p>
              </div>
              <div className="w-px h-10 md:h-12 bg-white/20 self-center"></div>
              <div className="text-center flex-1 xl:flex-none xl:min-w-[100px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Votes Cast</p>
                <p className="text-3xl md:text-4xl font-black text-amber-400 font-display tracking-tighter leading-none">{stats.totalVotesCast.toLocaleString()}</p>
              </div>
              <div className="w-px h-10 md:h-12 bg-white/20 self-center"></div>
              <div className="text-center flex-1 xl:flex-none xl:min-w-[100px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Votes Polled</p>
                <p className="text-3xl md:text-4xl font-black text-white font-display tracking-tighter leading-none">{stats.totalVotes.toLocaleString()}</p>
              </div>
              <div className="w-px h-10 md:h-12 bg-white/20 self-center"></div>
              <div className="text-center flex-1 xl:flex-none xl:min-w-[100px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Invalid</p>
                <p className="text-3xl md:text-4xl font-black text-rose-500 font-display tracking-tighter leading-none">{stats.totalInvalid.toLocaleString()}</p>
              </div>
              <div className="w-px h-10 md:h-12 bg-white/20 self-center"></div>
              <div className="text-center flex-1 xl:flex-none xl:min-w-[100px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Ward Report Progress</p>
                <p className="text-3xl md:text-4xl font-black text-emerald-400 font-display tracking-tighter leading-none">
                  {Math.round((stats.reportedWards / stats.totalWards) * 100) || 0}%
                </p>
              </div>
            </div>
          </header>
        </div>

        {/* Top 3 Podium Section */}
        <div className="flex-1 flex flex-col justify-center min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
            {/* 2nd Place */}
            {runnerUp && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 relative group hover:bg-white/10 transition-all duration-500"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-400 text-slate-950 px-3 py-1 rounded-full font-black uppercase tracking-widest text-[8px] shadow-lg">
                  2nd Position
                </div>
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-xl group-hover:scale-105 transition-transform duration-500">
                    {runnerUp.candidate_picture ? (
                      <img src={runnerUp.candidate_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 font-black text-2xl">{runnerUp.name.charAt(0)}</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter font-display">{runnerUp.name}</h3>
                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <div className="w-5 h-5 rounded bg-white/10 p-1">
                        {runnerUp.party_logo && <img src={runnerUp.party_logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{runnerUp.party}</span>
                    </div>
                  </div>
                  <div className="w-full pt-3 border-t border-white/10">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Total Votes</p>
                    <p className="text-3xl font-black text-white font-mono tracking-tighter">{runnerUp.total_votes.toLocaleString()}</p>
                    <p className="text-emerald-500 font-black text-[10px] mt-0.5">
                      {stats.totalVotes > 0 ? ((runnerUp.total_votes / stats.totalVotes) * 100).toFixed(1) : '0.0'}% Share
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Winner (1st Place) */}
            {winner && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 backdrop-blur-2xl p-6 rounded-[2.5rem] border-2 border-emerald-500/30 relative group shadow-[0_0_60px_rgba(16,185,129,0.05)]"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full font-black uppercase tracking-[0.2em] text-[9px] shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2">
                  <Trophy size={14} /> Leading
                </div>
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-28 h-28 rounded-[2rem] bg-emerald-900/20 border-4 border-emerald-500/50 overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)] group-hover:scale-105 transition-transform duration-700">
                    {winner.candidate_picture ? (
                      <img src={winner.candidate_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-emerald-500 font-black text-4xl">{winner.name.charAt(0)}</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter font-display text-emerald-400">{winner.name}</h3>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-lg bg-white/10 p-1 border border-white/10">
                        {winner.party_logo && <img src={winner.party_logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
                      </div>
                      <span className="text-sm font-black text-white uppercase tracking-[0.2em]">{winner.party}</span>
                    </div>
                  </div>
                  <div className="w-full pt-3 border-t border-emerald-500/20">
                    <p className="text-[7px] font-black text-emerald-500/60 uppercase tracking-widest mb-0.5">Total Votes Polled</p>
                    <p className="text-5xl font-black text-white font-mono tracking-tighter leading-none">{winner.total_votes.toLocaleString()}</p>
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <div className="px-2 py-0.5 bg-emerald-500 text-white rounded-lg font-black text-sm">
                        {stats.totalVotes > 0 ? ((winner.total_votes / stats.totalVotes) * 100).toFixed(1) : '0.0'}%
                      </div>
                      <div className="text-left">
                        <p className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Lead Margin</p>
                        <p className="text-sm font-black text-emerald-400 font-mono">
                          +{stats.candidateVotes.length > 1 ? (winner.total_votes - stats.candidateVotes[1].total_votes).toLocaleString() : '0'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3rd Place */}
            {stats.candidateVotes[2] && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/5 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 relative group hover:bg-white/10 transition-all duration-500"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-800 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest text-[8px] shadow-lg">
                  3rd Position
                </div>
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-amber-900/30 overflow-hidden shadow-xl group-hover:scale-105 transition-transform duration-500">
                    {stats.candidateVotes[2].candidate_picture ? (
                      <img src={stats.candidateVotes[2].candidate_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 font-black text-2xl">{stats.candidateVotes[2].name.charAt(0)}</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter font-display">{stats.candidateVotes[2].name}</h3>
                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <div className="w-5 h-5 rounded bg-white/10 p-1">
                        {stats.candidateVotes[2].party_logo && <img src={stats.candidateVotes[2].party_logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stats.candidateVotes[2].party}</span>
                    </div>
                  </div>
                  <div className="w-full pt-3 border-t border-white/10">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Total Votes</p>
                    <p className="text-3xl font-black text-white font-mono tracking-tighter">{stats.candidateVotes[2].total_votes.toLocaleString()}</p>
                    <p className="text-amber-600 font-black text-[10px] mt-0.5">
                      {stats.totalVotes > 0 ? ((stats.candidateVotes[2].total_votes / stats.totalVotes) * 100).toFixed(1) : '0.0'}% Share
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-4 pb-2 text-center">
          <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.5em]">
            Powered by AK-27 Campaign Organization
          </p>
        </footer>
      </div>
    </div>
  );
}
