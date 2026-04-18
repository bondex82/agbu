import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-election-key-2027';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Test Supabase connection and ensure storage bucket exists
async function testSupabase() {
  try {
    const { data, error } = await supabase.from('contestants').select('id').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error.message);
    } else {
      console.log('Supabase connection successful');
    }

    // Ensure storage bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    // Check for incidents table (informative only)
    const { error: incidentTableError } = await supabase.from('incidents').select('id').limit(1);
    if (incidentTableError && incidentTableError.message.includes('relation "public.incidents" does not exist')) {
      console.warn('--- ACTION REQUIRED ---');
      console.warn('The "incidents" table is missing in Supabase.');
      console.warn('Please run the following SQL in your Supabase SQL Editor:');
      console.warn(`
        CREATE TABLE incidents (
          id SERIAL PRIMARY KEY,
          polling_unit TEXT,
          ward TEXT,
          lga TEXT,
          agent_id INT8 REFERENCES users(id),
          description TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          is_quick_alert BOOLEAN DEFAULT FALSE
        );
        ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow authenticated access" ON incidents FOR ALL TO authenticated USING (true);
      `);
      console.warn('-----------------------');
    }

    if (bucketError) {
      console.error('Error listing buckets:', bucketError.message);
    } else {
      const bucketExists = buckets.some(b => b.name === 'election-uploads');
      if (!bucketExists) {
        console.log('Creating "election-uploads" bucket...');
        const { error: createError } = await supabase.storage.createBucket('election-uploads', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        });
        if (createError) {
          console.error('Failed to create bucket:', createError.message);
          console.log('Please create a public bucket named "election-uploads" manually in Supabase dashboard.');
        } else {
          console.log('Bucket "election-uploads" created successfully');
        }
      }
    }
  } catch (err) {
    console.error('Supabase initialization error:', err);
  }
}
testSupabase();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
    }
  });
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('status')
        .eq('id', decoded.id)
        .single();

      if (error || !user || user.status !== 'active') {
        return res.status(403).json({ error: 'Account is blocked or inactive' });
      }

      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Admin Middleware
  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  // Super Admin Middleware
  const isSuperAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  // File Upload Route (Persistent via Supabase Storage)
  app.post('/api/upload', authenticate, upload.single('file'), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('election-uploads')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase Storage upload error:', error);
        // Fallback to local storage if bucket doesn't exist or error occurs (optional, but better to fix bucket)
        return res.status(500).json({ error: 'Failed to upload to persistent storage. Please ensure "election-uploads" bucket exists in Supabase.' });
      }

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('election-uploads')
        .getPublicUrl(filePath);

      res.json({ url: publicUrl });
    } catch (err: any) {
      console.error('Upload route error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Socket.IO Connection
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join_room', (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // --- API Routes ---

  // Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error || !user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.status === 'blocked') {
        return res.status(403).json({ error: 'Your account has been blocked. Contact administrator.' });
      }

      const token = jwt.sign({ 
        id: user.id, 
        role: user.role, 
        name: user.name, 
        polling_unit: user.polling_unit, 
        ward: user.ward, 
        lga: user.lga 
      }, JWT_SECRET, { expiresIn: '24h' });

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          role: user.role, 
          polling_unit: user.polling_unit,
          ward: user.ward,
          lga: user.lga,
          photo_url: user.photo_url
        } 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Current User Status
  app.get('/api/auth/me', authenticate, async (req: any, res: any) => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, role, status')
        .eq('id', req.user.id)
        .single();

      if (error || !user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Contestants
  app.get('/api/contestants', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('contestants')
        .select('*');
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get All Users (Public/Dashboard)
  app.get('/api/users', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, phone, polling_unit, ward, lga, photo_url, status');
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Dashboard Stats
  app.get('/api/stats', async (req, res) => {
    try {
      const statsPromise = Promise.all([
        supabase.from('polling_units').select('*', { count: 'exact', head: true }),
        supabase.from('results').select('polling_unit, ward, lga'),
        supabase.from('results').select('agent_id'),
        supabase.from('accreditations').select('total_accredited, invalid_votes, total_active_voters, total_votes_cast'),
        supabase.from('results').select('votes').eq('status', 'approved'),
        supabase.from('polling_units').select('total_registered'),
        supabase.from('polling_units').select('ward, lga'),
        supabase.from('results').select('ward, lga'),
        supabase.from('contestants').select('*')
      ]);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 10000)
      );

      const [
        { count: totalPu },
        { data: reportedPuData },
        { data: reportedAgentsData },
        { data: accTotals },
        { data: validVotes },
        { data: regVoters },
        { data: puLocationData },
        { data: reportedLocationData },
        { data: contestants }
      ] = await Promise.race([statsPromise, timeoutPromise]) as any;

      // Process reported PUs
      const reportedPUs = new Set();
      reportedPuData?.forEach(r => reportedPUs.add(`${r.polling_unit}|${r.ward}|${r.lga}`));
      
      // Process reported agents
      const reportedAgents = new Set(reportedAgentsData?.map(r => r.agent_id));

      // Process totals
      const totalAccredited = accTotals?.reduce((sum, r) => sum + (r.total_accredited || 0), 0) || 0;
      const totalVotes = validVotes?.reduce((sum, r) => sum + (r.votes || 0), 0) || 0;
      const totalInvalid = accTotals?.reduce((sum, r) => sum + (r.invalid_votes || 0), 0) || 0;
      const totalRegistered = regVoters?.reduce((sum, r) => sum + (Number(r.total_registered) || 0), 0) || 0;
      const totalActiveVoters = accTotals?.reduce((sum, r) => sum + (r.total_active_voters || 0), 0) || 0;
      const totalVotesCast = accTotals?.reduce((sum, r) => sum + (r.total_votes_cast || 0), 0) || 0;

      // LGAs and Wards
      const totalLgas = new Set(puLocationData?.map(r => r.lga)).size;
      const reportedLgas = new Set(reportedLocationData?.map(r => r.lga)).size;
      
      const totalWards = new Set(puLocationData?.map(r => `${r.ward}|${r.lga}`)).size;
      const reportedWards = new Set(reportedLocationData?.map(r => `${r.ward}|${r.lga}`)).size;

      // Candidate votes
      const { data: results } = await supabase.from('results').select('contestant_id, votes').eq('status', 'approved');
      const candidateVotes = contestants?.map(c => ({
        ...c,
        total_votes: results?.filter(r => r.contestant_id === c.id).reduce((sum, r) => sum + (r.votes || 0), 0) || 0
      })).sort((a, b) => b.total_votes - a.total_votes);

      res.json({
        totalPu: totalPu || 0,
        reportedPu: reportedPUs.size,
        reportedAgents: reportedAgents.size,
        totalAccredited,
        totalVotes,
        totalInvalid,
        totalRegistered,
        totalActiveVoters,
        totalVotesCast,
        totalLgas,
        reportedLgas,
        totalWards,
        reportedWards,
        candidateVotes
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get All Evidence (Admin)
  app.get('/api/admin/evidence', authenticate, isAdmin, async (req, res) => {
    try {
      const [
        { data: resEvidence },
        { data: accEvidence }
      ] = await Promise.all([
        supabase.from('results').select('*, contestants(name, party), users(name)').not('evidence_url', 'is', null),
        supabase.from('accreditations').select('*, users(name)').not('evidence_url', 'is', null)
      ]);

      const combined = [
        ...(resEvidence || []).map((e: any) => ({ 
          ...e, 
          type: 'Result Sheet',
          agent_name: e.users?.name,
          candidate: e.contestants?.name,
          party: e.contestants?.party
        })),
        ...(accEvidence || []).map((e: any) => ({ 
          ...e, 
          type: 'Accreditation/Final Sheet',
          agent_name: e.users?.name
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      res.json(combined);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get Detailed Polling Unit Reports (Admin)
  app.get('/api/admin/reports/units', authenticate, isAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('accreditations')
        .select('*, users(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const reports = data.map((r: any) => ({
        ...r,
        agent_name: r.users?.name,
        reported_at: r.created_at
      }));
      
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/reports/unit-details/:pu/:ward/:lga', authenticate, isAdmin, async (req: any, res: any) => {
    const { pu, ward, lga } = req.params;
    try {
      const { data, error } = await supabase
        .from('results')
        .select('*, contestants(name, party)')
        .eq('polling_unit', pu)
        .eq('ward', ward)
        .eq('lga', lga)
        .eq('status', 'approved');
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Detailed Unit Stats
  app.get('/api/units/stats', async (req, res) => {
    try {
      const statsPromise = Promise.all([
        supabase.from('polling_units').select('*'),
        supabase.from('accreditations').select('*'),
        supabase.from('results').select('*').eq('status', 'approved'),
        supabase.from('users').select('name, polling_unit, ward, lga').eq('role', 'agent')
      ]);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 10000)
      );

      const [
        { data: puData },
        { data: accData },
        { data: resData },
        { data: userData }
      ] = await Promise.race([statsPromise, timeoutPromise]) as any;

      const unitMap = new Map();

      puData?.forEach(pu => {
        const key = `${pu.name}|${pu.ward}|${pu.lga}`.trim();
        unitMap.set(key, {
          name: pu.name,
          ward: pu.ward,
          lga: pu.lga,
          total_registered: pu.total_registered || 0,
          agent_name: userData?.find(u => u.polling_unit === pu.name && u.ward === pu.ward && u.lga === pu.lga)?.name || null,
          accredited: 0,
          active_voters: 0,
          votes_cast: 0,
          invalid: 0,
          valid: 0,
          evidence_url: null,
          reported: 0
        });
      });

      accData?.forEach(acc => {
        const key = `${acc.polling_unit}|${acc.ward}|${acc.lga}`.trim();
        if (!unitMap.has(key)) {
          unitMap.set(key, {
            name: acc.polling_unit,
            ward: acc.ward,
            lga: acc.lga,
            total_registered: 0,
            agent_name: userData?.find(u => u.polling_unit === acc.polling_unit && u.ward === acc.ward && u.lga === acc.lga)?.name || null,
            accredited: 0,
            active_voters: 0,
            votes_cast: 0,
            invalid: 0,
            valid: 0,
            evidence_url: null,
            reported: 1
          });
        }
        const unit = unitMap.get(key);
        unit.accredited += acc.total_accredited || 0;
        unit.active_voters += acc.total_active_voters || 0;
        unit.votes_cast += acc.total_votes_cast || 0;
        unit.invalid += acc.invalid_votes || 0;
        unit.evidence_url = acc.evidence_url || unit.evidence_url;
        unit.reported = 1;
      });

      resData?.forEach(r => {
        const key = `${r.polling_unit}|${r.ward}|${r.lga}`.trim();
        if (!unitMap.has(key)) {
          unitMap.set(key, {
            name: r.polling_unit,
            ward: r.ward,
            lga: r.lga,
            total_registered: 0,
            agent_name: userData?.find(u => u.polling_unit === r.polling_unit && u.ward === r.ward && u.lga === r.lga)?.name || null,
            accredited: 0,
            active_voters: 0,
            votes_cast: 0,
            invalid: 0,
            valid: 0,
            evidence_url: null,
            reported: 1
          });
        }
        const unit = unitMap.get(key);
        unit.valid += r.votes || 0;
        unit.reported = 1;
      });

      const units = Array.from(unitMap.values()).sort((a, b) => {
        if (a.lga !== b.lga) return a.lga.localeCompare(b.lga);
        if (a.ward !== b.ward) return a.ward.localeCompare(b.ward);
        return a.name.localeCompare(b.name);
      });

      res.json(units);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Admin API ---

  app.get('/api/admin/units', authenticate, isAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('polling_units')
        .select('*')
        .order('lga', { ascending: true })
        .order('ward', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/units', authenticate, isAdmin, async (req, res) => {
    const { name, ward, lga, total_registered } = req.body;
    try {
      const { error } = await supabase
        .from('polling_units')
        .insert([{ name, ward, lga, total_registered: Number(total_registered) }]);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/units/bulk', authenticate, isAdmin, async (req, res) => {
    const { units } = req.body;
    try {
      const { error } = await supabase
        .from('polling_units')
        .insert(units.map((u: any) => ({ ...u, total_registered: Number(u.total_registered) })));
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/units/:id', authenticate, isAdmin, async (req, res) => {
    const { name, ward, lga, total_registered } = req.body;
    try {
      const { error } = await supabase
        .from('polling_units')
        .update({ name, ward, lga, total_registered: Number(total_registered) })
        .eq('id', req.params.id);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/units/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const { error } = await supabase
        .from('polling_units')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, phone, polling_unit, ward, lga, photo_url, status');
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/users', authenticate, isSuperAdmin, async (req, res) => {
    const { name, email, password, role, phone, polling_unit, ward, lga, photo_url } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    try {
      const { error } = await supabase
        .from('users')
        .insert([{ name, email, password: hash, role, phone, polling_unit, ward, lga, photo_url }]);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/users/:id', authenticate, isSuperAdmin, async (req, res) => {
    const { name, email, password, role, phone, polling_unit, ward, lga, photo_url } = req.body;
    const updateData: any = { name, email, role, phone, polling_unit, ward, lga, photo_url };
    if (password) updateData.password = bcrypt.hashSync(password, 10);
    
    try {
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/users/:id/status', authenticate, isSuperAdmin, async (req, res) => {
    const { status } = req.body;
    try {
      const { error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/users/:id', authenticate, isSuperAdmin, async (req, res) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Broadcast Message (Admin)
  app.post('/api/admin/broadcast', authenticate, isAdmin, async (req, res) => {
    const { message, target_user_id, target_user_ids } = req.body;
    
    try {
      if (target_user_ids && Array.isArray(target_user_ids)) {
        // Bulk broadcast to specific agents
        const inserts = target_user_ids.map(id => ({
          message,
          target_user_id: Number(id)
        }));
        
        const { error } = await supabase.from('broadcasts').insert(inserts);
        if (error) throw error;

        target_user_ids.forEach(id => {
          io.to(`user_${id}`).emit('broadcast_alert', { message });
        });
      } else {
        // Single or All broadcast
        const finalTargetId = (target_user_id === null || target_user_id === undefined || target_user_id === 'all') ? null : Number(target_user_id);
        
        const { error } = await supabase.from('broadcasts').insert([{ message, target_user_id: finalTargetId }]);
        if (error) throw error;

        if (finalTargetId !== null) {
          io.to(`user_${finalTargetId}`).emit('broadcast_alert', { message });
        } else {
          io.emit('broadcast_alert', { message });
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/contestants', authenticate, isAdmin, async (req, res) => {
    const { name, party, party_logo, candidate_picture } = req.body;
    try {
      const { error } = await supabase
        .from('contestants')
        .insert([{ name, party, party_logo, candidate_picture }]);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/contestants/:id', authenticate, isAdmin, async (req, res) => {
    const { name, party, party_logo, candidate_picture } = req.body;
    try {
      const { error } = await supabase
        .from('contestants')
        .update({ name, party, party_logo, candidate_picture })
        .eq('id', req.params.id);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/contestants/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const { error } = await supabase
        .from('contestants')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Agent API ---

  app.get('/api/agent/submissions', authenticate, async (req: any, res: any) => {
    try {
      const [
        { data: results },
        { data: accreditations }
      ] = await Promise.all([
        supabase.from('results').select('*').eq('agent_id', req.user.id),
        supabase.from('accreditations').select('*').eq('agent_id', req.user.id)
      ]);
      res.json({ results, accreditations });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Broadcasts for Agent
  app.get('/api/agent/broadcasts', authenticate, async (req: any, res: any) => {
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .or(`target_user_id.is.null,target_user_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/results', authenticate, async (req: any, res: any) => {
    const { contestant_id, votes, evidence_url } = req.body;
    try {
      const { data: agent } = await supabase
        .from('users')
        .select('polling_unit, ward, lga, photo_url')
        .eq('id', req.user.id)
        .single();

      const { error } = await supabase
        .from('results')
        .insert([{ 
          polling_unit: agent.polling_unit, 
          ward: agent.ward, 
          lga: agent.lga, 
          contestant_id, 
          votes, 
          agent_id: req.user.id,
          status: 'pending',
          evidence_url
        }]);
      if (error) throw error;
      io.emit('new_result_pending', {
        polling_unit: agent.polling_unit,
        agent_name: req.user.name,
        agent_photo: agent.photo_url,
        ward: agent.ward
      });
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/results/pending', authenticate, async (req: any, res: any) => {
    try {
      const { data, error } = await supabase
        .from('results')
        .select('*, contestants(name, party), users(name)')
        .eq('status', 'pending');
      if (error) throw error;
      
      const mapped = (data || []).map((r: any) => ({
        ...r,
        candidate_name: r.contestants?.name,
        party: r.contestants?.party,
        agent_name: r.users?.name
      }));
      
      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/results/:id/status', authenticate, isAdmin, async (req, res) => {
    const { status } = req.body;
    try {
      const { error } = await supabase
        .from('results')
        .update({ status })
        .eq('id', req.params.id);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/accreditations', authenticate, async (req: any, res: any) => {
    const { total_accredited, total_active_voters, total_votes_cast, invalid_votes, evidence_url } = req.body;
    try {
      const { data: agent } = await supabase
        .from('users')
        .select('polling_unit, ward, lga')
        .eq('id', req.user.id)
        .single();

      const { error } = await supabase
        .from('accreditations')
        .insert([{ 
          polling_unit: agent.polling_unit, 
          ward: agent.ward, 
          lga: agent.lga, 
          total_accredited, 
          total_active_voters, 
          total_votes_cast, 
          invalid_votes, 
          agent_id: req.user.id,
          evidence_url
        }]);
      if (error) throw error;
      io.emit('stats_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Incident Reporting ---
  app.post('/api/incidents', authenticate, async (req: any, res: any) => {
    const { description, is_quick_alert } = req.body;
    try {
      const { data: agent } = await supabase
        .from('users')
        .select('polling_unit, ward, lga, photo_url')
        .eq('id', req.user.id)
        .single();

      const { error } = await supabase
        .from('incidents')
        .insert([{ 
          polling_unit: agent.polling_unit, 
          ward: agent.ward, 
          lga: agent.lga, 
          agent_id: req.user.id,
          description,
          is_quick_alert: !!is_quick_alert,
          status: 'pending'
        }]);
      if (error) throw error;
      
      io.emit('incident_alert', {
        polling_unit: agent.polling_unit,
        ward: agent.ward,
        agent_name: req.user.name,
        agent_photo: agent.photo_url,
        description,
        is_quick_alert: !!is_quick_alert
      });
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/incidents', authenticate, isAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, users(name, photo_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const mapped = (data || []).map((i: any) => ({
        ...i,
        agent_name: i.users?.name,
        agent_photo: i.users?.photo_url
      }));

      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/incidents/:id/status', authenticate, isAdmin, async (req: any, res: any) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const { error } = await supabase
        .from('incidents')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      
      io.emit('incident_updated');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
