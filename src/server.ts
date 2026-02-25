// src/server.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config, validateConfig } from './config';
import { authRouter } from './routes/auth';
import { filesRouter } from './routes/files';
import { botRouter } from './routes/bot';
import { initBot } from './telegram/bot';

validateConfig();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/bot', botRouter);

// SPA fallback
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const startServer = async () => {
  try {
    await initBot();
    console.log('✅ Telegram Bot initialized with webhook');

    app.listen(config.server.port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${config.server.port}`);
      console.log(`🌐 Public URL: ${config.server.publicUrl}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();