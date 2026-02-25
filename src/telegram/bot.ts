// src/telegram/bot.ts
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import { config } from '../config';

let botClient: TelegramClient | null = null;
let botInfo: any = null;

export async function initBot(): Promise<void> {
  botClient = new TelegramClient(
    new StringSession(''),
    config.telegram.apiId,
    config.telegram.apiHash,
    {
      connectionRetries: 5,
    }
  );

  await botClient.start({
    botAuthToken: config.telegram.botToken,
  });

  const me = await botClient.getMe();
  botInfo = {
    id: (me as any).id.toString(),
    username: (me as any).username,
    firstName: (me as any).firstName,
  };

  console.log(`🤖 Bot connected: @${botInfo.username}`);

  // Set webhook
  const webhookUrl = `${config.server.publicUrl}/api/bot/webhook`;
  try {
    await botClient.invoke(
      new Api.bots.SetBotCommands({
        scope: new Api.BotCommandScopeDefault(),
        langCode: '',
        commands: [
          new Api.BotCommand({ command: 'start', description: 'Start the bot' }),
          new Api.BotCommand({ command: 'help', description: 'Show help' }),
          new Api.BotCommand({ command: 'files', description: 'List your files' }),
        ],
      })
    );
    console.log(`🔗 Bot commands set successfully`);
  } catch (e) {
    console.warn('⚠️  Could not set bot commands:', e);
  }
}

export function getBotInfo() {
  return botInfo;
}

export function getBotClient(): TelegramClient | null {
  return botClient;
}

export async function handleBotMessage(message: any): Promise<void> {
  if (!botClient) return;

  const chatId = message.chat.id;
  const text = message.text || '';

  if (text === '/start') {
    await sendBotMessage(chatId,
      '👋 Welcome to Telegram File Manager!\n\n' +
      '📁 Send me any file, photo, video, or document.\n' +
      '🌐 Then manage them via the web dashboard.\n\n' +
      'Just forward or upload files here!'
    );
  } else if (text === '/help') {
    await sendBotMessage(chatId,
      '📖 **Help**\n\n' +
      '• Send any file to store it\n' +
      '• Forward messages with files\n' +
      '• Use /files to see count\n' +
      '• Visit web dashboard to manage'
    );
  } else if (text === '/files') {
    await sendBotMessage(chatId,
      '📊 Your files are accessible via the web dashboard.\n' +
      `🌐 ${config.server.publicUrl}`
    );
  } else if (!text.startsWith('/')) {
    // If it's a file/media, acknowledge
    if (message.document || message.photo || message.video || message.audio || message.voice) {
      await sendBotMessage(chatId, '✅ File received and stored! Access it via web dashboard.');
    }
  }
}

async function sendBotMessage(chatId: number, text: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
        }),
      }
    );
    if (!response.ok) {
      console.error('Failed to send message:', await response.text());
    }
  } catch (e) {
    console.error('Error sending bot message:', e);
  }
}