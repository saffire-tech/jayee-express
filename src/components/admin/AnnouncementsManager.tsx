import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Megaphone, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AnnouncementsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [hours, setHours] = useState('24');
  const [creating, setCreating] = useState(false);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createAnnouncement = async () => {
    if (!message.trim() || !user) return;
    setCreating(true);
    try {
      const expiresAt = new Date(Date.now() + parseInt(hours) * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('announcements').insert({
        message: message.trim(),
        expires_at: expiresAt,
        created_by: user.id,
      });
      if (error) throw error;
      setMessage('');
      toast.success('Announcement created!');
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    } catch {
      toast.error('Failed to create announcement');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !isActive })
      .eq('id', id);
    if (!error) queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement deleted');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Create Announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter announcement message..."
              className="mt-1"
              rows={2}
            />
          </div>
          <div>
            <Label>Duration (hours)</Label>
            <Input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              min="1"
              max="720"
              className="mt-1 w-32"
            />
          </div>
          <Button onClick={createAnnouncement} disabled={creating || !message.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Post Announcement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !announcements?.length ? (
            <p className="text-muted-foreground text-center py-6">No announcements yet</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a: any) => {
                const isExpired = new Date(a.expires_at) < new Date();
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          Expires: {format(new Date(a.expires_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        {isExpired ? (
                          <Badge variant="secondary" className="text-xs">Expired</Badge>
                        ) : a.is_active ? (
                          <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={a.is_active}
                        onCheckedChange={() => toggleActive(a.id, a.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteAnnouncement(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnouncementsManager;
