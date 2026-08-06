import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';
import { requireAuthApi } from './middleware/requireAuthApi.js';
import { syncUser } from './middleware/syncUser.js';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());
app.use('/api/v1', routes);

// Health check route
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', message: 'brAIniac server is running' });
});

// Personal info check (protected route)
app.get('/api/v1/me', requireAuthApi, syncUser, (req, res) => {
  res.json(req.dbUser);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});