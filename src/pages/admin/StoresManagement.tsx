import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileCard, MobileCardRow } from '@/components/admin/MobileCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Star, StarOff, CheckCircle, XCircle, Ban, ShieldCheck, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useIsMobile } from '@/hooks/use-mobile';

const ITEMS_PER_PAGE = 10;

export default function StoresManagement() {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: storesData, isLoading } = useQuery({
    queryKey: ['admin-stores', search],
    queryFn: async () => {
      let query = supabase
        .from('stores')
        .select('id, user_id, name, description, logo_url, cover_url, location, phone, campus, is_verified, is_active, is_featured, is_suspended, total_views, total_sales, latitude, longitude, current_plan_id, product_limit, subscription_expires_at, created_at, updated_at')
        .order('created_at', { ascending: false });


      if (search) {
        query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: async ({ storeId, updates }: { storeId: string; updates: Record<string, boolean> }) => {
      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      toast({ title: 'Store Updated', description: 'Store has been updated successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update store.', variant: 'destructive' });
    },
  });

  const stores = storesData || [];
  const totalPages = Math.ceil(stores.length / ITEMS_PER_PAGE);
  const paginatedStores = stores.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const StoreActions = ({ store }: { store: typeof paginatedStores[0] }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem asChild>
          <Link to={`/store/${store.id}`} className="flex items-center">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Store
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {store.is_featured ? (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_featured: false } })}>
            <StarOff className="mr-2 h-4 w-4" />
            Remove Featured
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_featured: true } })}>
            <Star className="mr-2 h-4 w-4" />
            Mark Featured
          </DropdownMenuItem>
        )}
        {store.is_verified ? (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_verified: false } })}>
            <XCircle className="mr-2 h-4 w-4" />
            Remove Verified
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_verified: true } })}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Mark Verified
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {store.is_suspended ? (
          <DropdownMenuItem onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_suspended: false } })}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Reinstate Store
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-destructive" onClick={() => updateStoreMutation.mutate({ storeId: store.id, updates: { is_suspended: true } })}>
            <Ban className="mr-2 h-4 w-4" />
            Suspend Store
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AdminLayout title="Stores Management" description="Manage all platform stores">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="self-start sm:self-center">{stores.length} stores</Badge>
        </div>

        {isMobile ? (
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : paginatedStores.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No stores found</p>
            ) : (
              paginatedStores.map((store) => (
                <MobileCard key={store.id} actions={<StoreActions store={store} />}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-base">{store.name}</span>
                    {store.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    {store.is_verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                    {!store.is_verified && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>
                    )}
                  </div>
                  <MobileCardRow label="Location" value={store.location || '-'} />
                  <MobileCardRow label="Sales" value={store.total_sales || 0} />
                  <MobileCardRow label="Views" value={store.total_views || 0} />
                  <MobileCardRow
                    label="Status"
                    value={
                      store.is_suspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : store.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )
                    }
                  />
                  <MobileCardRow label="Created" value={format(new Date(store.created_at), 'MMM d, yyyy')} />
                </MobileCard>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : paginatedStores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No stores found</TableCell>
                  </TableRow>
                ) : (
                  paginatedStores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{store.name}</span>
                          <div className="flex gap-1">
                            {store.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                            {store.is_verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                            {!store.is_verified && (
                              <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">Pending</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{store.location || '-'}</TableCell>
                      <TableCell>{store.total_sales || 0}</TableCell>
                      <TableCell>{store.total_views || 0}</TableCell>
                      <TableCell>
                        {store.is_suspended ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : store.is_active ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(store.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell><StoreActions store={store} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent className="flex-wrap justify-center">
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page} className={totalPages > 5 && Math.abs(page - currentPage) > 1 ? 'hidden sm:block' : ''}>
                  <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </AdminLayout>
  );
}
