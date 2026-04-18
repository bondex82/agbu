import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CheckCircle, MapPin, BarChart3, Clock, TrendingUp, ShieldCheck, Bell, X, AlertTriangle, Search, User, Phone, FileText, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

export default function Dashboard({ socket }: { socket: any }) {
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
    totalLgas: 0,
    reportedLgas: 0,
    candidateVotes: [] as any[]
  });
  const [unitStats, setUnitStats] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unitFilter, setUnitFilter] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  const [apcCandidate, setApcCandidate] = useState<any>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      
      // Also update APC candidate from stats if found
      const apc = (data.candidateVotes || []).find((c: any) => 
        c.party?.trim().toUpperCase() === 'APC' || 
        c.party?.toLowerCase().includes('progressives')
      );
      if (apc) setApcCandidate(apc);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchUnitStats = async () => {
    try {
      const res = await fetch('/api/units/stats');
      if (!res.ok) throw new Error('Failed to fetch unit stats');
      const data = await res.json();
      setUnitStats(data);
    } catch (err) {
      console.error('Failed to fetch unit stats', err);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (err) {
      console.error('Failed to fetch incidents', err);
    }
  };

  useEffect(() => {
    // Fetch APC candidate specifically for the loading screen
    fetch('/api/contestants')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const apc = data.find((c: any) => 
            c.party?.trim().toUpperCase() === 'APC' || 
            c.party?.toLowerCase().includes('progressives')
          );
          if (apc) setApcCandidate(apc);
        }
      })
      .catch(() => {});

    const init = async () => {
      // Safety timeout to prevent endless loading
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 8000);

      try {
        await Promise.all([fetchStats(), fetchUnitStats(), fetchIncidents()]);
      } catch (err) {
        console.error('Init failed', err);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };
    init();

    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => {});

    socket.on('new_result_pending', () => {
      fetchStats();
      fetchUnitStats();
      const newNotif = { id: Date.now(), message: 'New result entry received from an agent!' };
      setNotifications(prev => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 5000);
    });

    socket.on('stats_updated', () => {
      fetchStats();
      fetchUnitStats();
    });

    socket.on('broadcast_alert', (data: any) => {
      const newNotif = { id: Date.now(), message: `BROADCAST: ${data.message}` };
      setNotifications(prev => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 8000);
    });

    socket.on('incident_alert', (data: any) => {
      fetchIncidents();
      const newNotif = { 
        id: Date.now(), 
        type: 'incident',
        message: `CRITICAL INCIDENT at ${data.polling_unit}: ${data.description}`,
        agent_name: data.agent_name,
        is_quick_alert: data.is_quick_alert
      };
      setNotifications(prev => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 12000);
    });

    return () => {
      socket.off('new_result_pending');
      socket.off('stats_updated');
    };
  }, [socket]);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-pulse flex items-center justify-center bg-slate-800">
          {apcCandidate?.candidate_picture ? (
            <img 
              src={apcCandidate.candidate_picture} 
              alt="APC Candidate" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        {apcCandidate?.party_logo && (
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-white rounded-xl shadow-xl p-1.5 animate-bounce">
            <img 
              src={apcCandidate.party_logo} 
              alt="Party Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-emerald-500 font-black uppercase tracking-[0.3em] animate-pulse font-display text-sm">Synchronizing Live Data</p>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );

  const sortedCandidates = [...(stats.candidateVotes || [])].sort((a, b) => b.total_votes - a.total_votes);
  const leader = sortedCandidates[0];
  const others = sortedCandidates.slice(1);

  const filteredUnits = (unitStats || []).filter(u => 
    (u.name || '').toLowerCase().includes(unitFilter.toLowerCase()) || 
    (u.lga || '').toLowerCase().includes(unitFilter.toLowerCase()) ||
    (u.agent_name && u.agent_name.toLowerCase().includes(unitFilter.toLowerCase()))
  );

  const registrationData = [
    { name: 'Reported', value: stats.reportedPu },
    { name: 'Pending', value: Math.max(0, stats.totalPu - stats.reportedPu) }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-slate-900 -skew-y-2 origin-top-left -z-10"></div>
      
      {/* Real-time Notifications */}
      <div className="fixed top-24 right-6 z-50 space-y-3 w-80">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="bg-white border-l-4 border-emerald-500 shadow-2xl p-4 rounded-r-xl flex items-start gap-3"
            >
              <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                <Bell size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 font-display">Live Update</p>
                <p className="text-xs text-slate-500">{n.message}</p>
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

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-6 pb-8 relative">
          <div className="flex flex-col md:flex-row items-center justify-center gap-10">
            {/* Candidate Image */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative"
            >
              <div className="w-36 h-36 md:w-48 md:h-48 rounded-full border-8 border-white overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.2)] bg-slate-100">
                <img 
                  src={apcCandidate?.candidate_picture || "https://picsum.photos/seed/apc/300/300"} 
                  alt="APC Candidate" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Animated Party Logo */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-2 -right-2 w-16 h-16 md:w-20 md:h-20 bg-white rounded-full p-1.5 shadow-2xl border-4 border-white flex items-center justify-center overflow-hidden"
              >
                <img 
                  src={apcCandidate?.party_logo || "https://picsum.photos/seed/apc-logo/100/100"} 
                  alt="APC Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </motion.div>

            <div className="text-center md:text-left space-y-2">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase border border-emerald-500/20 mb-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                AK-27 Live Collation Active
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white font-display leading-[0.9]">
                <span className="text-brand-green">AK-27</span> <span className="text-brand-red">SITUATION ROOM</span>
              </h1>
              <p className="text-xl md:text-2xl font-bold text-slate-300 uppercase tracking-[0.2em] font-display">2027 General Election Stats</p>
            </div>

            <button 
              onClick={() => {
                setLoading(true);
                Promise.all([fetchStats(), fetchUnitStats()]).finally(() => setLoading(false));
              }}
              className="md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl border border-white/10 transition-all group"
              title="Refresh Data"
            >
              <motion.div
                whileTap={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <Clock size={24} className="group-hover:text-emerald-400 transition-colors" />
              </motion.div>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            {/* Top Section: Registered & Ballots Cast with Vibrant Colors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Active Registered Voters */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 group">
            <div className="bg-white/5 py-4 px-8 border-b border-white/10 flex justify-between items-center">
              <span className="text-slate-400 font-black uppercase tracking-widest text-xs">Registration Data</span>
              <Users className="text-slate-500" size={18} />
            </div>
            <div className="p-10 flex items-center justify-between gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Registered Voters</p>
                  <p className="text-5xl font-black text-white font-mono tracking-tighter">{stats.totalRegistered.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Polling Units</p>
                    <p className="text-xl font-black text-white font-mono">{stats.totalPu.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Accredited</p>
                    <p className="text-xl font-black text-emerald-400 font-mono">{stats.totalAccredited.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LGAs Covered</p>
                    <p className="text-xl font-black text-white font-mono">{stats.reportedLgas} / {stats.totalLgas}</p>
                  </div>
                </div>
              </div>
              <div className="relative w-44 h-44 hidden sm:block">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={registrationData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#d91b5c" />
                      <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-black text-white font-mono tracking-tighter">{((stats.reportedPu / (stats.totalPu || 1)) * 100).toFixed(0)}%</p>
                  <p className="text-[8px] font-bold text-slate-500 uppercase">Reported</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ballots Cast */}
          <div className="bg-gradient-to-br from-brand-red to-[#b0164a] rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
            <div className="bg-black/10 py-4 px-8 border-b border-white/10 flex justify-between items-center">
              <span className="text-white/70 font-black uppercase tracking-widest text-xs">Live Collation</span>
              <TrendingUp className="text-white/50" size={18} />
            </div>
            <div className="p-10 flex items-center justify-between gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Total Votes Cast (Live)</p>
                  <p className="text-5xl font-black text-white font-mono tracking-tighter">{stats.totalVotesCast.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3 bg-white/10 w-fit px-4 py-2 rounded-full border border-white/10">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Synchronizing with Field Agents</span>
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-center gap-2">
                <div className="w-28 h-28 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner backdrop-blur-sm">
                  <ShieldCheck size={56} className="text-white/80" />
                </div>
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Verified Stream</p>
              </div>
            </div>
          </div>
        </div>

        {/* Voter Engagement Section with Colored Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-between group hover:shadow-2xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reported PUs</p>
                <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{stats.reportedPu}</p>
              </div>
            </div>
            <div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                <div 
                  className="bg-blue-600 h-full transition-all duration-1000" 
                  style={{ width: `${(stats.reportedPu / (stats.totalPu || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{((stats.reportedPu / (stats.totalPu || 1)) * 100).toFixed(1)}% Completion</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-between group hover:shadow-2xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                <CheckCircle size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Voters</p>
                <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{stats.totalActiveVoters.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-500 leading-tight">Total verified active voters across all reported units.</p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-between group hover:shadow-2xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                <Clock size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accredited</p>
                <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{stats.totalAccredited.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-500 leading-tight">Total accredited voters confirmed by field agents.</p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-between group hover:shadow-2xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                <AlertTriangle size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invalid Ballots</p>
                <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{stats.totalInvalid.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Action Required in {Math.ceil(stats.totalInvalid / 100)} Units</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Leading Contestant Card */}
          <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col group">
            <div className="bg-slate-900 text-white py-6 px-8 text-center font-black text-xl uppercase tracking-[0.2em] font-display">
              Leading Candidate
            </div>
            <div className="p-10 flex-1 flex flex-col items-center justify-center space-y-8">
              {leader ? (
                <>
                  <div className="relative">
                    <div className="w-48 h-48 rounded-full overflow-hidden border-8 border-slate-50 shadow-2xl">
                      <img 
                        src={leader.candidate_picture || `https://picsum.photos/seed/${leader.name}/300/300`} 
                        alt={leader.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute -bottom-2 -right-2 w-20 h-20 bg-white rounded-full p-1.5 shadow-2xl border-4 border-slate-50 flex items-center justify-center overflow-hidden"
                    >
                      <img 
                        src={leader.party_logo || `https://picsum.photos/seed/${leader.party}/100/100`} 
                        alt={leader.party} 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter font-display">{leader.name}</h3>
                    <p className="text-lg font-black text-emerald-600 uppercase tracking-[0.3em] font-display">{leader.party}</p>
                  </div>
                  <div className="w-full bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Votes Pooled</p>
                    <p className="text-6xl font-black text-slate-900 font-mono tracking-tighter">{leader.total_votes.toLocaleString()}</p>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
                    <Activity size={40} />
                  </div>
                  <div className="text-slate-300 font-black uppercase tracking-widest animate-pulse">Waiting for Collation...</div>
                </div>
              )}
            </div>
          </div>

          {/* Trailing Contestants Section */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="bg-slate-900 text-white py-6 px-8 text-center font-black text-xl uppercase tracking-[0.2em] font-display">
              Trailing Contestants
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto custom-scrollbar">
              {others.length > 0 ? (
                others.map((candidate, index) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={candidate.id}
                    className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex items-center gap-6 hover:border-brand-red/30 hover:bg-white transition-all group"
                  >
                    <div className="relative">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                        <img 
                          src={candidate.candidate_picture || `https://picsum.photos/seed/${candidate.name}/200/200`} 
                          alt={candidate.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="absolute -top-2 -right-2 w-10 h-10 bg-white rounded-xl p-1 shadow-lg border border-slate-100 flex items-center justify-center overflow-hidden">
                        <img 
                          src={candidate.party_logo || `https://picsum.photos/seed/${candidate.party}/50/50`} 
                          alt={candidate.party} 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="font-black text-slate-900 uppercase text-sm leading-tight font-display">{candidate.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{candidate.party}</p>
                      <div className="flex items-end justify-between">
                        <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{candidate.total_votes.toLocaleString()}</p>
                        <div className="text-[10px] font-black text-brand-red bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                          -{ leader ? (leader.total_votes - candidate.total_votes).toLocaleString() : '0' }
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-2 flex items-center justify-center h-64 text-slate-300 font-black uppercase tracking-widest italic">
                  Awaiting Field Reports...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Ranking Bar */}
        <aside className="lg:col-span-1 space-y-8">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden sticky top-8">
              <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm font-display">Live Ranking</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Real-time Collation</p>
                </div>
                <TrendingUp className="text-emerald-500" size={20} />
              </div>
              <div className="p-8 space-y-8">
                {sortedCandidates.map((c, i) => (
                  <div key={c.id} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          i === 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 
                          i === 1 ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{c.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{c.party}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 font-mono tracking-tighter">{c.total_votes.toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-emerald-600 uppercase">{((c.total_votes / (stats.totalVotes || 1)) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden border border-slate-100">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(c.total_votes / (stats.totalVotes || 1)) * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          i === 0 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 
                          i === 1 ? 'bg-blue-500' :
                          'bg-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                ))}
                
                {sortedCandidates.length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                      <Clock size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Awaiting Field Data...</p>
                  </div>
                )}

                <div className="pt-6 border-t border-slate-50">
                  <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <ShieldCheck className="text-emerald-500" size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 uppercase">Verified Stream</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">End-to-end Encrypted</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Unit Breakdown Table */}
        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100">
          <div className="bg-slate-900 text-white py-6 px-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <BarChart3 size={20} className="text-emerald-400" />
              </div>
              <h2 className="font-black text-xl uppercase tracking-widest font-display">Polling Unit Breakdown</h2>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Search by PU, LGA or Agent..." 
                className="w-full pl-12 pr-6 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium transition-all"
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Polling Unit</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">LGA / Ward</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Agent</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Reg.</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Active</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Accred.</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Cast</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Valid</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Invalid</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Turnout</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Evidence</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUnits.map((unit, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 font-black text-slate-900 font-display whitespace-nowrap">{unit.name}</td>
                    <td className="px-4 py-5">
                      <p className="font-bold text-slate-700 text-xs whitespace-nowrap">{unit.lga}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">{unit.ward}</p>
                    </td>
                    <td className="px-4 py-5">
                      <button 
                        onClick={() => {
                          const agent = users.find(u => u.name === unit.agent_name);
                          if (agent) setSelectedAgent(agent);
                        }}
                        className="flex items-center gap-2 hover:bg-slate-100 p-1 pr-3 rounded-full transition-all text-left"
                      >
                        <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                          {users.find(u => u.name === unit.agent_name)?.photo_url ? (
                            <img src={users.find(u => u.name === unit.agent_name).photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-[9px] font-black text-slate-500">
                              {unit.agent_name ? unit.agent_name.charAt(0) : '?'}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-xs whitespace-nowrap">{unit.agent_name || 'Unassigned'}</p>
                      </button>
                    </td>
                    <td className="px-4 py-5 font-mono font-bold text-slate-600 text-xs">{(unit.total_registered || 0).toLocaleString()}</td>
                    <td className="px-4 py-5 font-mono font-bold text-blue-600 text-xs">{unit.active_voters.toLocaleString()}</td>
                    <td className="px-4 py-5 font-mono font-bold text-slate-900 text-xs">{unit.accredited.toLocaleString()}</td>
                    <td className="px-4 py-5 font-mono font-bold text-slate-500 text-xs">{unit.votes_cast.toLocaleString()}</td>
                    <td className="px-4 py-5 font-mono font-bold text-emerald-600 text-xs">{unit.valid.toLocaleString()}</td>
                    <td className="px-4 py-5 font-mono font-bold text-rose-600 text-xs">{unit.invalid.toLocaleString()}</td>
                    <td className="px-4 py-5">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {unit.total_registered > 0 ? ((unit.accredited / unit.total_registered) * 100).toFixed(1) : '0.0'}%
                        </span>
                        <div className="w-10 bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full" 
                            style={{ width: `${unit.total_registered > 0 ? (unit.accredited / unit.total_registered) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      {unit.reported && unit.evidence_url ? (
                        <a 
                          href={unit.evidence_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 font-bold text-[10px] flex items-center gap-1"
                        >
                          <FileText size={12} /> View
                        </a>
                      ) : (
                        <span className="text-slate-300 text-[10px] font-bold">None</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border whitespace-nowrap ${
                        unit.reported 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                      }`}>
                        {unit.reported ? 'Reported' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Incident Recordage History */}
        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-rose-100 mb-12">
          <div className="bg-rose-600 text-white py-6 px-10 flex justify-between items-center bg-gradient-to-r from-rose-600 to-rose-700">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <h2 className="font-black text-xl uppercase tracking-widest font-display">Incident Recordage Log</h2>
            </div>
            <div className="bg-white/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
              {incidents.length} Reported Incidents
            </div>
          </div>
          <div className="p-8">
            {incidents.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                  <ShieldCheck size={32} />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">All Clear: No incidents reported via field agents</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {incidents.map((incident) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={incident.id} 
                    className={`bg-slate-50 border-2 rounded-3xl p-6 relative overflow-hidden group hover:border-rose-300 transition-all ${incident.is_quick_alert ? 'border-rose-500 bg-rose-50/20' : 'border-rose-100'}`}
                  >
                    <div className="absolute top-0 right-0 p-4">
                       <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${incident.is_quick_alert ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-600'}`}>
                         {new Date(incident.created_at).toLocaleTimeString()}
                         {incident.is_quick_alert && ' - EMERGENCY'}
                       </span>
                    </div>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-rose-100 flex-shrink-0 overflow-hidden shadow-sm">
                        {incident.agent_photo ? (
                          <img src={incident.agent_photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-rose-300">
                            <User size={24} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-sm uppercase truncate">{incident.agent_name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{incident.polling_unit}</p>
                      </div>
                    </div>
                    <div className={`p-4 rounded-2xl border shadow-inner ${incident.is_quick_alert ? 'bg-rose-600 text-white border-rose-700' : 'bg-white border-rose-50'}`}>
                      <p className={`text-xs font-bold leading-relaxed italic ${incident.is_quick_alert ? 'text-white' : 'text-slate-700'}`}>"{incident.description}"</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                       <MapPin size={12} className={incident.is_quick_alert ? 'text-rose-600' : 'text-rose-400'} />
                       <span className={`text-[9px] font-black uppercase tracking-widest ${incident.is_quick_alert ? 'text-rose-600' : 'text-rose-400'}`}>
                         {incident.ward} &bull; {incident.lga}
                       </span>
                    </div>
                    {incident.is_quick_alert && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-rose-600 animate-pulse"></div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Profile Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] overflow-y-auto p-4 md:p-8">
            <div className="min-h-full flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[3rem] w-full max-w-2xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-100 my-auto"
              >
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter font-display">Personnel Profile</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Field Agent Verification</p>
                  </div>
                  <button onClick={() => setSelectedAgent(null)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-all"><X size={24} /></button>
                </div>
                <div className="p-12 flex flex-col items-center text-center space-y-8">
                  <div className="relative">
                    <div className="w-48 h-48 rounded-[3rem] bg-slate-100 flex items-center justify-center overflow-hidden border-8 border-white shadow-2xl">
                      {selectedAgent.photo_url ? <img src={selectedAgent.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={80} className="text-slate-300" />}
                    </div>
                    <div className={`absolute -bottom-4 -right-4 w-12 h-12 rounded-full border-8 border-white shadow-xl ${selectedAgent.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter font-display">{selectedAgent.name}</h3>
                    <p className="text-lg font-black text-emerald-600 uppercase tracking-widest font-display">Field Agent</p>
                  </div>
                  <div className="grid grid-cols-2 gap-8 w-full pt-8 border-t border-slate-100">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assignment</p>
                      <p className="font-bold text-slate-900 uppercase">{selectedAgent.polling_unit || 'N/A'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">LGA</p>
                      <p className="font-bold text-slate-900 uppercase">{selectedAgent.lga || 'N/A'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Status</p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <p className="font-bold text-slate-900">Active Connection</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verified ID</p>
                      <p className="font-bold text-slate-900">#{selectedAgent.id.toString().padStart(4, '0')}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
