import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, Play } from 'lucide-react';
import { humanSize, type MediaKind } from '@/lib/messageMedia';

interface Props {
  url: string;
  type: MediaKind;
  name?: string | null;
  size?: number | null;
  mime?: string | null;
  isOwn: boolean;
}

export function MessageMedia({ url, type, name, size, mime, isOwn }: Props) {
  const [open, setOpen] = useState(false);

  if (type === 'image') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block overflow-hidden rounded-lg max-w-[260px] sm:max-w-[320px]"
        >
          <img
            src={url}
            alt={name || 'Shared image attachment'}
            className="w-full h-auto max-h-[360px] object-cover"
            loading="lazy"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl p-2 bg-background">
            <img src={url} alt={name || 'Shared image attachment'} className="w-full h-auto max-h-[85vh] object-contain rounded" />
            <div className="flex justify-end pt-2">
              <a href={url} download={name || 'image'} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-2" />Download</Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (type === 'video') {
    return (
      <video
        src={url}
        controls
        className="rounded-lg max-w-[260px] sm:max-w-[320px] max-h-[360px] bg-black"
      />
    );
  }

  if (type === 'audio') {
    return <audio src={url} controls className="max-w-[260px] sm:max-w-[320px]" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={name || 'file'}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 max-w-[280px] ${
        isOwn ? 'bg-primary-foreground/10' : 'bg-background/60'
      }`}
    >
      <div className="h-10 w-10 rounded bg-background/40 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{name || 'File'}</p>
        <p className="text-xs opacity-70">{size ? humanSize(size) : mime || ''}</p>
      </div>
      <Download className="h-4 w-4 opacity-70 shrink-0" />
    </a>
  );
}

export function MediaPreviewChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const kind = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
    ? 'video'
    : file.type.startsWith('audio/')
    ? 'audio'
    : 'file';
  const url = URL.createObjectURL(file);

  return (
    <div className="flex items-center gap-3 p-2 border border-border rounded-lg bg-muted/40">
      {kind === 'image' ? (
        <img src={url} alt={file.name || 'Image attachment preview'} className="h-12 w-12 rounded object-cover" />
      ) : kind === 'video' ? (
        <div className="h-12 w-12 rounded bg-black flex items-center justify-center">
          <Play className="h-5 w-5 text-white" />
        </div>
      ) : (
        <div className="h-12 w-12 rounded bg-background flex items-center justify-center">
          <FileText className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">{humanSize(file.size)}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
