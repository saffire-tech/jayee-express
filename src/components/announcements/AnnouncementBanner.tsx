import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: string;
  message: string;
  expires_at: string;
}

const AnnouncementBanner = () => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchAnnouncement = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, message, expires_at')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data && !dismissed.has(data.id)) {
      setAnnouncement(data);
    } else {
      setAnnouncement(null);
    }
  };

  useEffect(() => {
    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 30000);
    
    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncement())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [dismissed]);

  if (!announcement) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2.5 text-center text-sm relative flex items-center justify-center gap-2">
      <Megaphone className="h-4 w-4 shrink-0" />
      <span className="line-clamp-1">{announcement.message}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 absolute right-2 top-1/2 -translate-y-1/2 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
        onClick={() => {
          setDismissed(prev => new Set(prev).add(announcement.id));
          setAnnouncement(null);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default AnnouncementBanner;
