import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Upload, CheckCircle, AlertCircle, ShieldCheck, Users, FileText, TrendingUp, AlertTriangle, Camera, Ban, Megaphone, Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';

export default function AgentPanel({ user, setUser }: { user: any, setUser: (u: any) => void }) {
  const navigate = useNavigate();
  const [contestants, setContestants] = useState<any[]>([]);
  const [accredited, setAccredited] = useState('');
  const [activeVoters, setActiveVoters] = useState('');
  const [totalVotesCast, setTotalVotesCast] = useState('');
  const [invalidVotes, setInvalidVotes] = useState('');
  const [votes, setVotes] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const uploading = uploadCount > 0;
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [submittingInvalid, setSubmittingInvalid] = useState(false);
  const [submittingTotalVotes, setSubmittingTotalVotes] = useState(false);
  const [submittingResultSheet, setSubmittingResultSheet] = useState(false);
  const [submittingAccreditation, setSubmittingAccreditation] = useState(false);
  const [accreditationEvidence, setAccreditationEvidence] = useState('');
  const [resultEvidence, setResultEvidence] = useState<Record<number, string>>({});
  const [invalidEvidence, setInvalidEvidence] = useState('');
  const [submissions, setSubmissions] = useState<{results: any[], accreditations: any[]}>({results: [], accreditations: []});
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [newBroadcastAlert, setNewBroadcastAlert] = useState<string | null>(null);
  const [hasIncident, setHasIncident] = useState<boolean | null>(null);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [quickAlertSent, setQuickAlertSent] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch('/api/agent/broadcasts', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setBroadcasts(data);
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('/api/agent/submissions', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setSubmissions(data);
      
      // Pre-fill accreditation and results
      data.accreditations.forEach((acc: any) => {
        if (acc.total_accredited > 0) {
          setAccredited(acc.total_accredited.toString());
          setActiveVoters(acc.total_active_voters.toString());
        }
        if (acc.total_votes_cast > 0) {
          setTotalVotesCast(acc.total_votes_cast.toString());
        }
        if (acc.invalid_votes > 0) {
          setInvalidVotes(acc.invalid_votes.toString());
          setInvalidEvidence(acc.evidence_url || '');
        }
        if (acc.evidence_url && !acc.total_accredited && !acc.invalid_votes) {
          setAccreditationEvidence(acc.evidence_url);
        } else if (acc.evidence_url && acc.total_accredited) {
          setAccreditationEvidence(acc.evidence_url);
        }
      });
      
      // Pre-fill results
      const resultVotes: Record<number, string> = {};
      const resultEv: Record<number, string> = {};
      data.results.forEach((r: any) => {
        resultVotes[r.contestant_id] = r.votes.toString();
        resultEv[r.contestant_id] = r.evidence_url || '';
      });
      setVotes(prev => ({ ...prev, ...resultVotes }));
      setResultEvidence(prev => ({ ...prev, ...resultEv }));
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    }
  };

  const handleFileUpload = async (file: File): Promise<string | null> => {
    setUploadCount(prev => prev + 1);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        body: formData
      });
      const data = await res.json();
      setUploadCount(prev => prev - 1);
      if (!res.ok) {
        alert(data.error || 'Upload failed');
        return null;
      }
      return data.url;
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadCount(prev => prev - 1);
      alert('Upload failed. Please check your connection.');
      return null;
    }
  };

  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Check if user is still active
    fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    .then(res => {
      if (res.status === 403) setIsBlocked(true);
      return res.json();
    })
    .catch(() => {});

    fetch('/api/contestants')
      .then(res => res.json())
      .then(data => setContestants(data));
    
    fetchSubmissions();
    fetchBroadcasts();

    // Socket.IO Setup
    socketRef.current = io();
    socketRef.current.on('connect', () => {
      console.log('Agent connected to socket, joining room:', user.id);
      socketRef.current?.emit('join_room', user.id);
    });
    
    socketRef.current.on('broadcast_alert', (data: { message: string }) => {
      setNewBroadcastAlert(data.message);
      fetchBroadcasts();
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const handleAccreditationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingAccreditation) return;
    setStatus(null);
    setSubmittingAccreditation(true);
    try {
      const res = await fetch('/api/accreditations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ 
          total_accredited: parseInt(accredited) || 0,
          total_active_voters: parseInt(activeVoters) || 0,
          total_votes_cast: 0,
          invalid_votes: 0,
          evidence_url: accreditationEvidence || null
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit accreditation');
      }
      setStatus({ type: 'success', msg: 'Accreditation data submitted successfully' });
      fetchSubmissions();
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSubmittingAccreditation(false);
    }
  };

  const handleTotalVotesCastSubmit = async () => {
    if (submittingTotalVotes) return;
    setStatus(null);
    if (!totalVotesCast) {
      setStatus({ type: 'error', msg: 'Please enter total votes cast' });
      return;
    }

    setSubmittingTotalVotes(true);
    try {
      const res = await fetch('/api/accreditations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ 
          total_accredited: 0,
          total_active_voters: 0,
          total_votes_cast: parseInt(totalVotesCast) || 0,
          invalid_votes: 0,
          evidence_url: accreditationEvidence || null
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit total votes cast');
      }
      setStatus({ type: 'success', msg: 'Total votes cast submitted successfully' });
      fetchSubmissions();
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSubmittingTotalVotes(false);
    }
  };

  const handleInvalidVotesSubmit = async () => {
    if (submittingInvalid) return;
    setStatus(null);
    if (!invalidVotes) {
      setStatus({ type: 'error', msg: 'Please enter invalid ballot count' });
      return;
    }

    setSubmittingInvalid(true);
    try {
      const res = await fetch('/api/accreditations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ 
          total_accredited: 0,
          total_active_voters: 0,
          total_votes_cast: 0,
          invalid_votes: parseInt(invalidVotes) || 0,
          evidence_url: invalidEvidence || null
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit invalid ballots');
      }
      setStatus({ type: 'success', msg: 'Invalid ballots submitted successfully' });
      fetchSubmissions();
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSubmittingInvalid(false);
    }
  };

  const handleResultSubmit = async (contestantId: number) => {
    if (submitting[contestantId]) return;
    setStatus(null);
    const voteCount = parseInt(votes[contestantId]);
    if (isNaN(voteCount)) {
      setStatus({ type: 'error', msg: 'Please enter a valid vote count' });
      return;
    }

    setSubmitting(prev => ({ ...prev, [contestantId]: true }));
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ 
          contestant_id: contestantId, 
          votes: voteCount,
          evidence_url: resultEvidence[contestantId] || null
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit result');
      }
      setStatus({ type: 'success', msg: `Result for ${contestants.find(c => c.id === contestantId)?.party} submitted successfully` });
      fetchSubmissions();
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSubmitting(prev => ({ ...prev, [contestantId]: false }));
    }
  };

  const handleResultSheetSubmit = async () => {
    if (submittingResultSheet) return;
    setStatus(null);
    if (!accreditationEvidence) {
      setStatus({ type: 'error', msg: 'Please upload result sheet photo' });
      return;
    }

    setSubmittingResultSheet(true);
    try {
      const res = await fetch('/api/accreditations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ 
          total_accredited: 0,
          total_active_voters: 0,
          total_votes_cast: 0,
          invalid_votes: 0,
          evidence_url: accreditationEvidence
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit result sheet');
      }
      setStatus({ type: 'success', msg: 'Official result sheet submitted successfully' });
      fetchSubmissions();
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSubmittingResultSheet(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingIncident || !incidentDescription) return;
    setStatus(null);
    setSubmittingIncident(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ description: incidentDescription })
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error?.includes('public.incidents')) {
          throw new Error('Database Error: The "incidents" table has not been created in Supabase yet. Please contact your administrator.');
        }
        throw new Error(data.error || 'Failed to submit incident report');
      }
      setStatus({ type: 'success', msg: 'Incident report submitted to situation room' });
      setIncidentDescription('');
      setHasIncident(false);
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSubmittingIncident(false);
    }
  };

  const handleQuickAlert = async () => {
    if (submittingIncident) return;
    setStatus(null);
    setSubmittingIncident(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ 
          description: 'EMERGENCY: Field agent has triggered a rapid incident alert. Immediate attention required.',
          is_quick_alert: true 
        })
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error?.includes('public.incidents')) {
          throw new Error('Database Error: The "incidents" table has not been created in Supabase yet. Please contact your administrator.');
        }
        throw new Error(data.error || 'Failed to send quick alert');
      }
      setStatus({ type: 'success', msg: 'Emergency alert broadcasted to Situation Room!' });
      setQuickAlertSent(true);
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSubmittingIncident(false);
    }
  };

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[3rem] shadow-2xl border-4 border-rose-600 max-w-lg w-full text-center"
        >
          <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-rose-100">
            <Ban className="text-rose-600" size={48} />
          </div>
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4 font-display">Access Revoked</h2>
          <p className="text-slate-600 font-bold mb-10 leading-relaxed font-display">
            Your field agent credentials have been suspended by the central administration. You no longer have authorization to submit or view election data.
          </p>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-rose-600 transition-all flex items-center justify-center gap-3"
          >
            <LogOut size={20} /> Exit Portal
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <header className="bg-slate-900 text-white p-8 shadow-2xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden">
              {user.photo_url ? (
                <img 
                  src={user.photo_url} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ShieldCheck className="text-white w-8 h-8" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase font-display">AK-27 <span className="text-emerald-400">Agent Portal</span></h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-black font-display">
                  {user.polling_unit} &bull; {user.ward} &bull; {user.lga}
                </p>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-800 px-6 py-3 rounded-xl hover:bg-red-950 hover:text-red-400 transition-all text-sm font-black uppercase tracking-widest border border-slate-700 hover:border-red-900 shadow-xl">
            <LogOut size={18} /> Secure Logout
          </button>
        </div>
      </header>

      <AnimatePresence>
        {newBroadcastAlert && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-8 right-8 md:left-auto md:right-8 md:w-96 bg-rose-600 text-white p-6 rounded-[2rem] shadow-2xl z-[100] border-4 border-rose-400"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Megaphone size={20} />
                </div>
                <h4 className="font-black uppercase tracking-widest text-xs">Priority Command</h4>
              </div>
              <button onClick={() => setNewBroadcastAlert(null)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="font-bold text-sm leading-relaxed mb-6">{newBroadcastAlert}</p>
            <button 
              onClick={() => {
                setShowInbox(true);
                setNewBroadcastAlert(null);
              }}
              className="w-full bg-white text-rose-600 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-50 transition-colors"
            >
              Open Command Center
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed top-32 right-8 z-40">
        <button 
          onClick={() => setShowInbox(true)}
          className="w-16 h-16 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-blue-600 transition-all relative group"
        >
          <Bell size={28} />
          {broadcasts.length > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
              {broadcasts.length}
            </span>
          )}
          <div className="absolute right-full mr-4 px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Command Center
          </div>
        </button>
      </div>

      <AnimatePresence>
        {showInbox && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                    <Megaphone size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight font-display">Command Center</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Official Directives & Broadcasts</p>
                  </div>
                </div>
                <button onClick={() => setShowInbox(false)} className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-colors shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {broadcasts.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Bell size={32} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active directives</p>
                  </div>
                ) : (
                  broadcasts.map((b) => (
                    <div key={b.id} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
                      <div className="flex justify-between items-start">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                        {b.target_user_id && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[7px] font-black uppercase tracking-widest">
                            Direct Message
                          </span>
                        )}
                      </div>
                      <p className="text-slate-900 font-bold leading-relaxed">{b.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50">
                <button 
                  onClick={() => setShowInbox(false)}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all"
                >
                  Acknowledge & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto p-4 md:p-12 space-y-12">
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={"p-6 rounded-2xl flex items-center gap-4 border-2 shadow-xl " + (status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800')}
          >
            {status.type === 'success' ? <CheckCircle size={28} className="text-emerald-600" /> : <AlertCircle size={28} className="text-red-600" />}
            <span className="font-black uppercase tracking-tight font-display">{status.msg}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Accreditation Section */}
          <section className="lg:col-span-5 h-fit bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-6">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Users size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase font-display">1. Accreditation</h2>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Voter Turnout Data</p>
              </div>
            </div>
            <form onSubmit={handleAccreditationSubmit} className="space-y-6">
              {submissions.accreditations.some(a => a.total_accredited > 0) && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">
                  <CheckCircle size={16} /> Data Locked & Verified
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Accredited Voters</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  disabled={submissions.accreditations.some(a => a.total_accredited > 0)}
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-mono text-2xl font-black disabled:opacity-70"
                  value={accredited}
                  onChange={(e) => setAccredited(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Active Voters</label>
                  <input 
                    type="number" 
                    min="0"
                    disabled={submissions.accreditations.some(a => a.total_accredited > 0)}
                    className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-mono text-2xl font-black disabled:opacity-70"
                    value={activeVoters}
                    onChange={(e) => setActiveVoters(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              {!submissions.accreditations.some(a => a.total_accredited > 0) && (
                <button 
                  type="submit" 
                  disabled={submittingAccreditation || uploading}
                  className="w-full bg-slate-900 text-white px-8 py-5 rounded-2xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
                >
                  {submittingAccreditation ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <TrendingUp size={24} />
                  )}
                  {submittingAccreditation ? 'Processing...' : 'Submit Collation Data'}
                </button>
              )}
            </form>
          </section>

          {/* Results Section */}
          <section className="lg:col-span-7 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-6">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <FileText size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase font-display">2. Candidate Results</h2>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Official Vote Count</p>
              </div>
            </div>
            <div className="space-y-6">
              {/* Total Votes Cast Section */}
              {(() => {
                const isSubmitted = submissions.accreditations.some(a => a.total_votes_cast > 0);
                return (
                  <div className={"flex flex-col sm:flex-row sm:items-center gap-6 p-6 border-2 rounded-3xl transition-all group " + (isSubmitted ? 'bg-blue-50/30 border-blue-100' : 'bg-blue-50/30 border-blue-100 hover:border-blue-500/30 hover:bg-white')}>
                    <div className="flex items-center gap-6 flex-1">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center font-black text-blue-600 border-2 border-blue-100 shadow-lg text-xl font-display group-hover:scale-110 transition-transform">
                        TVC
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight font-display">Total Votes Cast</h3>
                        <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Overall Ballots in Box</p>
                        {isSubmitted && (
                          <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[8px] font-black uppercase tracking-widest">
                            <CheckCircle size={10} /> Submitted
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 w-full sm:w-auto">
                      <div className="flex items-center gap-4">
                        <input 
                          type="number" 
                          placeholder="Count"
                          min="0"
                          disabled={isSubmitted}
                          className="w-full sm:w-36 p-5 border-2 border-slate-100 rounded-2xl text-center outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-mono text-2xl font-black shadow-inner text-blue-600 disabled:opacity-70"
                          value={totalVotesCast}
                          onChange={(e) => setTotalVotesCast(e.target.value)}
                        />
                      </div>
                      {!isSubmitted && (
                        <button 
                          onClick={handleTotalVotesCastSubmit}
                          disabled={!totalVotesCast || submittingTotalVotes || uploading}
                          className="bg-slate-900 text-white px-8 py-5 rounded-2xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 whitespace-nowrap"
                        >
                          {submittingTotalVotes ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <Upload size={20} />
                          )}
                          {submittingTotalVotes ? 'Sending...' : 'Send'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {contestants.map(c => {
                const isSubmitted = submissions.results.some(r => r.contestant_id === c.id);
                return (
                  <div key={c.id} className={"flex flex-col sm:flex-row sm:items-center gap-6 p-6 border-2 rounded-3xl transition-all group " + (isSubmitted ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50/50 border-slate-50 hover:border-emerald-500/30 hover:bg-white')}>
                    <div className="flex items-center gap-6 flex-1">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center font-black text-slate-900 border-2 border-slate-100 shadow-lg text-xl font-display group-hover:scale-110 transition-transform">
                        {c.party}
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight font-display">{c.name}</h3>
                        <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">{c.party}</p>
                        {isSubmitted && (
                          <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase tracking-widest">
                            <CheckCircle size={10} /> Submitted
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 w-full sm:w-auto">
                      <div className="flex items-center gap-4">
                        <input 
                          type="number" 
                          placeholder="Votes"
                          min="0"
                          disabled={isSubmitted}
                          className="w-full sm:w-36 p-5 border-2 border-slate-100 rounded-2xl text-center outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-mono text-2xl font-black shadow-inner disabled:opacity-70"
                          value={votes[c.id] || ''}
                          onChange={(e) => setVotes({...votes, [c.id]: e.target.value})}
                        />
                        <div className="flex flex-col gap-2">
                          <input 
                            type="file" 
                            accept="image/*"
                            disabled={isSubmitted}
                            className="hidden" 
                            id={`result-evidence-${c.id}`}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleFileUpload(file);
                                if (url) setResultEvidence(prev => ({...prev, [c.id]: url}));
                              }
                            }}
                          />
                          {!isSubmitted ? (
                            <label htmlFor={`result-evidence-${c.id}`} className={`p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center justify-center ${resultEvidence[c.id] ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900'}`}>
                              <Camera size={20} />
                            </label>
                          ) : (
                            <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-100 text-emerald-600">
                              <ShieldCheck size={20} />
                            </div>
                          )}
                        </div>
                      </div>
                      {!isSubmitted && (
                        <button 
                          onClick={() => handleResultSubmit(c.id)}
                          disabled={!votes[c.id] || submitting[c.id] || uploading}
                          className="bg-slate-900 text-white px-8 py-5 rounded-2xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 whitespace-nowrap"
                        >
                          {submitting[c.id] ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <Upload size={20} />
                          )}
                          {submitting[c.id] ? 'Sending...' : 'Send'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Invalid Ballots Row */}
              {(() => {
                const isSubmitted = submissions.accreditations.some(a => a.invalid_votes > 0);
                return (
                  <div className={"flex flex-col sm:flex-row sm:items-center gap-6 p-6 border-2 rounded-3xl transition-all group " + (isSubmitted ? 'bg-rose-50/30 border-rose-100' : 'bg-rose-50/30 border-rose-100 hover:border-rose-500/30 hover:bg-white')}>
                    <div className="flex items-center gap-6 flex-1">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center font-black text-rose-600 border-2 border-rose-100 shadow-lg text-xl font-display group-hover:scale-110 transition-transform">
                        INV
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight font-display">Invalid Ballots</h3>
                        <p className="text-xs font-black text-rose-600 uppercase tracking-widest">Spoilt / Rejected</p>
                        {isSubmitted && (
                          <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-[8px] font-black uppercase tracking-widest">
                            <CheckCircle size={10} /> Submitted
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 w-full sm:w-auto">
                      <div className="flex items-center gap-4">
                        <input 
                          type="number" 
                          placeholder="Count"
                          min="0"
                          disabled={isSubmitted}
                          className="w-full sm:w-36 p-5 border-2 border-slate-100 rounded-2xl text-center outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 font-mono text-2xl font-black shadow-inner text-rose-600 disabled:opacity-70"
                          value={invalidVotes}
                          onChange={(e) => setInvalidVotes(e.target.value)}
                        />
                        <div className="flex flex-col gap-2">
                          <input 
                            type="file" 
                            accept="image/*"
                            disabled={isSubmitted}
                            className="hidden" 
                            id="invalid-evidence-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleFileUpload(file);
                                if (url) setInvalidEvidence(url);
                              }
                            }}
                          />
                          {!isSubmitted ? (
                            <label htmlFor="invalid-evidence-upload" className={`p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center justify-center ${invalidEvidence ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900'}`}>
                              <Camera size={20} />
                            </label>
                          ) : (
                            <div className="p-3 rounded-xl bg-rose-50 border-2 border-rose-100 text-rose-600">
                              <ShieldCheck size={20} />
                            </div>
                          )}
                        </div>
                      </div>
                      {!isSubmitted && (
                        <button 
                          onClick={handleInvalidVotesSubmit}
                          disabled={!invalidVotes || submittingInvalid || uploading}
                          className="bg-slate-900 text-white px-8 py-5 rounded-2xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 whitespace-nowrap"
                        >
                          {submittingInvalid ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <Upload size={20} />
                          )}
                          {submittingInvalid ? 'Sending...' : 'Send'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Official Result Sheet Evidence Row */}
              {(() => {
                const isSubmitted = submissions.accreditations.some(a => a.evidence_url && !a.total_accredited && !a.invalid_votes) || 
                                   submissions.accreditations.some(a => a.evidence_url && a.total_accredited);
                return (
                  <div className={"flex flex-col sm:flex-row sm:items-center gap-6 p-6 border-2 rounded-3xl transition-all group " + (isSubmitted ? 'bg-amber-50/30 border-amber-100' : 'bg-amber-50/30 border-amber-100 hover:border-amber-500/30 hover:bg-white')}>
                    <div className="flex items-center gap-6 flex-1">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center font-black text-amber-600 border-2 border-amber-100 shadow-lg text-xl font-display group-hover:scale-110 transition-transform">
                        <Camera size={32} />
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight font-display">Result Sheet</h3>
                        <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Official Scanned Document</p>
                        {isSubmitted && (
                          <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase tracking-widest">
                            <CheckCircle size={10} /> Verified & Uploaded
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 w-full sm:w-auto">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center gap-4">
                          <input 
                            type="file" 
                            accept="image/*"
                            disabled={isSubmitted}
                            className="hidden" 
                            id="final-result-sheet-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleFileUpload(file);
                                if (url) setAccreditationEvidence(url);
                              }
                            }}
                          />
                          {!isSubmitted ? (
                            <label htmlFor="final-result-sheet-upload" className={`flex-1 flex items-center justify-center gap-2 p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all font-bold ${accreditationEvidence ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900'}`}>
                              <Upload size={20} /> {uploading ? 'Uploading...' : accreditationEvidence ? 'Change Sheet' : 'Upload Sheet'}
                            </label>
                          ) : (
                            <div className="flex-1 p-5 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-emerald-600 font-bold text-center flex items-center justify-center gap-2">
                              <ShieldCheck size={20} /> Document Secured
                            </div>
                          )}
                          {accreditationEvidence && (
                            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm">
                              <img src={accreditationEvidence} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                        </div>
                      </div>
                      {!isSubmitted && (
                        <button 
                          onClick={handleResultSheetSubmit}
                          disabled={!accreditationEvidence || submittingResultSheet || uploading}
                          className="bg-slate-900 text-white px-8 py-5 rounded-2xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 whitespace-nowrap"
                        >
                          {submittingResultSheet ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <ShieldCheck size={20} />
                          )}
                          {submittingResultSheet ? 'Securing...' : 'Submit Final Sheet'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="mt-10 bg-amber-50 border-2 border-amber-100 p-6 rounded-2xl flex gap-4 text-amber-900 text-xs font-black uppercase tracking-widest leading-relaxed">
              <AlertTriangle size={24} className="shrink-0 text-amber-500" />
              <p>Warning: All submitted results are final and subject to verification by the central situation room.</p>
            </div>
          </section>

          {/* Incident Reportage Section */}
          <section className="lg:col-span-12 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 mt-12">
            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-6">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase font-display">3. Incident Reportage</h2>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Field Security Updates</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-50 p-8 rounded-3xl border-2 border-slate-100">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Was there an incident at the polling unit?</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setHasIncident(true)}
                    className={`flex items-center justify-center gap-3 p-6 rounded-2xl font-black uppercase tracking-[0.2em] border-2 transition-all ${hasIncident === true ? 'bg-rose-600 text-white border-rose-600 shadow-xl' : 'bg-white text-slate-600 border-slate-100 hover:border-rose-600'}`}
                  >
                    Yes
                  </button>
                  <button 
                    onClick={() => {
                      setHasIncident(false);
                      setIncidentDescription('');
                    }}
                    className={`flex items-center justify-center gap-3 p-6 rounded-2xl font-black uppercase tracking-[0.2em] border-2 transition-all ${hasIncident === false ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl' : 'bg-white text-slate-600 border-slate-100 hover:border-emerald-600'}`}
                  >
                    No
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {hasIncident === true && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-6 overflow-hidden"
                  >
                    {!quickAlertSent ? (
                      <button 
                        type="button" 
                        onClick={handleQuickAlert}
                        disabled={submittingIncident}
                        className="w-full bg-rose-50 border-4 border-rose-600 text-rose-600 px-8 py-6 rounded-3xl hover:bg-rose-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-4 animate-pulse group"
                      >
                        <AlertTriangle size={32} className="group-hover:scale-125 transition-transform" />
                        <div className="text-left">
                          <p className="text-sm">Trigger Emergency Alert</p>
                          <p className="text-[10px] font-bold opacity-70">Immediate Situation Room Notification</p>
                        </div>
                      </button>
                    ) : (
                      <div className="bg-rose-600 text-white p-6 rounded-3xl flex items-center gap-4 shadow-xl border-4 border-rose-400">
                        <CheckCircle size={24} />
                        <p className="font-black uppercase tracking-widest text-xs">Emergency Alert Broadcasted!</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="h-[2px] bg-slate-100 flex-1"></div>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">or provide details</span>
                      <div className="h-[2px] bg-slate-100 flex-1"></div>
                    </div>

                    <form onSubmit={handleIncidentSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">Detailed Incident Description</label>
                        <textarea 
                          required
                          rows={4}
                          className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300"
                          placeholder="Provide details about the incident (e.g., violence, ballotbox snatching, late arrival of materials)..."
                          value={incidentDescription}
                          onChange={(e) => setIncidentDescription(e.target.value)}
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={submittingIncident || !incidentDescription}
                        className="w-full bg-slate-900 text-white px-8 py-5 rounded-2xl hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3"
                      >
                        {submittingIncident ? (
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <Megaphone size={24} />
                        )}
                        {submittingIncident ? 'Reporting...' : 'Transmit Detailed Report'}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {hasIncident === false && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-emerald-50 border-2 border-emerald-100 p-6 rounded-3xl flex items-center gap-4 text-emerald-700"
                >
                  <CheckCircle size={24} />
                  <p className="font-black uppercase tracking-widest text-[10px]">No security issues reported. Continue with regular collation.</p>
                </motion.div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
