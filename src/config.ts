// src/config.ts
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    botToken: process.env.BOT_TOKEN || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-key',
    expiresIn: '7d',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`,
  },
};

export function validateConfig(): void {
  const errors: string[] = [];
  if (!config.telegram.apiId) errors.push('TELEGRAM_API_ID is required');
  if (!config.telegram.apiHash) errors.push('TELEGRAM_API_HASH is required');
  if (!config.telegram.botToken) errors.push('BOT_TOKEN is required');
  if (config.jwt.secret === 'change-this-secret-key') {
    console.warn('⚠️  WARNING: Using default JWT secret. Set JWT_SECRET in production!');
  }
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
}