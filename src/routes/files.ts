// src/routes/auth.ts
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { sendCode, signIn, disconnectClient } from '../telegram/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getBotInfo } from '../telegram/bot';

export const authRouter = Router();

// Step 1: Send code
authRouter.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const result = await sendCode(phone);

    res.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      sessionString: result.sessionString,
    });
  } catch (error: any) {
    console.error('Send code error:', error);
    res.status(400).json({
      error: error.errorMessage || error.message || 'Failed to send code',
    });
  }
});

// Step 2: Verify code
authRouter.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { phone, code, phoneCodeHash, sessionString, password } = req.body;

    if (!phone || !code || !phoneCodeHash || !sessionString) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await signIn(phone, code, phoneCodeHash, sessionString, password);

    const token = jwt.sign(
      {
        userId: result.user.id,
        phone: result.user.phone,
        session: result.session,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: result.user,
      token,
    });
  } catch (error: any) {
    if (error.code === 'PASSWORD_REQUIRED') {
      return res.status(200).json({
        success: false,
        passwordRequired: true,
        message: '2FA password is required',
      });
    }
    console.error('Verify code error:', error);
    res.status(400).json({
      error: error.errorMessage || error.message || 'Verification failed',
    });
  }
});

// Get current user info
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const botInfo = getBotInfo();
    res.json({
      success: true,
      user: {
        userId: req.user!.userId,
        phone: req.user!.phone,
      },
      bot: botInfo,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
authRouter.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await disconnectClient(req.user!.session);
    res.clearCookie('token');
    res.json({ success: true });
  } catch (error: any) {
    res.clearCookie('token');
    res.json({ success: true });
  }
});