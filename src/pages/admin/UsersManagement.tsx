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
import { Search, MoreHorizontal, Shield, ShieldOff, UserX, UserCheck, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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

export default function UsersManagement() {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      return profiles?.map(profile => ({
        ...profile,
        user_role: roleMap.get(profile.user_id) || null
      }));
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_suspended: suspend })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: suspend ? 'User Suspended' : 'User Reinstated',
        description: suspend ? 'The user has been suspended.' : 'The user has been reinstated.',
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update user status.', variant: 'destructive' });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role, action }: { userId: string; role: 'admin' | 'moderator' | 'delivery'; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);
        if (error) throw error;
      }
    },
    onSuccess: (_, { role, action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: action === 'add' ? 'Role Assigned' : 'Role Removed',
        description: action === 'add' ? `User is now a ${role}.` : `${role} role removed.`,
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update user role.', variant: 'destructive' });
    },
  });

  const users = usersData || [];
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const paginatedUsers = users.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const UserActions = ({ user }: { user: typeof paginatedUsers[0] }) => {
    const userRole = user.user_role as 'admin' | 'moderator' | 'delivery' | null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          {!userRole && (
            <>
              <DropdownMenuItem onClick={() => roleMutation.mutate({ userId: user.user_id, role: 'moderator', action: 'add' })}>
                <Shield className="mr-2 h-4 w-4" />
                Make Moderator
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => roleMutation.mutate({ userId: user.user_id, role: 'admin', action: 'add' })}>
                <Shield className="mr-2 h-4 w-4" />
                Make Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => roleMutation.mutate({ userId: user.user_id, role: 'delivery', action: 'add' })}>
                <Truck className="mr-2 h-4 w-4" />
                Make Delivery Person
              </DropdownMenuItem>
            </>
          )}
          {userRole && (
            <DropdownMenuItem onClick={() => roleMutation.mutate({ userId: user.user_id, role: userRole, action: 'remove' })}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Remove {userRole} Role
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {user.is_suspended ? (
            <DropdownMenuItem onClick={() => suspendMutation.mutate({ userId: user.user_id, suspend: false })}>
              <UserCheck className="mr-2 h-4 w-4" />
              Reinstate User
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-destructive" onClick={() => suspendMutation.mutate({ userId: user.user_id, suspend: true })}>
              <UserX className="mr-2 h-4 w-4" />
              Suspend User
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <AdminLayout title="Users Management" description="Manage all platform users">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="self-start sm:self-center">{users.length} users</Badge>
        </div>

        {/* Mobile Card View */}
        {isMobile ? (
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : paginatedUsers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No users found</p>
            ) : (
              paginatedUsers.map((user) => {
                const userRole = user.user_role as 'admin' | 'moderator' | null;
                return (
                  <MobileCard key={user.id} actions={<UserActions user={user} />}>
                    <div className="font-medium text-base">{user.full_name || 'No name'}</div>
                    <MobileCardRow label="Campus" value={user.campus || '-'} />
                    <MobileCardRow label="Phone" value={user.phone || '-'} />
                    <MobileCardRow
                      label="Role"
                      value={
                        userRole ? (
                          <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>{userRole}</Badge>
                        ) : (
                          <span className="text-muted-foreground">User</span>
                        )
                      }
                    />
                    <MobileCardRow
                      label="Status"
                      value={
                        user.is_suspended ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                        )
                      }
                    />
                    <MobileCardRow label="Joined" value={format(new Date(user.created_at), 'MMM d, yyyy')} />
                  </MobileCard>
                );
              })
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => {
                    const userRole = user.user_role as 'admin' | 'moderator' | null;
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name || 'No name'}</TableCell>
                        <TableCell>{user.campus || '-'}</TableCell>
                        <TableCell>{user.phone || '-'}</TableCell>
                        <TableCell>
                          {userRole ? (
                            <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>{userRole}</Badge>
                          ) : (
                            <span className="text-muted-foreground">User</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.is_suspended ? (
                            <Badge variant="destructive">Suspended</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell><UserActions user={user} /></TableCell>
                      </TableRow>
                    );
                  })
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
