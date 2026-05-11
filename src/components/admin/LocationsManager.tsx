import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Location {
  id: string;
  zone: string;
  name: string;
  is_active: boolean;
  display_order: number;
  latitude: number | null;
  longitude: number | null;
}

const LocationsManager = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<{
    zone: string; name: string; display_order: number; is_active: boolean;
    latitude: string; longitude: string;
  }>({ zone: '', name: '', display_order: 0, is_active: true, latitude: '', longitude: '' });

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('zone', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) toast.error(error.message);
    setLocations((data as Location[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ zone: '', name: '', display_order: 0, is_active: true });
    setOpen(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setForm({ zone: loc.zone, name: loc.name, display_order: loc.display_order, is_active: loc.is_active });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.zone.trim() || !form.name.trim()) {
      toast.error('Zone and name are required');
      return;
    }
    const payload = {
      zone: form.zone.trim(),
      name: form.name.trim(),
      display_order: form.display_order || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from('locations').update(payload).eq('id', editing.id)
      : await supabase.from('locations').insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? 'Location updated' : 'Location added');
    setOpen(false);
    fetchLocations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Location removed');
    fetchLocations();
  };

  // Group by zone
  const grouped = locations.reduce<Record<string, Location[]>>((acc, l) => {
    (acc[l.zone] = acc[l.zone] || []).push(l);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Delivery Locations
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Location' : 'Add Location'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Zone</Label>
                <Input
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  placeholder="e.g. Accra Central"
                />
              </div>
              <div>
                <Label>Location Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Osu"
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>{editing ? 'Save' : 'Add'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground">No locations yet. Add one to get started.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([zone, items]) => (
              <div key={zone}>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  {zone}
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {items.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between border rounded-md p-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm truncate">{loc.name}</span>
                        {!loc.is_active && (
                          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(loc)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(loc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationsManager;
