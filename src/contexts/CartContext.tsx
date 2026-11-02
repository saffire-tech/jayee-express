import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import VariantPickerDialog, { PickedVariant } from '@/components/cart/VariantPickerDialog';

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
  /** True when the product has variants but the cart line has no variant chosen yet. */
  itemNeedsVariant: (item: CartItem) => boolean;
  /** Opens the variant picker for an existing cart line. */
  chooseVariantForItem: (itemId: string) => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsWithVariants, setProductsWithVariants] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<{
    productId: string;
    name?: string;
    onConfirm: (v: PickedVariant) => void;
  } | null>(null);

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

        const ids = [...new Set(formattedItems.map((i: any) => i.product_id))] as string[];
        if (ids.length > 0) {
          const { data: vrows } = await supabase
            .from('product_variants')
            .select('product_id')
            .in('product_id', ids);
          setProductsWithVariants(new Set((vrows || []).map((r: any) => r.product_id)));
        } else {
          setProductsWithVariants(new Set());
        }
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

  const addToCartWithMeta = async (
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

  // Products with variants always need an explicit choice before they enter the cart.
  const addToCart = async (
    productId: string,
    quantity = 1,
    variantMeta?: { variantId?: string | null; color?: string | null; size?: string | null; material?: string | null }
  ) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return;
    }
    if (variantMeta?.variantId) {
      await addToCartWithMeta(productId, quantity, variantMeta);
      return;
    }
    const { data: existing } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', productId)
      .limit(1);
    if (existing && existing.length > 0) {
      setPicker({
        productId,
        onConfirm: async (v) => {
          setPicker(null);
          await addToCartWithMeta(productId, quantity, v);
        },
      });
      return;
    }
    await addToCartWithMeta(productId, quantity, undefined);
  };

  const itemNeedsVariant = (item: CartItem) =>
    !item.variant_id && productsWithVariants.has(item.product_id);

  const chooseVariantForItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setPicker({
      productId: item.product_id,
      name: item.product?.name,
      onConfirm: async (v) => {
        setPicker(null);
        const duplicate = items.find((i) => i.id !== itemId && i.product_id === item.product_id && i.variant_id === v.variantId);
        if (duplicate) {
          await supabase.from('cart_items').update({ quantity: duplicate.quantity + item.quantity }).eq('id', duplicate.id);
          await supabase.from('cart_items').delete().eq('id', itemId);
        } else {
          const { error } = await supabase
            .from('cart_items')
            .update({ variant_id: v.variantId, color: v.color, size: v.size, material: v.material })
            .eq('id', itemId);
          if (error) {
            toast.error('Could not save your choice');
            return;
          }
        }
        await fetchCart();
      },
    });
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
      itemNeedsVariant,
      chooseVariantForItem,
      totalItems,
      totalPrice
    }}>
      {children}
      <VariantPickerDialog
        open={!!picker}
        productId={picker?.productId ?? null}
        productName={picker?.name}
        onCancel={() => setPicker(null)}
        onConfirm={(v) => picker?.onConfirm(v)}
      />
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
