import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Store, Package, ShoppingCart, TrendingUp, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import AnnouncementsManager from '@/components/admin/AnnouncementsManager';
import SubscriptionPlansManager from '@/components/admin/SubscriptionPlansManager';
import LocationsManager from '@/components/admin/LocationsManager';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [profiles, stores, products, orders] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('stores').select('id, total_views, total_sales', { count: 'exact' }),
        supabase.from('products').select('id, views', { count: 'exact' }),
        supabase.from('orders').select('id, total_amount, status', { count: 'exact' }),
      ]);

      const totalRevenue = orders.data?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const totalViews = stores.data?.reduce((sum, store) => sum + (store.total_views || 0), 0) || 0;
      const pendingOrders = orders.data?.filter(o => o.status === 'pending').length || 0;

      return {
        users: profiles.count || 0,
        stores: stores.count || 0,
        products: products.count || 0,
        orders: orders.count || 0,
        revenue: totalRevenue,
        views: totalViews,
        pendingOrders,
      };
    },
  });

  const statCards = [
    { title: 'Total Users', value: stats?.users || 0, icon: Users, color: 'text-blue-500', isCurrency: false },
    { title: 'Total Stores', value: stats?.stores || 0, icon: Store, color: 'text-green-500', isCurrency: false },
    { title: 'Total Products', value: stats?.products || 0, icon: Package, color: 'text-purple-500', isCurrency: false },
    { title: 'Total Orders', value: stats?.orders || 0, icon: ShoppingCart, color: 'text-orange-500', isCurrency: false },
    { title: 'Total Revenue', value: stats?.revenue || 0, icon: TrendingUp, color: 'text-primary', isCurrency: true },
    { title: 'Platform Views', value: stats?.views || 0, icon: Eye, color: 'text-cyan-500', isCurrency: false },
  ];

  return (
    <AdminLayout title="Dashboard" description="Platform overview and statistics">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  <AnimatedCounter 
                    value={stat.value} 
                    prefix={stat.isCurrency ? "₵" : ""} 
                    decimals={stat.isCurrency ? 2 : 0}
                    duration={1200}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {stats?.pendingOrders && stats.pendingOrders > 0 && (
        <Card className="mt-6 border-orange-500/50 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="text-orange-500 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <AnimatedCounter value={stats.pendingOrders} duration={800} /> Pending Order{stats.pendingOrders > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              There are orders awaiting processing. Review them in the Orders section.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-8">
        <AnnouncementsManager />
      </div>

      <div className="mt-8">
        <SubscriptionPlansManager />
      </div>

      <div className="mt-8">
        <LocationsManager />
      </div>
    </AdminLayout>
  );
}
