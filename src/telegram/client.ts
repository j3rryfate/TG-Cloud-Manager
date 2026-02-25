// src/telegram/client.ts
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import { config } from '../config';

// Store active user sessions in memory
const activeSessions: Map<string, TelegramClient> = new Map();

export async function createClient(sessionString: string = ''): Promise<TelegramClient> {
  const session = new StringSession(sessionString);
  const client = new TelegramClient(
    session,
    config.telegram.apiId,
    config.telegram.apiHash,
    {
      connectionRetries: 5,
      deviceModel: 'Telegram File Manager',
      systemVersion: 'Web 1.0',
      appVersion: '1.0.0',
    }
  );
  return client;
}

export async function sendCode(phone: string): Promise<{ phoneCodeHash: string; sessionString: string }> {
  const client = await createClient();
  await client.connect();

  const result = await client.sendCode(
    {
      apiId: config.telegram.apiId,
      apiHash: config.telegram.apiHash,
    },
    phone
  );

  const sessionString = (client.session as StringSession).save();

  // Store client temporarily
  activeSessions.set(phone, client);

  // Auto cleanup after 5 minutes
  setTimeout(() => {
    const c = activeSessions.get(phone);
    if (c) {
      c.disconnect();
      activeSessions.delete(phone);
    }
  }, 5 * 60 * 1000);

  return {
    phoneCodeHash: result.phoneCodeHash,
    sessionString,
  };
}

export async function signIn(
  phone: string,
  code: string,
  phoneCodeHash: string,
  sessionString: string,
  password?: string
): Promise<{ session: string; user: any }> {
  let client = activeSessions.get(phone);

  if (!client) {
    client = await createClient(sessionString);
    await client.connect();
  }

  try {
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash: phoneCodeHash,
        phoneCode: code,
      })
    );

    const savedSession = (client.session as StringSession).save();
    const user = (result as any).user;

    // Cleanup temp session
    activeSessions.delete(phone);

    return {
      session: savedSession,
      user: {
        id: user.id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
      },
    };
  } catch (error: any) {
    if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      if (!password) {
        throw { code: 'PASSWORD_REQUIRED', message: '2FA password is required' };
      }
      const passwordResult = await client.signInWithPassword(
        {
          apiId: config.telegram.apiId,
          apiHash: config.telegram.apiHash,
        },
        {
          password: async () => password,
          onError: (err: any) => { throw err; },
        }
      );

      const savedSession = (client.session as StringSession).save();
      activeSessions.delete(phone);

      return {
        session: savedSession,
        user: {
          id: (passwordResult as any).id?.toString(),
          firstName: (passwordResult as any).firstName,
          lastName: (passwordResult as any).lastName,
          username: (passwordResult as any).username,
          phone: (passwordResult as any).phone,
        },
      };
    }
    throw error;
  }
}

export async function getClientFromSession(sessionString: string): Promise<TelegramClient> {
  const key = sessionString.substring(0, 20);
  let client = activeSessions.get(`session_${key}`);

  if (client && client.connected) {
    return client;
  }

  client = await createClient(sessionString);
  await client.connect();
  activeSessions.set(`session_${key}`, client);

  return client;
}

export async function disconnectClient(sessionString: string): Promise<void> {
  const key = sessionString.substring(0, 20);
  const client = activeSessions.get(`session_${key}`);
  if (client) {
    await client.disconnect();
    activeSessions.delete(`session_${key}`);
  }
}