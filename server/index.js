import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware, requireAuth, getAuth, clerkClient } from '@clerk/express';
import { requireAuthApi } from './middleware/requireAuthApi.js';
import { syncUser } from './middleware/syncUser.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// Health check route
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', message: 'brAIniac server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Personal info check (protected route)
app.get('/api/v1/me', requireAuthApi, syncUser, (req, res) => {
  res.json(req.dbUser);
});