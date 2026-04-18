import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function Login({ setUser }: { setUser: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preloading, setPreloading] = useState(true);
  const [apcCandidate, setApcCandidate] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch APC candidate for preloader
    fetch('/api/contestants')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const apc = data.find((c: any) => 
            c.party?.trim().toUpperCase() === 'APC' || 
            c.party?.toLowerCase().includes('progressives') ||
            c.party?.toLowerCase().includes('congress')
          );
          if (apc) setApcCandidate(apc);
        }
      })
      .catch(err => console.error('Preloader fetch error:', err));

    const timer = setTimeout(() => {
      setPreloading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);

      if (data.user.role === 'agent') {
        navigate('/agent');
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (preloading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="relative">
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-brand-green shadow-2xl animate-pulse bg-slate-50 flex items-center justify-center">
            {apcCandidate?.candidate_picture ? (
              <img 
                src={apcCandidate.candidate_picture} 
                alt="APC Candidate" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : apcCandidate ? (
              <div className="text-center p-4">
                <p className="text-brand-green font-black text-xl uppercase leading-none">{apcCandidate.name}</p>
                <p className="text-slate-400 font-bold text-[10px] mt-1 uppercase tracking-widest">{apcCandidate.party}</p>
              </div>
            ) : (
              <img 
                src="https://picsum.photos/seed/election/400/400" 
                alt="Election System" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          {apcCandidate?.party_logo && (
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white rounded-2xl shadow-xl border-2 border-brand-green p-2 animate-bounce">
              <img 
                src={apcCandidate.party_logo} 
                alt="Party Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-brand-green text-white px-6 py-2 rounded-full font-bold text-sm whitespace-nowrap shadow-lg flex items-center gap-2">
            <Loader2 className="animate-spin" size={16} />
            Initializing System...
          </div>
        </div>
        <h2 className="mt-12 text-2xl font-bold text-brand-green tracking-tight">Election 2027</h2>
        <p className="text-gray-500 font-medium mt-2">AK-27 Situation Room</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white relative overflow-hidden">
      {/* Left Pane - Branding */}
      <div className="md:w-1/2 bg-brand-green text-white relative overflow-hidden flex flex-col">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://picsum.photos/seed/election-bg/1200/1800" 
            alt="Election Monitoring" 
            className="w-full h-full object-cover opacity-40 mix-blend-overlay"
            referrerPolicy="no-referrer"
          />
          {apcCandidate?.candidate_picture && (
            <div className="absolute -right-20 -bottom-20 w-full h-full flex items-end justify-end overflow-hidden opacity-30 mix-blend-soft-light">
              <img 
                src={apcCandidate.candidate_picture} 
                alt="Candidate Watermark" 
                className="w-full h-full object-contain grayscale filter contrast-125 brightness-110"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-green via-brand-green/60 to-transparent"></div>
        </div>

        <div className="relative z-10 p-8 md:p-16 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-white" />
                <span className="font-mono text-xs tracking-widest uppercase text-white/80 font-bold">Secure Access</span>
              </div>
              {/* Party Logo Provision */}
              <div className="w-12 h-12 bg-white rounded-lg p-1 shadow-lg">
                <img 
                  src="https://picsum.photos/seed/apc/100/100" 
                  alt="Party Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-6">
              AK-27<br />
              <span className="text-brand-red">SITUATION ROOM</span>
            </h1>
            <div className="h-1.5 w-24 bg-brand-red mb-8"></div>
            <p className="text-white/90 text-xl max-w-md font-medium leading-relaxed">
              Advanced election monitoring and data collation platform for the 2027 mandate.
            </p>
          </div>

          <div className="mt-12 md:mt-0">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-1 bg-white/30"></div>
              <p className="font-mono text-[10px] text-white/60 uppercase tracking-[0.3em] font-bold">
                Taraba State &bull; Renewed Hope
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white relative overflow-hidden">
        {/* Decorative elements for the theme */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-red/5 rounded-bl-full"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-green/5 rounded-tr-full"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="mb-10">
            <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Access System</h2>
            <p className="text-gray-700 font-medium">Enter your authorized credentials to proceed.</p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-brand-red text-brand-red p-4 rounded-r-xl mb-6 text-sm font-bold flex items-center gap-3 shadow-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-gray-900 uppercase tracking-widest mb-2">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@kefas2027.org"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-900 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                required
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="pt-2">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white py-4 rounded-2xl hover:bg-opacity-90 transition-all font-black text-lg shadow-xl shadow-brand-green/20 disabled:opacity-70 flex justify-center items-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Access System'}
              </button>
              <p className="mt-6 text-center text-[10px] font-black text-gray-600 uppercase tracking-widest">
                Powered by AK-27 Campaign Organization
              </p>
            </div>
          </form>
          
          <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-center">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">
              &copy; {new Date().getFullYear()} AK-27
            </p>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-green"></div>
              <div className="w-2 h-2 rounded-full bg-white border border-gray-200"></div>
              <div className="w-2 h-2 rounded-full bg-brand-red"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCircle({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
