// src/telegram/fileManager.ts
import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { Readable } from 'stream';

export interface TelegramFile {
  id: string;
  messageId: number;
  type: 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'animation' | 'sticker' | 'video_note' | 'other';
  fileName: string;
  fileSize: number;
  mimeType: string;
  date: number;
  thumbnail?: boolean;
  caption?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export async function getFilesFromBot(
  client: TelegramClient,
  botUsername: string,
  limit: number = 50,
  offsetId: number = 0,
  mediaOnly: boolean = false
): Promise<{ files: TelegramFile[]; total: number; nextOffsetId: number }> {
  const entity = await client.getEntity(botUsername);
  const files: TelegramFile[] = [];

  const filter = mediaOnly
    ? new Api.InputMessagesFilterDocument()
    : undefined;

  const messages = await client.getMessages(entity, {
    limit,
    offsetId,
    filter,
  });

  for (const msg of messages) {
    const file = extractFileFromMessage(msg);
    if (file) {
      files.push(file);
    }
  }

  const nextOffset = messages.length > 0
    ? messages[messages.length - 1].id
    : 0;

  return {
    files,
    total: messages.total || files.length,
    nextOffsetId: nextOffset,
  };
}

export async function searchFiles(
  client: TelegramClient,
  botUsername: string,
  query: string,
  limit: number = 50
): Promise<TelegramFile[]> {
  const entity = await client.getEntity(botUsername);
  const files: TelegramFile[] = [];

  const messages = await client.getMessages(entity, {
    limit,
    search: query,
  });

  for (const msg of messages) {
    const file = extractFileFromMessage(msg);
    if (file) {
      files.push(file);
    }
  }

  return files;
}

function extractFileFromMessage(msg: any): TelegramFile | null {
  if (!msg.media) return null;

  let type: TelegramFile['type'] = 'other';
  let fileName = '';
  let fileSize = 0;
  let mimeType = '';
  let duration: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let thumbnail = false;

  if (msg.media instanceof Api.MessageMediaDocument && msg.media.document) {
    const doc = msg.media.document as Api.Document;
    fileSize = Number(doc.size);
    mimeType = doc.mimeType;

    for (const attr of doc.attributes) {
      if (attr instanceof Api.DocumentAttributeFilename) {
        fileName = attr.fileName;
      }
      if (attr instanceof Api.DocumentAttributeVideo) {
        type = attr.roundMessage ? 'video_note' : 'video';
        duration = attr.duration;
        width = attr.w;
        height = attr.h;
      }
      if (attr instanceof Api.DocumentAttributeAudio) {
        type = attr.voice ? 'voice' : 'audio';
        duration = attr.duration;
        if (attr.title) fileName = attr.title;
      }
      if (attr instanceof Api.DocumentAttributeAnimated) {
        type = 'animation';
      }
      if (attr instanceof Api.DocumentAttributeSticker) {
        type = 'sticker';
      }
    }

    if (type === 'other') type = 'document';
    if (!fileName) fileName = `file_${msg.id}.${getExtension(mimeType)}`;
    thumbnail = doc.thumbs !== undefined && doc.thumbs.length > 0;

  } else if (msg.media instanceof Api.MessageMediaPhoto && msg.media.photo) {
    type = 'photo';
    const photo = msg.media.photo as Api.Photo;
    fileName = `photo_${msg.id}.jpg`;
    mimeType = 'image/jpeg';
    thumbnail = true;

    if (photo.sizes && photo.sizes.length > 0) {
      const largest = photo.sizes[photo.sizes.length - 1];
      if ('w' in largest) width = (largest as any).w;
      if ('h' in largest) height = (largest as any).h;
      if ('size' in largest) fileSize = (largest as any).size;
      else {
        fileSize = (largest as any).sizes
          ? (largest as any).sizes.reduce((a: number, b: number) => a + b, 0)
          : 0;
      }
    }
  } else {
    return null;
  }

  return {
    id: `${msg.id}`,
    messageId: msg.id,
    type,
    fileName,
    fileSize,
    mimeType,
    date: msg.date,
    thumbnail,
    caption: msg.message || undefined,
    duration,
    width,
    height,
  };
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'video/mp4': 'mp4',
    'video/x-matroska': 'mkv',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  return map[mimeType] || 'bin';
}

export async function downloadFileStream(
  client: TelegramClient,
  botUsername: string,
  messageId: number
): Promise<{ stream: AsyncIterable<Buffer>; fileName: string; mimeType: string; fileSize: number }> {
  const entity = await client.getEntity(botUsername);
  const messages = await client.getMessages(entity, {
    ids: [messageId],
  });

  if (!messages || messages.length === 0) {
    throw new Error('Message not found');
  }

  const msg = messages[0];
  const fileInfo = extractFileFromMessage(msg);

  if (!fileInfo) {
    throw new Error('No file in this message');
  }

  const iterDownload = client.iterDownload({
    file: msg.media as any,
    requestSize: 512 * 1024, // 512KB chunks
  });

  return {
    stream: iterDownload,
    fileName: fileInfo.fileName,
    mimeType: fileInfo.mimeType,
    fileSize: fileInfo.fileSize,
  };
}

export async function downloadThumbnail(
  client: TelegramClient,
  botUsername: string,
  messageId: number
): Promise<Buffer | null> {
  const entity = await client.getEntity(botUsername);
  const messages = await client.getMessages(entity, {
    ids: [messageId],
  });

  if (!messages || messages.length === 0) return null;

  const msg = messages[0];
  if (!msg.media) return null;

  try {
    const thumb = await client.downloadMedia(msg.media as any, {
      thumb: 0,
    });
    return thumb as Buffer;
  } catch {
    return null;
  }
}

export async function deleteFile(
  client: TelegramClient,
  botUsername: string,
  messageId: number
): Promise<boolean> {
  try {
    const entity = await client.getEntity(botUsername);
    await client.deleteMessages(entity, [messageId], {
      revoke: true,
    });
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}