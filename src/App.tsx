import React, { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { LayoutDashboard, UserCircle, ShieldCheck, LogOut, Menu, X, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AgentPanel from './pages/AgentPanel';
import AdminPanel from './pages/AdminPanel';
import LiveResults from './pages/LiveResults';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-2xl shadow-2xl border-4 border-slate-900 max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-100">
              <AlertTriangle className="text-red-600" size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-4 text-balance">System Interruption</h2>
            <p className="text-slate-500 font-bold mb-8 leading-relaxed">
              An unexpected error occurred in the situation room. The system has been halted to protect data integrity.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCw size={20} /> Restart Console
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const socket = io((import.meta as any).env.VITE_APP_URL || window.location.origin);

function Sidebar({ user, setUser }: { user: any, setUser: (u: any) => void }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [apcCandidate, setApcCandidate] = useState<any>(null);

  useEffect(() => {
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
      .catch(err => console.error('Sidebar fetch error:', err));
  }, []);

  const locationPath = location.pathname;
  const hideSidebar = locationPath === '/login' || locationPath.startsWith('/admin') || locationPath === '/results';
  if (hideSidebar) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, roles: ['public', 'admin', 'super_admin'] },
    { name: 'Live Results', path: '/results', icon: <TrendingUp size={20} />, roles: ['public', 'admin', 'super_admin'] },
    { name: 'Agent Portal', path: '/agent', icon: <UserCircle size={20} />, roles: ['agent'] },
    { name: 'Admin Console', path: '/admin', icon: <ShieldCheck size={20} />, roles: ['admin', 'super_admin'] },
  ];

  const filteredNav = navItems.filter(item => 
    item.roles.includes('public') || (user && item.roles.includes(user.role))
  );

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-brand-green text-white p-4 flex items-center justify-between md:hidden shadow-lg">
        <div className="flex items-center gap-2">
          <img 
            src={apcCandidate?.candidate_picture || "https://picsum.photos/seed/election/100/100"} 
            alt="Logo" 
            className="w-8 h-8 rounded-full border border-white object-cover bg-white"
            referrerPolicy="no-referrer"
          />
          <span className="font-black tracking-tighter uppercase text-sm">AK-27 Situation Room</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-1"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-0
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 bg-brand-green text-white">
            <div className="flex items-center gap-3 mb-2">
              <img 
                src={apcCandidate?.candidate_picture || "https://picsum.photos/seed/election/100/100"} 
                alt="Election Logo" 
                className="w-12 h-12 rounded-full border-2 border-white object-cover bg-white"
                referrerPolicy="no-referrer"
              />
              <h2 className="font-bold leading-tight">AK-27 Situation Room</h2>
            </div>
            <p className="text-[10px] uppercase tracking-tighter opacity-80 font-bold">Real-time Election Monitoring & Collation</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNav.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium
                  ${location.pathname === item.path 
                    ? 'bg-brand-green/10 text-brand-green' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-brand-green'}
                `}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                    {user.photo_url ? (
                      <img 
                        src={user.photo_url} 
                        alt={user.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserCircle className="text-white w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">{user.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-brand-red hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
                >
                  <LogOut size={18} /> Logout
                </button>
              </div>
            ) : (
              <Link 
                to="/login" 
                className="w-full flex items-center justify-center gap-2 bg-brand-green text-white py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-opacity-90 transition-all"
              >
                Staff Login
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    setIsAuthReady(true);
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  return (
    <Router>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </Router>
  );
}

function AppContent() {
  const [user, setUser] = useState<{id: number, name: string, role: string} | null>(() => {
    const storedUser = localStorage.getItem('user');
    try {
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const location = useLocation();
  const hideSidebar = location.pathname === '/login' || location.pathname.startsWith('/admin') || location.pathname === '/results';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} setUser={setUser} />
      <main className={`flex-1 relative overflow-y-auto ${!hideSidebar ? 'pt-16 md:pt-0' : ''}`}>
        <Routes>
          <Route path="/" element={<Dashboard socket={socket} />} />
          <Route path="/results" element={<LiveResults socket={socket} />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route 
            path="/agent" 
            element={user?.role === 'agent' ? <AgentPanel user={user} setUser={setUser} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin/*" 
            element={(user?.role === 'admin' || user?.role === 'super_admin') ? <AdminPanel user={user} socket={socket} setUser={setUser} /> : <Navigate to="/login" />} 
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
