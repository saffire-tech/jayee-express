import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';

export type MediaKind = 'image' | 'video' | 'audio' | 'file';

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB

export function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface UploadedMedia {
  media_url: string;
  media_type: MediaKind;
  media_name: string;
  media_size: number;
  media_mime: string;
}

export async function uploadMessageMedia(
  file: File,
  userId: string,
  onProgress?: (pct: number) => void
): Promise<UploadedMedia> {
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error('File too large (max 25 MB)');
  }

  const kind = kindFromMime(file.type || 'application/octet-stream');
  let blob: Blob = file;
  let ext = file.name.includes('.') ? file.name.split('.').pop()! : 'bin';
  let mime = file.type || 'application/octet-stream';

  if (kind === 'image') {
    try {
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
      blob = compressed.blob;
      ext = compressed.extension;
      mime = compressed.blob.type || `image/${ext}`;
    } catch {
      // fall back to original
    }
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${userId}/${filename}`;

  onProgress?.(0);

  // Try XHR upload for real progress events; fall back to supabase-js on failure.
  const uploadedViaXhr = await xhrUpload(path, blob, mime, onProgress).catch(() => false);

  if (!uploadedViaXhr) {
    const { error } = await supabase.storage
      .from('message-media')
      .upload(path, blob, { contentType: mime, upsert: false });
    if (error) throw error;
    onProgress?.(100);
  }

  return {
    media_url: path,
    media_type: kind,
    media_name: file.name,
    media_size: blob.size,
    media_mime: mime,
  };
}

async function xhrUpload(
  path: string,
  blob: Blob,
  mime: string,
  onProgress?: (pct: number) => void
): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = (supabase as any).storage?.url
    ? `${(supabase as any).storage.url}/object/message-media/${path}`
    : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/message-media/${path}`;
  if (!token) return false;

  return new Promise<boolean>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=3600');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(true);
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(blob);
  });
}

const signedCache = new Map<string, { url: string; expires: number }>();

export async function getSignedMediaUrl(path: string): Promise<string | null> {
  const cached = signedCache.get(path);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from('message-media')
    .createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  signedCache.set(path, { url: data.signedUrl, expires: Date.now() + 60 * 60 * 1000 });
  return data.signedUrl;
}

export async function signMany(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths));
  const entries = await Promise.all(
    unique.map(async (p) => [p, await getSignedMediaUrl(p)] as const)
  );
  const out: Record<string, string> = {};
  for (const [p, u] of entries) if (u) out[p] = u;
  return out;
}
