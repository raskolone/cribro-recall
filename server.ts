import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Wait, I need VITE_FIREBASE_CONFIG for the project ID.
// Wait, process.env is available here but VITE_ variables are loaded by Vite.
// However `dot-env` or manually parsing process.env.VITE_FIREBASE_CONFIG.
// For now, I'll export an async function startServer()

// We can just rely on process.env.FIREBASE_SERVICE_ACCOUNT and initialize Firebase Admin
function getAdminApp() {
  if (getApps().length > 0) return getApp();
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      const parsed = JSON.parse(serviceAccountStr);
      return initializeApp({ credential: cert(parsed) });
    } catch {
      console.warn('[Firebase Admin] Failed to parse service account');
    }
  }
  return initializeApp(); // App Default Credentials
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  const adminApp = getAdminApp();
  const adminAuth = getAuth(adminApp);

  // Authentication Middleware
  async function requireFirebaseAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }
    
    const idToken = authHeader.slice(7);
    try {
      // Very simple admin check: decode token using Admin SDK (easier than manually parsing with JWKS here)
      // Actually, if we use Admin SDK, we don't strictly *need* JWKS, adminAuth.verifyIdToken does exactly that securely.
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      
      // Admin emails
      const ADMIN_EMAILS = ['maciej.wyrozumski@gmail.com'];
      
      if (!decodedToken.email || !ADMIN_EMAILS.includes(decodedToken.email)) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }
      
      (req as any).adminUid = decodedToken.uid;
      next();
    } catch (err) {
      console.error(err);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Admin API Endpoints
  app.get('/api/firebase-admin/users', requireFirebaseAdmin, async (req, res) => {
    try {
      const listUsersResult = await adminAuth.listUsers(1000);
      res.json(listUsersResult.users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/firebase-admin/users', requireFirebaseAdmin, async (req, res) => {
    try {
      const { email, password, role } = req.body;
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email,
          password,
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          userRecord = await adminAuth.getUserByEmail(email);
          await adminAuth.updateUser(userRecord.uid, { password });
        } else {
          throw authError;
        }
      }
      
      // Optionally set custom claims for role here
      if (role) {
        await adminAuth.setCustomUserClaims(userRecord.uid, { role });
      }
      res.json(userRecord);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/firebase-admin/users/:uid', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      await adminAuth.deleteUser(uid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/firebase-admin/users/:uid/password', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { password } = req.body;
      await adminAuth.updateUser(uid, { password });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/firebase-admin/users/:uid/role', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { role } = req.body;
      await adminAuth.setCustomUserClaims(uid, { role });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Gemini API if we ever want to move Gemini to server-side
  // Right now, keeping what's there on Vite fallback for now.

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
