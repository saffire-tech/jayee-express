import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileCard, MobileCardRow } from '@/components/admin/MobileCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Search, MoreHorizontal, Star, StarOff, CheckCircle, XCircle, Ban, ShieldCheck, ExternalLink, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

type StoreRow = {
  id: string;
  user_id: string;
  slug: string | null;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  location: string | null;
  phone: string | null;
  campus: string | null;
  city: string | null;
  is_verified: boolean | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  is_suspended: boolean | null;
  total_views: number | null;
  total_sales: number | null;
  monthly_fee: number | null;
  rejection_reason: string | null;
  subscription_expires_at: string | null;
  created_at: string;
};

export default function StoresManagement() {
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Dialog state for approve / reject / edit-fee
  const [reviewing, setReviewing] = useState<StoreRow | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | 'edit-fee' | null>(null);
  const [monthlyFee, setMonthlyFee] = useState<string>('50');
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: storesData, isLoading } = useQuery({
    queryKey: ['admin-stores', search],
    queryFn: async () => {
      let query = supabase
        .from('stores')
        .select('id, user_id, name, description, logo_url, cover_url, location, phone, campus, city, is_verified, is_active, is_featured, is_suspended, total_views, total_sales, monthly_fee, rejection_reason, subscription_expires_at, created_at')
        .order('created_at', { ascending: false });
      if (search) query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as StoreRow[];
    },
  });

  const stores = storesData || [];
  const pending = stores.filter((s) => !s.is_verified && !s.rejection_reason);
  const approved = stores.filter((s) => s.is_verified);
  const rejected = stores.filter((s) => !s.is_verified && s.rejection_reason);

  const updateStoreMutation = useMutation({
    mutationFn: async ({ storeId, updates }: { storeId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from('stores').update(updates).eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      toast({ title: 'Store updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed', variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ store, fee }: { store: StoreRow; fee: number }) => {
      const { error } = await supabase
        .from('stores')
        .update({
          is_verified: true,
          monthly_fee: fee,
          rejection_reason: null,
          // expired by default so the owner must pay before going live
          subscription_expires_at: new Date().toISOString(),
        })
        .eq('id', store.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: store.user_id,
        type: 'subscription',
        title: 'Store approved!',
        body: `Your store "${store.name}" has been approved. Pay your monthly subscription of ₵${fee.toFixed(2)} to go live.`,
        data: { store_id: store.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      toast({ title: 'Store approved', description: 'Owner has been notified to pay their subscription.' });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: 'Approval failed', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ store, reason }: { store: StoreRow; reason: string }) => {
      const { error } = await supabase
        .from('stores')
        .update({ is_verified: false, rejection_reason: reason })
        .eq('id', store.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: store.user_id,
        type: 'subscription',
        title: 'Store rejected',
        body: `Your store "${store.name}" was rejected. Reason: ${reason}`,
        data: { store_id: store.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      toast({ title: 'Store rejected' });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const editFeeMutation = useMutation({
    mutationFn: async ({ store, fee }: { store: StoreRow; fee: number }) => {
      const { error } = await supabase
        .from('stores')
        .update({ monthly_fee: fee })
        .eq('id', store.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      toast({ title: 'Monthly fee updated' });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openReview = (store: StoreRow, kind: 'approve' | 'reject' | 'edit-fee') => {
    setReviewing(store);
    setAction(kind);
    setMonthlyFee(store.monthly_fee ? String(store.monthly_fee) : '50');
    setRejectionReason(store.rejection_reason || '');
  };
  const closeDialog = () => { setReviewing(null); setAction(null); setRejectionReason(''); };

  const StoreActions = ({ store }: { store: StoreRow }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem asChild>
          <Link to={`/store/${store.slug || store.id}`} className="flex items-center">
            <ExternalLink className="mr-2 h-4 w-4" />View Store
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!store.is_verified && !store.rejection_reason && (
          <>
            <DropdownMenuItem onClick={() => openReview(store, 'approve')}>
              <ShieldCheck className="mr-2 h-4 w-4" />Approve & set fee
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => openReview(store, 'reject')}>
              <XCircle className="mr-2 h-4 w-4" />Reject
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {store.is_verified && (
          <>
            <DropdownMenuItem onClick={() => openReview(store, 'edit-fee')}>
              <Pencil className="mr-2 h-4 w-4" />Edit monthly fee
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_verified: false } })}>
              <XCircle className="mr-2 h-4 w-4" />Revoke verification
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {store.is_featured ? (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_featured: false } })}>
            <StarOff className="mr-2 h-4 w-4" />Remove featured
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_featured: true } })}>
            <Star className="mr-2 h-4 w-4" />Mark featured
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {store.is_suspended ? (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_suspended: false } })}>
            <CheckCircle className="mr-2 h-4 w-4" />Reinstate store
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-destructive" onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_suspended: true } })}>
            <Ban className="mr-2 h-4 w-4" />Suspend store
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderList = (rows: StoreRow[]) => {
    if (isLoading) return <p className="text-center py-8 text-muted-foreground">Loading...</p>;
    if (rows.length === 0) return <p className="text-center py-8 text-muted-foreground">No stores found</p>;

    if (isMobile) {
      return (
        <div className="space-y-3">
          {rows.map((store) => (
            <MobileCard key={store.id} actions={<StoreActions store={store} />}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-base">{store.name}</span>
                {store.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                {store.is_verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                {!store.is_verified && !store.rejection_reason && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>
                )}
                {store.rejection_reason && <Badge variant="destructive">Rejected</Badge>}
              </div>
              <MobileCardRow label="City" value={store.city || '-'} />
              <MobileCardRow label="Location" value={store.location || '-'} />
              <MobileCardRow label="Monthly fee" value={store.monthly_fee ? `₵${Number(store.monthly_fee).toFixed(2)}` : '—'} />
              <MobileCardRow
                label="Status"
                value={
                  store.is_suspended ? <Badge variant="destructive">Suspended</Badge>
                  : store.is_active ? <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                  : <Badge variant="secondary">Inactive</Badge>
                }
              />
              <MobileCardRow label="Created" value={format(new Date(store.created_at), 'MMM d, yyyy')} />
            </MobileCard>
          ))}
        </div>
      );
    }

    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Sub expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((store) => (
              <TableRow key={store.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{store.name}</span>
                    <div className="flex gap-1">
                      {store.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      {store.is_verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                      {!store.is_verified && !store.rejection_reason && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">Pending</Badge>
                      )}
                      {store.rejection_reason && <Badge variant="destructive" className="text-xs">Rejected</Badge>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{store.city || '-'}</TableCell>
                <TableCell>{store.location || '-'}</TableCell>
                <TableCell>{store.monthly_fee ? `₵${Number(store.monthly_fee).toFixed(2)}` : '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {store.subscription_expires_at ? format(new Date(store.subscription_expires_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(store.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell><StoreActions store={store} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <AdminLayout title="Stores Management" description="Approve, reject, and manage stores">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="self-start sm:self-center">{stores.length} stores</Badge>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">{renderList(pending)}</TabsContent>
          <TabsContent value="approved" className="mt-4">{renderList(approved)}</TabsContent>
          <TabsContent value="rejected" className="mt-4">{renderList(rejected)}</TabsContent>
        </Tabs>
      </div>

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' && 'Approve store & set monthly fee'}
              {action === 'reject' && 'Reject store'}
              {action === 'edit-fee' && 'Edit monthly subscription fee'}
            </DialogTitle>
            <DialogDescription>{reviewing?.name}</DialogDescription>
          </DialogHeader>

          {reviewing && (
            <div className="space-y-4">
              {reviewing.cover_url && (
                <img src={reviewing.cover_url} alt={reviewing.name} className="w-full h-40 object-cover rounded-lg" />
              )}
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">City:</span> {reviewing.city || '—'}</p>
                <p><span className="text-muted-foreground">Area:</span> {reviewing.campus || '—'}</p>
                <p><span className="text-muted-foreground">Address:</span> {reviewing.location || '—'}</p>
                <p><span className="text-muted-foreground">Phone:</span> {reviewing.phone || '—'}</p>
                {reviewing.description && (
                  <p className="pt-2 text-muted-foreground italic">"{reviewing.description}"</p>
                )}
              </div>

              {(action === 'approve' || action === 'edit-fee') && (
                <div>
                  <Label>Monthly Subscription Fee (₵)</Label>
                  <Input
                    type="number" min="1" step="0.01"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
              {action === 'reject' && (
                <div>
                  <Label>Rejection reason</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why so the owner can fix and re-apply"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            {action === 'approve' && reviewing && (
              <Button
                onClick={() => approveMutation.mutate({ store: reviewing, fee: Number(monthlyFee) })}
                disabled={approveMutation.isPending || !monthlyFee || Number(monthlyFee) <= 0}
              >
                Approve
              </Button>
            )}
            {action === 'reject' && reviewing && (
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate({ store: reviewing, reason: rejectionReason })}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
              >
                Reject
              </Button>
            )}
            {action === 'edit-fee' && reviewing && (
              <Button
                onClick={() => editFeeMutation.mutate({ store: reviewing, fee: Number(monthlyFee) })}
                disabled={editFeeMutation.isPending || !monthlyFee || Number(monthlyFee) <= 0}
              >
                Update Fee
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
