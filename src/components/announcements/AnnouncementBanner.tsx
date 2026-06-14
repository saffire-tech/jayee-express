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
    <>
      {/* Fixed banner sitting flush below the navbar */}
      <div
        role="status"
        className="fixed left-0 right-0 top-14 md:top-16 z-40 bg-primary text-primary-foreground shadow-sm"
      >
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-start gap-3">
            <Megaphone className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="flex-1 min-w-0 text-sm leading-snug whitespace-normal break-words">
              {announcement.message}
            </p>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss announcement"
              className="h-6 w-6 shrink-0 -mr-1 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                setDismissed(prev => new Set(prev).add(announcement.id));
                setAnnouncement(null);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {/* Spacer so fixed banner doesn't overlap page content */}
      <div aria-hidden className="w-full invisible">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-start gap-3">
            <Megaphone className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="flex-1 min-w-0 text-sm leading-snug whitespace-normal break-words">
              {announcement.message}
            </p>
            <div className="h-6 w-6 shrink-0" />
          </div>
        </div>
      </div>
    </>
  );
};

export default AnnouncementBanner;
