import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDeliveryRole() {
  const { user } = useAuth();
  const [isDeliveryPerson, setIsDeliveryPerson] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsDeliveryPerson(false);
      setHasActiveSubscription(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      const [{ data: roleRow }, { data: subRow }] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'delivery')
          .maybeSingle(),
        supabase
          .from('delivery_subscriptions')
          .select('expires_at, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setIsDeliveryPerson(!!roleRow);
      setHasActiveSubscription(!!subRow);
      setLoading(false);
    };

    check();
  }, [user]);

  return { isDeliveryPerson, hasActiveSubscription, loading };
}
