import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  variant_id?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    store_id: string;
  } | null;
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  addToCart: (
    productId: string, 
    quantity?: number, 
    variantMeta?: { variantId?: string | null; color?: string | null; size?: string | null; material?: string | null }
  ) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          quantity,
          variant_id,
          color,
          size,
          material,
          product:products(id, name, price, image_url, store_id)
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching cart:', error);
      } else {
        const formattedItems = (data || []).map((item: any) => ({
          ...item,
          product: Array.isArray(item.product) ? item.product[0] : item.product
        }));
        setItems(formattedItems);
      }
    } catch (err) {
      console.error('Cart fetch exception:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();

    if (!user) return;

    const channel = supabase
      .channel("cart-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCart();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const addToCart = async (
    productId: string, 
    quantity = 1, 
    variantMeta?: { variantId?: string | null; color?: string | null; size?: string | null; material?: string | null }
  ) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return;
    }

    try {
      const variantId = variantMeta?.variantId || null;
      const color = variantMeta?.color || null;
      const size = variantMeta?.size || null;
      const material = variantMeta?.material || null;

      const existingItem = items.find(item => 
        item.product_id === productId && 
        (item.variant_id || null) === variantId
      );

      if (existingItem) {
        await updateQuantity(existingItem.id, existingItem.quantity + quantity);
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({ 
            user_id: user.id, 
            product_id: productId, 
            quantity,
            variant_id: variantId,
            color,
            size,
            material
          });

        if (error) {
          console.error('Add to cart error:', error);
          toast.error('Failed to add to cart');
        } else {
          toast.success('Added to cart');
          await fetchCart();
        }
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      toast.error('Failed to add to cart');
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Remove from cart error:', error);
        toast.error('Failed to remove item');
      } else {
        setItems(prev => prev.filter(item => item.id !== itemId));
      }
    } catch (error) {
      console.error('Remove from cart error:', error);
      toast.error('Failed to remove item');
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);

      if (error) {
        console.error('Update quantity error:', error);
        toast.error('Failed to update quantity');
      } else {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, quantity } : item
        ));
      }
    } catch (error) {
      console.error('Update quantity error:', error);
      toast.error('Failed to update quantity');
    }
  };

  const clearCart = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Clear cart error:', error);
        toast.error('Failed to clear cart');
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Clear cart error:', error);
      toast.error('Failed to clear cart');
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      loading,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
