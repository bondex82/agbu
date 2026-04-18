import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LogOut, Check, X, Clock, MapPin, ShieldCheck, Activity, 
  Users, UserPlus, Trophy, Megaphone, Settings, BarChart3, 
  Search, Filter, Download, Plus, Trash2, AlertTriangle, Edit,
  Ban, CheckCircle2, Camera, Upload, User, Bell, LayoutDashboard,
  CheckSquare, Phone, TrendingUp, Printer, FileBarChart, Menu,
  Folder, ChevronLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

type Tab = 'dashboard' | 'approvals' | 'users' | 'units' | 'contestants' | 'broadcast' | 'settings' | 'evidence' | 'reports' | 'incidents';

const TARABA_LGAS = [
  "Ardo Kola", "Bali", "Donga", "Gashaka", "Gassol", "Ibi", "Jalingo", 
  "Karim Lamido", "Kurmi", "Lau", "Sardauna", "Takum", "Ussa", "Wukari", "Yorro", "Zing"
];

export default function AdminPanel({ user, socket, setUser }: { user: any, socket: any, setUser: (u: any) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine initial tab from URL
  const getInitialTab = (): Tab => {
    const path = location.pathname;
    if (path.includes('/admin/incidents')) return 'incidents';
    if (path.includes('/admin/reports')) return 'reports';
    if (path.includes('/admin/evidence')) return 'evidence';
    if (path.includes('/admin/approvals')) return 'approvals';
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/units')) return 'units';
    if (path.includes('/admin/contestants')) return 'contestants';
    if (path.includes('/admin/broadcast')) return 'broadcast';
    if (path.includes('/admin/settings')) return 'settings';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const tab = getInitialTab();
    if (tab !== activeTab) setActiveTab(tab);
  }, [location.pathname]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    if (tab === 'dashboard') {
      navigate('/admin');
    } else {
      navigate(`/admin/${tab}`);
    }
  };
  const [pendingResults, setPendingResults] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedContestant, setSelectedContestant] = useState<any>(null);
  const [isRefreshingIncidents, setIsRefreshingIncidents] = useState(false);
  const [contestants, setContestants] = useState<any[]>([]);
  const [pollingUnits, setPollingUnits] = useState<any[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all');
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showContestantModal, setShowContestantModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [globalAgentSearch, setGlobalAgentSearch] = useState('');
  const [agentSelectorFilter, setAgentSelectorFilter] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [newUser, setNewUser] = useState({
    name: '', email: '', password: '', role: 'agent', 
    phone: '', polling_unit: '', ward: '', lga: '', photo_url: ''
  });

  const [newContestant, setNewContestant] = useState({
    name: '', party: '', party_logo: '', candidate_picture: ''
  });

  const [newUnit, setNewUnit] = useState({
    name: '', ward: '', lga: '', total_registered: ''
  });

  const [stats, setStats] = useState({
    totalVotes: 0,
    totalAccredited: 0,
    totalPu: 0,
    reportedPu: 0,
    reportedAgents: 0,
    totalInvalid: 0,
    totalActiveVoters: 0,
    totalVotesCast: 0,
    totalRegistered: 0,
    totalLgas: 0,
    reportedLgas: 0,
    candidateVotes: [] as any[]
  });
  const [unitReports, setUnitReports] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [evidenceFilter, setEvidenceFilter] = useState('');
  const [selectedLgaFolder, setSelectedLgaFolder] = useState<string | null>(null);

  const [uploadCount, setUploadCount] = useState(0);
  const uploading = uploadCount > 0;

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

  const fetchPending = async () => {
    try {
      const res = await fetch('/api/results/pending', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setPendingResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContestants = async () => {
    try {
      const res = await fetch('/api/contestants');
      const data = await res.json();
      setContestants(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPollingUnits = async () => {
    try {
      const res = await fetch('/api/admin/units', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setPollingUnits(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnitReports = async () => {
    try {
      const res = await fetch('/api/units/stats');
      const data = await res.json();
      setUnitReports(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEvidence = async () => {
    try {
      const res = await fetch('/api/admin/evidence', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setEvidenceList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIncidents = async () => {
    setIsRefreshingIncidents(true);
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
    } finally {
      setTimeout(() => setIsRefreshingIncidents(false), 600);
    }
  };

  useEffect(() => {
    fetchPending();
    if (activeTab === 'users' || activeTab === 'broadcast') fetchUsers();
    if (activeTab === 'contestants') fetchContestants();
    if (activeTab === 'users' || activeTab === 'units') fetchPollingUnits();
    if (activeTab === 'incidents') fetchIncidents();
    if (activeTab === 'dashboard' || activeTab === 'reports') {
      fetchStats();
      fetchUnitReports();
    }
    if (activeTab === 'evidence') fetchEvidence();

    socket.on('new_result_pending', (data: any) => {
      fetchPending();
      const message = data?.polling_unit 
        ? `New result from ${data.polling_unit} by ${data.agent_name}!` 
        : 'New result submitted by an agent!';
      setNotifications(prev => [{ id: Date.now(), message }, ...prev]);
    });
    socket.on('stats_updated', () => {
      fetchStats();
      fetchUnitReports();
    });

    socket.on('incident_alert', (data: any) => {
      fetchIncidents();
      const message = `CRITICAL INCIDENT at ${data.polling_unit || 'Field'}: ${data.description}`;
      setNotifications(prev => [{ id: Date.now(), message }, ...prev]);
    });

    socket.on('incident_updated', () => {
      fetchIncidents();
    });
    
    return () => { 
      socket.off('new_result_pending'); 
      socket.off('stats_updated');
      socket.off('incident_alert');
      socket.off('incident_updated');
    };
  }, [socket, activeTab]);

  const handleAction = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await fetch('/api/results/' + id + '/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ status })
      });
      fetchPending();
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    try {
      const body: any = { message: broadcastMessage };
      if (broadcastTarget === 'selected') {
        if (selectedAgentIds.length === 0) {
          alert('Please select at least one agent');
          return;
        }
        body.target_user_ids = selectedAgentIds;
      } else {
        body.target_user_id = broadcastTarget === 'all' ? null : broadcastTarget;
      }

      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(body)
      });
      setBroadcastMessage('');
      setSelectedAgentIds([]);
      setBroadcastTarget('all');
      alert('Broadcast message sent successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingUser 
        ? `/api/admin/users/${editingUser.id}` 
        : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setShowUserModal(false);
        fetchUsers();
        setNewUser({ name: '', email: '', password: '', role: 'agent', phone: '', polling_unit: '', ward: '', lga: '', photo_url: '' });
        setEditingUser(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save user');
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user? This will fail if they have existing activity records.')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateContestant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = selectedContestant 
        ? `/api/admin/contestants/${selectedContestant.id}` 
        : '/api/admin/contestants';
      const method = selectedContestant ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(newContestant)
      });
      if (res.ok) {
        setShowContestantModal(false);
        fetchContestants();
        setNewContestant({ name: '', party: '', party_logo: '', candidate_picture: '' });
        setSelectedContestant(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save contestant');
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteContestant = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this contestant? This will fail if they have existing results.')) return;
    try {
      const res = await fetch(`/api/admin/contestants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      if (res.ok) {
        fetchContestants();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete contestant');
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingUnit ? `/api/admin/units/${editingUnit.id}` : '/api/admin/units';
      const method = editingUnit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(newUnit)
      });
      if (res.ok) {
        setShowUnitModal(false);
        setEditingUnit(null);
        fetchPollingUnits();
        setNewUnit({ name: '', ward: '', lga: '', total_registered: '' });
      }
    } catch (err) { console.error(err); }
  };

  const deleteUnit = async (id: number) => {
    if (!confirm('Are you sure you want to delete this polling unit?')) return;
    try {
      await fetch(`/api/admin/units/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      fetchPollingUnits();
    } catch (err) { console.error(err); }
  };

  const toggleUserStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await fetch(`/api/admin/users/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ status: newStatus })
      });
      fetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const handleUpdateIncidentStatus = async (id: number, status: 'resolved' | 'pending') => {
    try {
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchIncidents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generateIncidentPDF = (incident: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL INCIDENT REPORT', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Election Situation Room Alpha - Secure Verification System', 105, 30, { align: 'center' });

    // Report Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Report ID: INC-${incident.id}`, 20, 50);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 57);
    
    // Data Table
    autoTable(doc, {
      startY: 65,
      head: [['Field', 'Information']],
      body: [
        ['Reporter Name', incident.agent_name || 'N/A'],
        ['Personnel ID', incident.agent_id?.toString() || 'N/A'],
        ['Polling Unit', incident.polling_unit || 'N/A'],
        ['Ward', incident.ward || 'N/A'],
        ['LGA', incident.lga || 'N/A'],
        ['Incident Type', incident.is_quick_alert ? 'EMERGENCY ALERT' : 'Standard Report'],
        ['Submission Time', new Date(incident.created_at).toLocaleString()],
        ['Current Status', incident.status.toUpperCase()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
    });

    // Description Section
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont('helvetica', 'bold');
    doc.text('DETAILED DESCRIPTION:', 20, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const splitDescription = doc.splitTextToSize(incident.description, 170);
    doc.text(splitDescription, 20, finalY + 10);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        'This is a computed legal document generated from election field data. Any unauthorized alteration is a legal offense.',
        105,
        285,
        { align: 'center' }
      );
    }

    doc.save(`Incident_Report_${incident.id}_${incident.agent_name.replace(/\s+/g, '_')}.pdf`);
  };

  const generateElectionReportPDF = async (report: any) => {
    try {
      const res = await fetch(`/api/admin/reports/unit-details/${encodeURIComponent(report.name)}/${encodeURIComponent(report.ward)}/${encodeURIComponent(report.lga)}`, {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const details = await res.json();

      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(5, 150, 105); // emerald-600
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('OFFICIAL ELECTION RESULTS', 105, 18, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`${report.name.toUpperCase()} POLLING UNIT`, 105, 28, { align: 'center' });
      doc.setFontSize(8);
      doc.text('State Verification Portal - Situation Room Alpha', 105, 34, { align: 'center' });

      // Info Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Local Government Area: ${report.lga}`, 20, 50);
      doc.text(`Registration Area (Ward): ${report.ward}`, 20, 56);
      doc.text(`Polling Unit: ${report.name}`, 20, 62);
      doc.text(`Reporting Agent: ${report.agent_name || 'N/A'}`, 140, 50);
      doc.text(`Total Registered: ${report.total_registered?.toLocaleString() || '0'}`, 140, 56);
      doc.text(`Reported at: ${report.reported_at ? new Date(report.reported_at).toLocaleString() : 'N/A'}`, 140, 62);

      // Accreditation Table
      autoTable(doc, {
        startY: 70,
        head: [['Metric', 'Count']],
        body: [
          ['Total Registered Voters', report.total_registered?.toLocaleString() || '0'],
          ['Total Accredited Voters', report.accredited?.toLocaleString() || '0'],
          ['Total Votes Cast', report.votes_cast?.toLocaleString() || '0'],
          ['Valid Votes', report.valid?.toLocaleString() || '0'],
          ['Invalid / Rejected Votes', report.invalid?.toLocaleString() || '0'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105] },
        styles: { fontSize: 9, fontStyle: 'bold' }
      });

      const nextY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text('CANDIDATE VOTE BREAKDOWN', 20, nextY);

      // Results Table
      autoTable(doc, {
        startY: nextY + 5,
        head: [['Party', 'Candidate', 'Votes Received', 'Percentage (%)']],
        body: details.map((d: any) => {
          const percentage = report.valid > 0 ? ((d.votes / report.valid) * 100).toFixed(2) : '0.00';
          return [
            d.contestants?.party || 'N/A',
            d.contestants?.name || 'N/A',
            d.votes?.toLocaleString() || '0',
            `${percentage}%`
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9 }
      });

      // Verification Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          'This document is an electronic representation of the final result sheet submitted from the field.',
          105,
          285,
          { align: 'center' }
        );
        doc.text(`Page ${i} of ${pageCount}`, 200, 285, { align: 'right' });
      }

      doc.save(`Election_Report_${report.name.replace(/\s+/g, '_')}_${report.lga}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate detailed report PDF. Please ensure all results are approved.');
    }
  };

  const navItems = [
    { id: 'dashboard', name: 'Overview', icon: <BarChart3 size={18} /> },
    { id: 'incidents', name: 'Incident Reports', icon: <AlertTriangle size={18} />, count: incidents.length },
    { id: 'reports', name: 'Election Reports', icon: <FileBarChart size={18} /> },
    { id: 'evidence', name: 'Evidence Vault', icon: <Camera size={18} /> },
    { id: 'approvals', name: 'Approvals', icon: <Clock size={18} />, count: pendingResults.length },
    { id: 'users', name: 'User Management', icon: <Users size={18} /> },
    { id: 'units', name: 'Polling Units', icon: <MapPin size={18} /> },
    { id: 'contestants', name: 'Contestants', icon: <Trophy size={18} /> },
    { id: 'broadcast', name: 'Broadcast', icon: <Megaphone size={18} /> },
    { id: 'settings', name: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans relative">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-emerald-400 w-6 h-6" />
          <span className="font-black tracking-tighter uppercase text-sm">AK-27 Admin</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:flex md:h-screen sticky top-0 print:hidden
      `}>
        <div className="p-8 border-b-4 border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-emerald-400 w-10 h-10" />
            <h1 className="text-2xl font-black tracking-tighter uppercase">AK-27 <span className="text-emerald-400">SITUATION ROOM</span></h1>
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Admin Command Center</p>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id as Tab)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.name}
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === item.id ? 'bg-white text-emerald-600' : 'bg-emerald-600 text-white'}`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-slate-800">
            <Link to="/" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-900 hover:text-slate-200 rounded-xl transition-colors">
              <Activity size={18} /> Live Dashboard
            </Link>
          </div>
        </nav>
        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold overflow-hidden">
              {user.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">{user.name}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-slate-300 py-2.5 rounded-lg hover:bg-red-950 hover:text-red-400 transition-colors text-sm font-medium border border-slate-700 hover:border-red-900">
            <LogOut size={16} /> Secure Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto print:p-0 print:overflow-visible pt-20 md:pt-12">
        {/* Notifications Bar */}
        {notifications.length > 0 && (
          <div className="mb-8 space-y-2 print:hidden">
            {notifications.map(n => (
              <div key={n.id} className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3 text-emerald-800 font-medium">
                  <Bell size={18} />
                  {n.message}
                </div>
                <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} className="text-emerald-400 hover:text-emerald-600">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-12">
            <header className="border-b-4 border-slate-900 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">System Overview</h2>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">Real-time Performance & Collation Metrics</p>
              </div>
              
              {/* Stand-alone Agent Filter */}
              <div className="w-full md:w-96 relative">
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search Agent or Polling Unit..." 
                    className="w-full pl-14 pr-6 py-4 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-emerald-600 font-bold transition-all shadow-lg"
                    value={globalAgentSearch}
                    onChange={(e) => {
                      setGlobalAgentSearch(e.target.value);
                      if (users.length === 0) fetchUsers();
                    }}
                  />
                </div>
                {globalAgentSearch && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-96 overflow-y-auto p-2">
                    {users.filter(u => 
                      (u.name || '').toLowerCase().includes(globalAgentSearch.toLowerCase()) || 
                      (u.polling_unit && u.polling_unit.toLowerCase().includes(globalAgentSearch.toLowerCase()))
                    ).length === 0 ? (
                      <p className="p-4 text-center text-slate-400 font-bold uppercase text-xs">No agents found</p>
                    ) : (
                      users.filter(u => 
                        (u.name || '').toLowerCase().includes(globalAgentSearch.toLowerCase()) || 
                        (u.polling_unit && u.polling_unit.toLowerCase().includes(globalAgentSearch.toLowerCase()))
                      ).map(u => (
                        <button 
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                            setGlobalAgentSearch('');
                          }}
                          className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                            {u.photo_url ? <img src={u.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={18} className="text-slate-400" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-slate-900 uppercase text-xs font-display">{u.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{u.polling_unit || 'NO UNIT'}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </header>

            {/* Top 3 Candidates Display */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {stats.candidateVotes.slice(0, 3).map((c, idx) => (
                <motion.div 
                  key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 relative overflow-hidden group"
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 flex items-center justify-center font-black text-4xl opacity-10 -mr-4 -mt-4 rotate-12 ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : 'text-amber-700'}`}>
                    #{idx + 1}
                  </div>
                  <div className="flex items-center gap-6 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-slate-100 overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
                      {c.candidate_picture ? (
                        <img src={c.candidate_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-2xl uppercase">
                          {c.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter font-display">{c.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                          {c.party_logo ? <img src={c.party_logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : <span className="text-[8px] font-black">{c.party}</span>}
                        </div>
                        <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{c.party}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pooled</p>
                      <p className="text-4xl font-black text-slate-900 font-mono tracking-tighter">{c.total_votes.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lead Margin</p>
                      <p className="text-xl font-black text-emerald-600 font-mono tracking-tighter">
                        {idx === 0 ? (
                          stats.candidateVotes.length > 1 ? `+${(c.total_votes - stats.candidateVotes[1].total_votes).toLocaleString()}` : '0'
                        ) : (
                          `-${(stats.candidateVotes[0].total_votes - c.total_votes).toLocaleString()}`
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Reporting Progress Stats */}
            <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 -mr-32 -mt-32 rounded-full blur-3xl"></div>
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-3xl font-black uppercase tracking-tighter font-display">Collation Progress</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Reporting Status</p>
                    </div>
                    <div className="text-right">
                      <span className="text-4xl font-black text-emerald-400 font-mono tracking-tighter">{Math.round((stats.reportedPu / stats.totalPu) * 100) || 0}%</span>
                    </div>
                  </div>
                  <div className="w-full h-6 bg-white/10 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.reportedPu / stats.totalPu) * 100}%` }}
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-lg shadow-emerald-500/20"
                    ></motion.div>
                  </div>
                </div>
                <div className="flex gap-12 shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Units</p>
                    <p className="text-4xl font-black text-white font-mono tracking-tighter">{stats.totalPu.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Reported</p>
                    <p className="text-4xl font-black text-white font-mono tracking-tighter">{stats.reportedPu.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-3xl shadow-2xl border border-blue-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -mr-8 -mt-8 rounded-full transition-transform group-hover:scale-110"></div>
                <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mb-4 relative z-10">Total Active Voters</p>
                <p className="text-5xl font-black text-white font-display relative z-10">{stats.totalActiveVoters.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-8 rounded-3xl shadow-2xl border border-emerald-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -mr-8 -mt-8 rounded-full transition-transform group-hover:scale-110"></div>
                <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-4 relative z-10">Accredited Voters</p>
                <p className="text-5xl font-black text-white font-display relative z-10">{stats.totalAccredited.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-brand-red to-[#b0164a] p-8 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -mr-8 -mt-8 rounded-full transition-transform group-hover:scale-110"></div>
                <p className="text-[10px] font-black text-rose-100 uppercase tracking-widest mb-4 relative z-10">Total Votes Cast</p>
                <p className="text-5xl font-black text-white font-display relative z-10">{stats.totalVotesCast.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 relative z-10">Valid Votes</p>
                <p className="text-4xl font-black text-slate-900 font-display relative z-10">{stats.totalVotes.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 relative z-10">Invalid Ballots</p>
                <p className="text-4xl font-black text-rose-600 font-display relative z-10">{stats.totalInvalid.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 relative z-10">Reporting Progress</p>
                <div className="flex items-baseline gap-2 relative z-10">
                  <p className="text-4xl font-black text-slate-900 font-display">{stats.reportedPu}</p>
                  <p className="text-sm text-slate-400 font-black">/ {stats.totalPu} Units</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
              <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b border-slate-100 pb-4 font-display">Candidate Performance (Agent Entries)</h3>
              <div className="space-y-8">
                {stats.candidateVotes.map((c: any) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="font-black text-slate-900 uppercase tracking-widest text-sm font-display">{c.party} - {c.name}</div>
                      <div className="font-black text-xl text-slate-900 font-display">{c.total_votes.toLocaleString()}</div>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(c.total_votes / (stats.totalVotes || 1)) * 100}%` }}
                        className="h-full bg-emerald-500 rounded-full" 
                      ></motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">Polling Units</h2>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">Manage polling units organized by LGA and Ward.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowUnitModal(true)}
                  className="bg-emerald-600 text-white px-8 py-4 rounded-2xl hover:bg-emerald-700 flex items-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:scale-105"
                >
                  <Plus size={20} /> Add Polling Unit
                </button>
              </div>
            </header>
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Polling Unit Name</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Ward</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">LGA</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Registered</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pollingUnits.map(pu => (
                    <tr key={pu.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-6 font-black text-slate-900 uppercase tracking-tight font-display">{pu.name}</td>
                      <td className="px-8 py-6 text-slate-500 font-bold uppercase text-xs">{pu.ward}</td>
                      <td className="px-8 py-6 text-emerald-600 font-black uppercase text-xs">{pu.lga}</td>
                      <td className="px-8 py-6 text-slate-900 font-display font-black text-xl">{(pu.total_registered || 0).toLocaleString()}</td>
                      <td className="px-10 py-6 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingUnit(pu);
                            setNewUnit({
                              name: pu.name,
                              ward: pu.ward,
                              lga: pu.lga,
                              total_registered: pu.total_registered.toString()
                            });
                            setShowUnitModal(true);
                          }}
                          className="p-3 text-slate-300 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all group-hover:scale-110"
                        >
                          <Edit size={20} />
                        </button>
                        <button 
                          onClick={() => deleteUnit(pu.id)}
                          className="p-3 text-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all group-hover:scale-110"
                        >
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">Election Reports</h2>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">Comprehensive breakdown of results, charts, and statistics.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    window.focus();
                    window.print();
                  }}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl hover:bg-slate-800 flex items-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl transition-all print:hidden"
                >
                  <Printer size={20} /> Print Full Report
                </button>
              </div>
            </header>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Registered</p>
                <p className="text-4xl font-black text-slate-900 font-display">{stats.totalRegistered?.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Accredited</p>
                <p className="text-4xl font-black text-emerald-600 font-display">{stats.totalAccredited?.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Votes Cast</p>
                <p className="text-4xl font-black text-blue-600 font-display">{stats.totalVotesCast?.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Invalid Ballots</p>
                <p className="text-4xl font-black text-rose-600 font-display">{stats.totalInvalid?.toLocaleString()}</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-2">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 print:shadow-none print:border-slate-200 print-no-break">
                <h3 className="text-xl font-black uppercase tracking-tight mb-8 border-b border-slate-100 pb-4 font-display">Candidate Vote Distribution</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.candidateVotes}
                        dataKey="total_votes"
                        nameKey="party"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {stats.candidateVotes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#3b82f6' : index === 2 ? '#ef4444' : '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 print:shadow-none print:border-slate-200 print-no-break">
                <h3 className="text-xl font-black uppercase tracking-tight mb-8 border-b border-slate-100 pb-4 font-display">Candidate Performance</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.candidateVotes}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="party" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fontSize: 10 }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="total_votes" radius={[10, 10, 0, 0]}>
                        {stats.candidateVotes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#3b82f6' : index === 2 ? '#ef4444' : '#64748b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* LGA Breakdown */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden print:shadow-none print:border-slate-200 print-no-break">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xl font-black uppercase tracking-tight font-display">LGA Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">LGA Name</th>
                      <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Units Reported</th>
                      <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Accredited</th>
                      <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Total Votes</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Turnout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {Array.from(new Set(unitReports.map(r => r.lga))).sort().map(lgaName => {
                      const lgaUnits = unitReports.filter(r => r.lga === lgaName);
                      const reported = lgaUnits.filter(r => r.reported).length;
                      const accredited = lgaUnits.reduce((sum, r) => sum + (r.accredited || 0), 0);
                      const votes = lgaUnits.reduce((sum, r) => sum + (r.votes_cast || 0), 0);
                      const registered = lgaUnits.reduce((sum, r) => sum + (r.total_registered || 0), 0);
                      const turnout = registered > 0 ? (accredited / registered) * 100 : 0;

                      return (
                        <tr key={lgaName} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6 font-black text-slate-900 uppercase tracking-tight font-display">{lgaName}</td>
                          <td className="px-6 py-6 font-bold text-slate-600">{reported} / {lgaUnits.length}</td>
                          <td className="px-6 py-6 font-mono font-bold text-slate-600">{accredited.toLocaleString()}</td>
                          <td className="px-6 py-6 font-mono font-black text-slate-900">{votes.toLocaleString()}</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${turnout}%` }}></div>
                              </div>
                              <span className="text-xs font-black text-slate-900">{Math.round(turnout)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Unit Table */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden print:shadow-none print:border-slate-200">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-6 justify-between items-center print:hidden">
                <h3 className="text-xl font-black uppercase tracking-tight font-display">Polling Unit Details</h3>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Filter by Unit, Ward or LGA..." 
                    className="w-full pl-12 pr-6 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none focus:border-slate-900 font-bold transition-all"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Polling Unit</th>
                      <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">LGA / Ward</th>
                      <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Status</th>
                      <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Accredited</th>
                      <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Total Votes</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display text-right">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {unitReports
                      .filter(r => 
                        r.name.toLowerCase().includes(userFilter.toLowerCase()) ||
                        r.lga.toLowerCase().includes(userFilter.toLowerCase()) ||
                        r.ward.toLowerCase().includes(userFilter.toLowerCase())
                      )
                      .map(report => (
                      <tr key={`${report.name}-${report.ward}-${report.lga}`} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-900 uppercase tracking-tight font-display">{report.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Agent: {report.agent_name || 'UNASSIGNED'}</p>
                        </td>
                        <td className="px-6 py-6">
                          <p className="text-xs font-black text-emerald-600 uppercase">{report.lga}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.ward}</p>
                        </td>
                        <td className="px-6 py-6">
                          {report.reported ? (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200">
                              Reported
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-6 font-mono font-bold text-slate-600">
                          {report.accredited?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-6 font-mono font-black text-slate-900 text-lg">
                          {report.votes_cast?.toLocaleString() || '-'}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                            {report.reported && (
                              <button 
                                onClick={() => generateElectionReportPDF(report)}
                                className="p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all"
                                title="Download Detailed PDF"
                              >
                                <Download size={20} />
                              </button>
                            )}
                            {report.evidence_url ? (
                              <button 
                                onClick={() => {
                                  setSelectedEvidence({
                                    evidence_url: report.evidence_url,
                                    polling_unit: report.name,
                                    ward: report.ward,
                                    lga: report.lga,
                                    agent_name: report.agent_name,
                                    reported_at: report.reported_at
                                  });
                                }}
                                className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all group-hover:scale-110"
                                title="View Result Sheet"
                              >
                                <Camera size={20} />
                              </button>
                            ) : (
                              <span className="p-3 text-slate-200"><Camera size={20} /></span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">Pending Approvals</h2>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">Review and verify incoming results from polling units.</p>
              </div>
              <div className="bg-amber-100 text-amber-900 px-8 py-4 rounded-2xl text-sm font-black flex items-center gap-3 border border-amber-200 shadow-xl uppercase tracking-widest font-display">
                <Clock size={20} className="animate-pulse" /> {pendingResults.length} Pending Verification
              </div>
            </header>

            <div className="grid grid-cols-1 gap-10">
              {pendingResults.length === 0 ? (
                <div className="bg-white p-24 rounded-[3rem] border-4 border-dashed border-slate-100 text-center shadow-inner">
                  <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-emerald-100">
                    <CheckCircle2 size={48} className="text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-4 font-display">All Systems Clear</h3>
                  <p className="text-lg font-bold text-slate-400 uppercase tracking-widest font-display">There are no pending results waiting for verification.</p>
                </div>
              ) : (
                pendingResults.map(result => (
                  <div key={result.id} className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row hover:scale-[1.01] transition-transform group">
                    <div className="bg-slate-900 text-white p-10 md:w-80 flex flex-col justify-center items-center text-center space-y-6">
                      <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center text-slate-900 font-black text-3xl shadow-2xl group-hover:rotate-6 transition-transform">
                        {result.party}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight font-display">{result.candidate_name}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] font-display">{result.party}</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 p-10 flex flex-col md:flex-row justify-between gap-10">
                      <div className="space-y-8 flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Location</p>
                            <div className="flex items-start gap-3">
                              <MapPin size={20} className="text-emerald-500 mt-1" />
                              <div>
                                <p className="font-black text-slate-900 uppercase text-sm font-display">{result.polling_unit}</p>
                                <p className="text-xs font-bold text-slate-500 font-display">{result.ward}, {result.lga}</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Reporting Agent</p>
                            <div className="flex items-center gap-3">
                              <User size={20} className="text-emerald-500" />
                              <p className="font-black text-slate-900 uppercase text-sm font-display">{result.agent_name}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full w-fit border border-slate-100">
                          <Clock size={14} />
                          Reported at {new Date(result.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex flex-col items-center md:items-end justify-center gap-8 md:border-l md:border-slate-100 md:pl-10">
                        <div className="text-center md:text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reported Votes</p>
                          <p className="text-8xl font-black text-slate-900 font-display tracking-tighter">{result.votes.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-4 w-full md:w-auto">
                          <button 
                            onClick={() => handleAction(result.id, 'approved')}
                            className="flex-1 bg-emerald-600 text-white px-10 py-5 rounded-2xl hover:bg-emerald-700 flex items-center gap-2 justify-center font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:scale-105"
                          >
                            <Check size={20} /> Approve
                          </button>
                          <button 
                            onClick={() => handleAction(result.id, 'rejected')}
                            className="flex-1 bg-white text-rose-600 border-2 border-rose-600 px-10 py-5 rounded-2xl hover:bg-rose-50 flex items-center gap-2 justify-center font-black uppercase tracking-widest text-xs transition-all hover:scale-105"
                          >
                            <X size={20} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">User Management</h2>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">Manage agents, admins, and system access.</p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search agents by name or PU..." 
                    className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display shadow-lg"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                  />
                  {userFilter && (
                    <div className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="max-h-96 overflow-y-auto p-4 space-y-2">
                        {users.filter(u => 
                          (u.name || '').toLowerCase().includes(userFilter.toLowerCase()) || 
                          (u.polling_unit && u.polling_unit.toLowerCase().includes(userFilter.toLowerCase()))
                        ).length === 0 ? (
                          <p className="p-4 text-center text-slate-400 font-bold uppercase text-xs">No agents found</p>
                        ) : (
                          users.filter(u => 
                            (u.name || '').toLowerCase().includes(userFilter.toLowerCase()) || 
                            (u.polling_unit && u.polling_unit.toLowerCase().includes(userFilter.toLowerCase()))
                          ).map(u => (
                            <button 
                              key={u.id}
                              onClick={() => {
                                setSelectedUser(u);
                                setUserFilter('');
                              }}
                              className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left group"
                            >
                              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                {u.photo_url ? <img src={u.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={20} className="text-slate-400" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-black text-slate-900 uppercase text-sm font-display">{u.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.polling_unit || 'NO UNIT'}</p>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <TrendingUp size={16} className="text-emerald-500" />
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setEditingUser(null);
                    setNewUser({ name: '', email: '', password: '', role: 'agent', phone: '', polling_unit: '', ward: '', lga: '', photo_url: '' });
                    setShowUserModal(true);
                  }}
                  className="bg-emerald-600 text-white px-8 py-4 rounded-2xl hover:bg-emerald-700 flex items-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:scale-105 whitespace-nowrap"
                >
                  <UserPlus size={20} /> Add New User
                </button>
              </div>
            </header>
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">User Profile</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Contact Info</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Assigned Location</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display">Access Status</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] font-display text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200 shadow-sm">
                            {u.photo_url ? <img src={u.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={24} className="text-slate-400" />}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 uppercase tracking-tight font-display">{u.name}</p>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest font-display">{u.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-slate-900 font-display">{u.email}</p>
                        <p className="text-xs font-bold text-slate-400 font-display">{u.phone || 'NO PHONE'}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-widest font-display">{u.lga || 'N/A'}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase font-display">{u.polling_unit || 'NO ASSIGNMENT'}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border ${
                          u.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right space-x-2">
                        <button 
                          onClick={() => {
                            setEditingUser(u);
                            setNewUser({
                              name: u.name,
                              email: u.email,
                              password: '', // Don't pre-fill password
                              role: u.role,
                              phone: u.phone || '',
                              polling_unit: u.polling_unit || '',
                              ward: u.ward || '',
                              lga: u.lga || '',
                              photo_url: u.photo_url || ''
                            });
                            setShowUserModal(true);
                          }}
                          className="p-3 text-slate-300 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all hover:scale-110"
                          title="Edit User"
                        >
                          <Settings size={20} />
                        </button>
                        <button 
                          onClick={() => toggleUserStatus(u.id, u.status)}
                          className={`p-3 rounded-xl transition-all hover:scale-110 ${u.status === 'active' ? 'text-slate-300 hover:bg-rose-50 hover:text-rose-600' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={u.status === 'active' ? 'Block User' : 'Unblock User'}
                        >
                          {u.status === 'active' ? <Ban size={20} /> : <CheckCircle2 size={20} />}
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-3 text-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all hover:scale-110"
                          title="Delete User"
                        >
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'contestants' && (
          <div className="space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">Contestants</h2>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">Manage candidates and political parties.</p>
              </div>
              <button 
                onClick={() => setShowContestantModal(true)}
                className="bg-emerald-600 text-white px-8 py-4 rounded-2xl hover:bg-emerald-700 flex items-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:scale-105"
              >
                <Plus size={20} /> Add Candidate
              </button>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {contestants.map(c => (
                <div key={c.id} className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col gap-8 hover:scale-105 transition-transform group relative">
                  <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setSelectedContestant(c);
                        setNewContestant({
                          name: c.name,
                          party: c.party,
                          party_logo: c.party_logo || '',
                          candidate_picture: c.candidate_picture || ''
                        });
                        setShowContestantModal(true);
                      }}
                      className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all"
                    >
                      <Settings size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteContestant(c.id)}
                      className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center overflow-hidden border-4 border-white shadow-xl group-hover:rotate-3 transition-transform">
                      {c.candidate_picture ? <img src={c.candidate_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={40} className="text-slate-300" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-slate-900 uppercase tracking-tight text-2xl font-display leading-none mb-2">{c.name}</h3>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
                          {c.party_logo ? <img src={c.party_logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : <span className="text-[10px] font-black">{c.party}</span>}
                        </div>
                        <p className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] font-display">{c.party}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="space-y-12">
            <header className="border-b-4 border-slate-900 pb-6">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">Command Center</h2>
              <p className="text-lg font-bold text-slate-700 uppercase tracking-widest font-display">Direct communication with all field agents.</p>
            </header>
            <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100">
              <div className="max-w-3xl mx-auto space-y-10">
                <div className="flex items-center gap-6 p-8 bg-rose-50 border-2 border-rose-100 rounded-[2rem] text-rose-900">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-lg">
                    <AlertTriangle size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight font-display">Emergency Broadcast</h4>
                    <p className="text-sm font-bold opacity-75 font-display">Messages sent from this console are delivered instantly to all active agent portals.</p>
                  </div>
                </div>
                
                <form onSubmit={handleBroadcast} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2 mb-4">Target Audience</label>
                      <select 
                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-black uppercase text-xs tracking-widest font-display"
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value)}
                      >
                        <option value="all">All Agents</option>
                        <option value="selected">Selected Agents ({selectedAgentIds.length})</option>
                        <optgroup label="Individual Agents">
                          {users.filter(u => u.role === 'agent').map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.polling_unit})</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Message Content</label>
                    <textarea 
                      className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-xl font-bold font-display min-h-[250px] shadow-inner"
                      placeholder="Enter your priority message here..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                    ></textarea>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6">
                    <button type="submit" className="flex-1 bg-slate-900 text-white px-10 py-6 rounded-2xl hover:bg-emerald-600 flex items-center justify-center gap-4 font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all hover:scale-[1.02]">
                      <Megaphone size={20} /> Execute Broadcast
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowAgentSelector(true)}
                      className="flex-1 bg-white text-slate-900 border-2 border-slate-900 px-10 py-6 rounded-2xl hover:bg-slate-50 flex items-center justify-center gap-4 font-black uppercase tracking-[0.2em] text-sm transition-all"
                    >
                      <Users size={20} /> {selectedAgentIds.length > 0 ? `Selected (${selectedAgentIds.length})` : 'Select Agents'}
                    </button>
                  </div>
                </form>

                {showAgentSelector && (
                  <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                      <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                        <div>
                          <h3 className="text-2xl font-black uppercase tracking-tight font-display">Select Target Agents</h3>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Choose agents for bulk messaging</p>
                        </div>
                        <button onClick={() => setShowAgentSelector(false)} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 space-y-4">
                        <div className="flex justify-between mb-4 gap-4 items-center">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                              type="text"
                              placeholder="Filter agents..."
                              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-slate-900 transition-all"
                              value={agentSelectorFilter}
                              onChange={(e) => setAgentSelectorFilter(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-4">
                            <button 
                              onClick={() => setSelectedAgentIds(users.filter(u => u.role === 'agent').map(u => u.id))}
                              className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                            >
                              Select All
                            </button>
                            <button 
                              onClick={() => setSelectedAgentIds([])}
                              className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:underline"
                            >
                              Deselect All
                            </button>
                          </div>
                        </div>
                        {users.filter(u => u.role === 'agent' && (
                          (u.name || '').toLowerCase().includes(agentSelectorFilter.toLowerCase()) ||
                          (u.polling_unit && u.polling_unit.toLowerCase().includes(agentSelectorFilter.toLowerCase()))
                        )).map(u => (
                          <label key={u.id} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-50 hover:border-slate-200 cursor-pointer transition-all">
                            <input 
                              type="checkbox" 
                              checked={selectedAgentIds.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAgentIds([...selectedAgentIds, u.id]);
                                } else {
                                  setSelectedAgentIds(selectedAgentIds.filter(id => id !== u.id));
                                }
                              }}
                              className="w-6 h-6 rounded-lg border-2 border-slate-200 text-slate-900 focus:ring-slate-900"
                            />
                            <div className="flex-1">
                              <p className="font-black text-slate-900 uppercase text-sm">{u.name}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{u.polling_unit} &bull; {u.lga}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="p-8 border-t border-slate-100 bg-slate-50">
                        <button 
                          onClick={() => {
                            setBroadcastTarget('selected');
                            setShowAgentSelector(false);
                          }}
                          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-600 transition-all"
                        >
                          Confirm Selection ({selectedAgentIds.length})
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-6">
              <div className="flex items-center gap-4">
                {selectedLgaFolder && (
                  <button 
                    onClick={() => setSelectedLgaFolder(null)}
                    className="p-3 bg-slate-100 text-slate-900 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                <div>
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">
                    {selectedLgaFolder ? selectedLgaFolder : 'Evidence Vault'}
                  </h2>
                  <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">
                    {selectedLgaFolder 
                      ? `Viewing evidence sheets for ${selectedLgaFolder}` 
                      : 'Secure repository of all uploaded result sheets organized by LGA.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by PU, Ward or LGA..." 
                    className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display shadow-lg"
                    value={evidenceFilter}
                    onChange={(e) => setEvidenceFilter(e.target.value)}
                  />
                </div>
                <button 
                  onClick={fetchEvidence}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl hover:bg-slate-800 flex items-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl transition-all"
                >
                  <Activity size={20} /> Refresh
                </button>
              </div>
            </header>

            {!selectedLgaFolder ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {Array.from(new Set(evidenceList.map(e => e.lga))).sort().map(lga => {
                  const count = evidenceList.filter(e => e.lga === lga).length;
                  return (
                    <motion.div 
                      key={lga}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedLgaFolder(lga)}
                      className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 cursor-pointer group hover:bg-slate-900 transition-all duration-500"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <Folder size={32} />
                        </div>
                        <span className="px-4 py-2 bg-slate-100 text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest group-hover:bg-white/10 group-hover:text-white transition-colors">
                          {count} Files
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight font-display group-hover:text-white transition-colors">{lga}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 group-hover:text-slate-400 transition-colors">Local Government Area</p>
                    </motion.div>
                  );
                })}
                {evidenceList.length === 0 && (
                  <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                    <Camera size={48} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase tracking-widest">No evidence uploaded yet</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {evidenceList.filter(e => 
                  e.lga === selectedLgaFolder && (
                    e.polling_unit.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                    e.ward.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                    e.agent_name.toLowerCase().includes(evidenceFilter.toLowerCase())
                  )
                ).length === 0 ? (
                  <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                    <Camera size={48} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase tracking-widest">No evidence found in this folder</p>
                  </div>
                ) : (
                  evidenceList.filter(e => 
                    e.lga === selectedLgaFolder && (
                      e.polling_unit.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                      e.ward.toLowerCase().includes(evidenceFilter.toLowerCase()) ||
                      e.agent_name.toLowerCase().includes(evidenceFilter.toLowerCase())
                    )
                  ).map((e, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden group hover:shadow-2xl transition-all"
                    >
                      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                        <img 
                          src={e.evidence_url} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          referrerPolicy="no-referrer"
                          alt="Evidence"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          <button 
                            onClick={() => setSelectedEvidence(e)}
                            className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-900 hover:bg-emerald-500 hover:text-white transition-all shadow-xl"
                          >
                            <Search size={20} />
                          </button>
                          <a 
                            href={e.evidence_url} 
                            download 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-900 hover:bg-emerald-500 hover:text-white transition-all shadow-xl"
                          >
                            <Download size={20} />
                          </a>
                        </div>
                        <div className="absolute top-4 left-4">
                          <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg ${
                            e.type === 'Result Sheet' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {e.type}
                          </span>
                        </div>
                      </div>
                      <div className="p-6 space-y-3">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{e.lga} &bull; {e.ward}</p>
                          <h4 className="font-black text-slate-900 uppercase text-sm font-display truncate">{e.polling_unit}</h4>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">
                              {e.agent_name.charAt(0)}
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{e.agent_name}</span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400">{new Date(e.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'incidents' && (
          <div className="space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">Incident Reportage</h2>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest font-display">Real-time security updates from field agents.</p>
              </div>
              <button 
                onClick={fetchIncidents}
                disabled={isRefreshingIncidents}
                className={`${isRefreshingIncidents ? 'bg-slate-700' : 'bg-slate-900'} text-white px-8 py-4 rounded-2xl hover:bg-slate-800 flex items-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                <Activity size={20} className={isRefreshingIncidents ? 'animate-spin' : ''} /> 
                {isRefreshingIncidents ? 'Refreshing...' : 'Refresh Feed'}
              </button>
            </header>

            {incidents.length === 0 ? (
              <div className="text-center py-40 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                <ShieldCheck size={64} className="text-emerald-500 mx-auto mb-6 opacity-20" />
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">All Clear: No security incidents reported</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-12">
                {incidents.filter(i => i.is_quick_alert && i.status === 'pending').length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-rose-600 font-black uppercase tracking-[0.3em] text-[10px] flex items-center gap-2 ml-4">
                       <div className="w-2 h-2 bg-rose-600 rounded-full animate-ping"></div>
                       Critical emergency alerts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {incidents.filter(i => i.is_quick_alert && i.status === 'pending').map(i => (
                        <motion.div 
                          key={i.id}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="bg-rose-600 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border-4 border-rose-400"
                        >
                          <div className="absolute top-0 right-0 p-6 opacity-20">
                            <AlertTriangle size={64} />
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 overflow-hidden flex-shrink-0">
                                {i.agent_photo ? <img src={i.agent_photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-white/50"><User size={24} /></div>}
                              </div>
                              <div>
                                <p className="font-black uppercase tracking-tight text-lg leading-tight">{i.agent_name}</p>
                                <p className="text-[10px] font-bold text-rose-200 uppercase tracking-widest truncate max-w-[150px]">{i.polling_unit}</p>
                              </div>
                            </div>
                            <div className="bg-white/10 p-6 rounded-2xl border border-white/20 mb-6 italic font-bold leading-relaxed text-sm">
                              "{i.description}"
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-rose-100 mb-6">
                              <span className="flex items-center gap-2"><MapPin size={12} /> {i.ward}, {i.lga}</span>
                              <span>{new Date(i.created_at).toLocaleTimeString()}</span>
                            </div>
                            <button 
                              onClick={() => handleUpdateIncidentStatus(i.id, 'resolved')}
                              className="w-full py-4 bg-white text-rose-600 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={18} /> Mark as Resolved
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                  <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter font-display">Report History</h3>
                    <div className="px-4 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                      {incidents.length} Total Reports
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400">
                          <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest font-display">Reporter</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest font-display">Location</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest font-display">Message</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest font-display text-center">Status</th>
                          <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest font-display text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {incidents.map(i => (
                          <tr key={i.id} className={`hover:bg-slate-50 transition-colors ${i.is_quick_alert ? 'bg-rose-50/30' : ''} ${i.status === 'resolved' ? 'opacity-50 grayscale' : ''}`}>
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                                  {i.agent_photo ? <img src={i.agent_photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={16} /></div>}
                                </div>
                                <div>
                                  <p className="font-black text-slate-900 uppercase text-xs font-display">{i.agent_name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">#{i.agent_id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <p className="font-black text-slate-900 uppercase text-xs font-display">{i.polling_unit}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{i.ward}, {i.lga}</p>
                            </td>
                            <td className="px-8 py-6 max-w-md">
                              <p className={`text-xs font-bold leading-relaxed ${i.is_quick_alert && i.status !== 'resolved' ? 'text-rose-600' : 'text-slate-600'}`}>
                                {i.is_quick_alert && (
                                  <span className="mr-2 inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 text-white rounded text-[8px] font-black animate-pulse">
                                    <AlertTriangle size={8} /> ALERT
                                  </span>
                                )}
                                {i.description}
                              </p>
                              <div className="mt-3 flex gap-2">
                                <button 
                                  onClick={() => generateIncidentPDF(i)}
                                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all border border-slate-200"
                                >
                                  <Download size={10} /> Download PDF Report
                                </button>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                  i.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : i.is_quick_alert ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {i.status}
                                </span>
                                
                                {i.status === 'pending' ? (
                                  <button 
                                    onClick={() => handleUpdateIncidentStatus(i.id, 'resolved')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                                  >
                                    <Check size={12} /> Resolve
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleUpdateIncidentStatus(i.id, 'pending')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                                  >
                                    <Clock size={12} /> Reopen
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-10 py-6 text-right font-mono font-bold text-slate-400 text-xs whitespace-nowrap">
                              {new Date(i.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-12">
            <header className="border-b-4 border-slate-900 pb-6">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-display">System Settings</h2>
              <p className="text-lg font-bold text-slate-700 uppercase tracking-widest font-display">Configure situation room parameters and security.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b border-slate-100 pb-4 font-display flex items-center gap-3">
                  <ShieldCheck className="text-emerald-500" /> Security Configuration
                </h3>
                <div className="space-y-8">
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div>
                      <p className="font-black text-slate-900 uppercase text-sm font-display">Two-Factor Authentication</p>
                      <p className="text-xs font-bold text-slate-600 font-display">Add an extra layer of security to admin accounts.</p>
                    </div>
                    <div className="w-14 h-8 bg-emerald-500 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-6 h-6 bg-white rounded-full shadow-md"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2">Session Timeout (Minutes)</label>
                    <input type="number" defaultValue={30} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 outline-none font-display font-black text-xl" />
                  </div>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b border-slate-100 pb-4 font-display flex items-center gap-3">
                  <Activity className="text-emerald-500" /> Live Feed Control
                </h3>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Auto-Refresh Rate (Seconds)</label>
                    <input type="number" defaultValue={5} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 outline-none font-display font-black text-xl" />
                  </div>
                  <div className="flex items-center justify-between p-6 bg-rose-50 rounded-3xl border border-rose-100">
                    <div>
                      <p className="font-black text-rose-900 uppercase text-sm font-display">Maintenance Mode</p>
                      <p className="text-xs font-bold text-rose-400 font-display">Disable agent submissions during updates.</p>
                    </div>
                    <div className="w-14 h-8 bg-rose-200 rounded-full relative cursor-pointer">
                      <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full shadow-md"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] overflow-y-auto p-4 md:p-8">
            <div className="min-h-full flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] w-full max-w-3xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-100 my-auto"
              >
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter font-display">
                      {editingUser ? 'Edit Personnel' : 'Authorize Personnel'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-1">
                      {editingUser ? 'Update System Access' : 'System Access Provisioning'}
                    </p>
                  </div>
                  <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-all"><X size={24} /></button>
                </div>
                <form onSubmit={handleCreateUser} className="p-12 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Full Legal Name</label>
                      <input required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-lg" value={newUser.name} onChange={e => setNewUser(prev => ({...prev, name: e.target.value}))} />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Email Address</label>
                      <input required type="email" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-lg" value={newUser.email} onChange={e => setNewUser(prev => ({...prev, email: e.target.value}))} />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">
                        {editingUser ? 'New Password (Leave blank to keep current)' : 'Secure Password'}
                      </label>
                      <input required={!editingUser} type="password" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-lg" value={newUser.password} onChange={e => setNewUser(prev => ({...prev, password: e.target.value}))} />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Mobile Number</label>
                      <input className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-lg" value={newUser.phone} onChange={e => setNewUser(prev => ({...prev, phone: e.target.value}))} />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">LGA Assignment</label>
                      <select 
                        required 
                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-black uppercase text-xs tracking-widest font-display" 
                        value={newUser.lga} 
                        onChange={e => setNewUser(prev => ({...prev, lga: e.target.value, ward: '', polling_unit: ''}))}
                      >
                        <option value="">Select LGA</option>
                        {TARABA_LGAS.map(lga => <option key={lga} value={lga}>{lga}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Polling Unit Assignment</label>
                      <select 
                        required 
                        disabled={!newUser.lga}
                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-black uppercase text-xs tracking-widest font-display disabled:opacity-50" 
                        value={newUser.polling_unit} 
                        onChange={e => {
                          const pu = pollingUnits.find(p => p.name === e.target.value && p.lga?.toLowerCase() === newUser.lga?.toLowerCase());
                          setNewUser(prev => ({
                            ...prev, 
                            polling_unit: e.target.value,
                            ward: pu ? pu.ward : ''
                          }));
                        }}
                      >
                        <option value="">Select Polling Unit</option>
                        {pollingUnits
                          .filter(pu => pu.lga?.toLowerCase() === newUser.lga?.toLowerCase())
                          .map(pu => <option key={pu.id} value={pu.name}>{pu.name} ({pu.ward})</option>)
                        }
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Profile Photo</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden" 
                          id="user-photo-upload"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = await handleFileUpload(file);
                              if (url) setNewUser(prev => ({...prev, photo_url: url}));
                              e.target.value = ''; // Clear input
                            }
                          }}
                        />
                        <div className="flex-1 flex gap-2">
                          <label htmlFor="user-photo-upload" className="flex-1 flex items-center justify-center gap-2 p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-slate-900 transition-colors font-bold text-slate-700">
                            <Upload size={20} /> {uploading ? 'Uploading...' : newUser.photo_url ? 'Change Photo' : 'Upload Photo'}
                          </label>
                          {newUser.photo_url && (
                            <button 
                              type="button"
                              onClick={() => setNewUser(prev => ({...prev, photo_url: ''}))}
                              className="p-5 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                        {newUser.photo_url && (
                          <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-100 shrink-0">
                            <img src={newUser.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-emerald-600 transition-all hover:scale-[1.02] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading Assets...' : (editingUser ? 'Update Personnel' : 'Authorize Personnel')}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        )}

        {/* Contestant Modal */}
        {showContestantModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] overflow-y-auto p-4 md:p-8">
            <div className="min-h-full flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] w-full max-w-xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-100 my-auto"
              >
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter font-display">
                      {selectedContestant ? 'Edit Contestant' : 'Add Contestant'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-1">
                      {selectedContestant ? 'Update Candidate Details' : 'Candidate Registration'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowContestantModal(false);
                      setSelectedContestant(null);
                      setNewContestant({ name: '', party: '', party_logo: '', candidate_picture: '' });
                    }} 
                    className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleCreateContestant} className="p-12 space-y-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Candidate Full Name</label>
                    <input required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-lg" value={newContestant.name} onChange={e => setNewContestant(prev => ({...prev, name: e.target.value}))} />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Political Party Acronym</label>
                    <input required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-black uppercase tracking-[0.2em] font-display text-lg" value={newContestant.party} onChange={e => setNewContestant(prev => ({...prev, party: e.target.value}))} />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Candidate Picture</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        id="candidate-photo-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file);
                            if (url) setNewContestant(prev => ({...prev, candidate_picture: url}));
                            e.target.value = '';
                          }
                        }}
                      />
                      <div className="flex-1 flex gap-2">
                        <label htmlFor="candidate-photo-upload" className="flex-1 flex items-center justify-center gap-2 p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-slate-900 transition-colors font-bold text-slate-500">
                          <Upload size={20} /> {uploading ? 'Uploading...' : newContestant.candidate_picture ? 'Change Picture' : 'Upload Picture'}
                        </label>
                        {newContestant.candidate_picture && (
                          <button 
                            type="button"
                            onClick={() => setNewContestant(prev => ({...prev, candidate_picture: ''}))}
                            className="p-5 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                      {newContestant.candidate_picture && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-100 shrink-0">
                          <img src={newContestant.candidate_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Party Logo</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        id="party-logo-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file);
                            if (url) setNewContestant(prev => ({...prev, party_logo: url}));
                            e.target.value = '';
                          }
                        }}
                      />
                      <div className="flex-1 flex gap-2">
                        <label htmlFor="party-logo-upload" className="flex-1 flex items-center justify-center gap-2 p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-slate-900 transition-colors font-bold text-slate-500">
                          <Upload size={20} /> {uploading ? 'Uploading...' : newContestant.party_logo ? 'Change Logo' : 'Upload Logo'}
                        </label>
                        {newContestant.party_logo && (
                          <button 
                            type="button"
                            onClick={() => setNewContestant(prev => ({...prev, party_logo: ''}))}
                            className="p-5 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                      {newContestant.party_logo && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-100 shrink-0">
                          <img src={newContestant.party_logo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-emerald-600 transition-all hover:scale-[1.02] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading Assets...' : (selectedContestant ? 'Update Candidate' : 'Register Candidate')}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        )}

        {/* Polling Unit Modal */}
        {showUnitModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] overflow-y-auto p-4 md:p-8">
            <div className="min-h-full flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] w-full max-w-xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-100 my-auto"
              >
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter font-display">Add Polling Unit</h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-1">Location Management</p>
                  </div>
                  <button onClick={() => {
                    setShowUnitModal(false);
                    setEditingUnit(null);
                    setNewUnit({ name: '', ward: '', lga: '', total_registered: '' });
                  }} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-all"><X size={24} /></button>
                </div>
                <form onSubmit={handleCreateUnit} className="p-12 space-y-8">
                  <h3 className="text-3xl font-black uppercase tracking-tighter font-display">
                    {editingUnit ? 'Edit Polling Unit' : 'Add Polling Unit'}
                  </h3>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Unit Name (e.g. PU-001)</label>
                    <input required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-lg" value={newUnit.name} onChange={e => setNewUnit(prev => ({...prev, name: e.target.value}))} />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Ward Name</label>
                    <input required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-lg" value={newUnit.ward} onChange={e => setNewUnit(prev => ({...prev, ward: e.target.value}))} />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Local Government Area (LGA)</label>
                    <select 
                      required 
                      className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-black uppercase text-xs tracking-widest font-display" 
                      value={newUnit.lga} 
                      onChange={e => setNewUnit(prev => ({...prev, lga: e.target.value}))}
                    >
                      <option value="">Select LGA</option>
                      {TARABA_LGAS.map(lga => <option key={lga} value={lga}>{lga}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Total Registered Voters</label>
                    <input type="number" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 font-bold font-display text-2xl font-black" value={newUnit.total_registered} onChange={e => setNewUnit(prev => ({...prev, total_registered: e.target.value}))} />
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-emerald-600 transition-all hover:scale-[1.02] text-sm">
                    {editingUnit ? 'Update Unit' : 'Register Unit'}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        )}

        {/* Personnel Profile Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[110] overflow-y-auto p-4 md:p-8">
            <div className="min-h-full flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] w-full max-w-2xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-100 my-auto"
              >
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter font-display">Personnel Profile</h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-1">System Identity Verification</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-all"><X size={24} /></button>
                </div>
                <div className="p-12 flex flex-col items-center text-center space-y-8">
                  <div className="relative">
                    <div className="w-48 h-48 rounded-[3rem] bg-slate-100 flex items-center justify-center overflow-hidden border-8 border-white shadow-2xl">
                      {selectedUser.photo_url ? <img src={selectedUser.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={80} className="text-slate-300" />}
                    </div>
                    <div className={`absolute -bottom-4 -right-4 w-12 h-12 rounded-full border-8 border-white shadow-xl ${selectedUser.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter font-display">{selectedUser.name}</h3>
                    <p className="text-lg font-black text-emerald-600 uppercase tracking-widest font-display">{selectedUser.role.replace('_', ' ')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-8 w-full pt-8 border-t border-slate-100">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Email Address</p>
                      <p className="font-bold text-slate-900">{selectedUser.email}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Phone Number</p>
                      <p className="font-bold text-slate-900">{selectedUser.phone || 'N/A'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">LGA Assignment</p>
                      <p className="font-bold text-slate-900 uppercase">{selectedUser.lga || 'N/A'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Polling Unit</p>
                      <p className="font-bold text-slate-900 uppercase">{selectedUser.polling_unit || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="w-full pt-8">
                    <button 
                      onClick={() => {
                        toggleUserStatus(selectedUser.id, selectedUser.status);
                        setSelectedUser(prev => prev ? {...prev, status: prev.status === 'active' ? 'blocked' : 'active'} : null);
                      }}
                      className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                        selectedUser.status === 'active' 
                          ? 'bg-rose-50 text-rose-600 border-2 border-rose-100 hover:bg-rose-600 hover:text-white' 
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {selectedUser.status === 'active' ? <Ban size={20} /> : <CheckCircle2 size={20} />}
                      {selectedUser.status === 'active' ? 'Block Personnel Access' : 'Restore Personnel Access'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
        {/* Evidence Viewer Modal */}
        {selectedEvidence && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[200] overflow-y-auto p-4 md:p-12 flex flex-col">
            <div className="flex justify-between items-center mb-8 text-white">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400">
                  <Camera size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter font-display">Evidence Viewer</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {selectedEvidence.polling_unit} &bull; {selectedEvidence.ward} &bull; {selectedEvidence.lga}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => window.print()}
                  className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/20 transition-all"
                  title="Print Evidence"
                >
                  <Printer size={24} />
                </button>
                <a 
                  href={selectedEvidence.evidence_url} 
                  download 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white hover:bg-emerald-500 transition-all shadow-xl"
                  title="Download Evidence"
                >
                  <Download size={24} />
                </a>
                <button 
                  onClick={() => setSelectedEvidence(null)} 
                  className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/20 transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-white rounded-[3rem] overflow-hidden shadow-2xl relative group print:shadow-none print:rounded-none">
              <div className="absolute inset-0 overflow-auto p-8 flex items-center justify-center bg-slate-100">
                <img 
                  src={selectedEvidence.evidence_url} 
                  className="max-w-full h-auto shadow-2xl rounded-lg print:shadow-none" 
                  referrerPolicy="no-referrer"
                  alt="Election Evidence"
                />
              </div>
              
              {/* Overlay info for print */}
              <div className="hidden print:block absolute bottom-8 left-8 right-8 bg-white p-6 border-2 border-slate-900 rounded-2xl">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Source Polling Unit</p>
                    <p className="text-xl font-black uppercase text-slate-900">{selectedEvidence.polling_unit}</p>
                    <p className="text-xs font-bold text-slate-600">{selectedEvidence.ward}, {selectedEvidence.lga}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Reporting Agent</p>
                    <p className="text-xl font-black uppercase text-slate-900">{selectedEvidence.agent_name}</p>
                    <p className="text-xs font-bold text-slate-600">Reported: {new Date(selectedEvidence.created_at || selectedEvidence.reported_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] print:hidden">
              Official Election Evidence &bull; Situation Room Alpha &bull; Secure Verification System
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CheckCircle({ className, size }: { className?: string, size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
