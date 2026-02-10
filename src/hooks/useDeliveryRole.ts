import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDeliveryRole() {
  const { user } = useAuth();
  const [isDeliveryPerson, setIsDeliveryPerson] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsDeliveryPerson(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'delivery')
        .maybeSingle();
      setIsDeliveryPerson(!!data);
      setLoading(false);
    };

    check();
  }, [user]);

  return { isDeliveryPerson, loading };
}
