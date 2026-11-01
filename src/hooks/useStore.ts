import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sendOrderStatusEmailNotification, sendLowStockEmailNotification } from "@/lib/emailNotifications";

export interface Store {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  location: string | null;
  campus: string | null;
  phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  total_views: number;
  total_sales: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantInput {
  color: string;
  size: string;
  material: string;
  stock: number;
  imageUrl?: string | null;
  price?: number | null;
  description?: string | null;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  images: string[];
  is_service: boolean;
  is_active: boolean;
  stock: number;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  store_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  buyer?: { full_name: string | null };
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  created_at?: string;
  product?: { name: string; image_url: string | null };
  // Variant metadata returned by fetches (nullable)
  variant?: { id: string; image_url?: string | null; price?: number | null } | null;
}

export const useStore = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const STORE_COLUMNS = "id, user_id, name, description, logo_url, cover_url, location, phone, campus, is_verified, is_active, is_featured, is_suspended, total_views, total_sales, latitude, longitude, current_plan_id, product_limit, subscription_expires_at, created_at, updated_at";

  const fetchStore = async () => {
    if (!user) return null;
    
    const { data, error } = await supabase
      .from("stores")
      .select(STORE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching store:", error);
      return null;
    }
    return data;
  };

  const fetchProducts = async (storeId: string) => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products:", error);
      return [];
    }
    return data || [];
  };

  const fetchOrders = async (storeId: string) => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          id,
          order_id,
          product_id,
          quantity,
          price,
          color,
          size,
          material,
          product:products (name, image_url)
        )
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      return [];
    }
    return data || [];
  };

  const loadData = async () => {
    setLoading(true);
    const storeData = await fetchStore();
    setStore(storeData);
    
    if (storeData) {
      const [productsData, ordersData] = await Promise.all([
        fetchProducts(storeData.id),
        fetchOrders(storeData.id)
      ]);
      setProducts(productsData);
      setOrders(ordersData);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setLoading(false);
      return;
    }

    const ordersChannel = supabase
      .channel("store-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async () => {
          if (store) {
            const ordersData = await fetchOrders(store.id);
            setOrders(ordersData);
          }
        }
      )
      .subscribe();

    const productsChannel = supabase
      .channel("store-products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        async () => {
          if (store) {
            const productsData = await fetchProducts(store.id);
            setProducts(productsData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
    };
  }, [user, store?.id]);

  const createStore = async (data: { name: string; description: string; location: string; phone: string; campus: string; city: string; cover_url?: string; logo_url?: string; latitude?: number; longitude?: number }) => {
    if (!user) throw new Error("Not authenticated");

    let city = data.city;
    if (!city) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("city")
        .eq("user_id", user.id)
        .maybeSingle();
      city = (prof as any)?.city || "";
    }
    if (!city) {
      toast({
        title: "Select your city first",
        description: "Please pick your city before creating a store.",
        variant: "destructive",
      });
      throw new Error("Missing city");
    }

    try {
      const { data: newStore, error } = await supabase
        .from("stores")
        .insert({
          user_id: user.id,
          name: data.name,
          description: data.description,
          location: data.location,
          phone: data.phone,
          campus: data.campus,
          city,
          is_verified: false,
          ...(data.cover_url ? { cover_url: data.cover_url } : {}),
          ...(data.logo_url ? { logo_url: data.logo_url } : {}),
          ...(data.latitude && data.longitude ? { latitude: data.latitude, longitude: data.longitude } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;

      setStore(newStore);
      try {
        await supabase.functions.invoke("notify-app-email", {
          body: {
            templateName: "store-welcome",
            storeId: newStore.id,
          },
        });
      } catch (e) {
        console.warn("store-welcome email failed", e);
      }
      toast({
        title: "Store submitted for review!",
        description: "An admin will review your store and assign your monthly subscription fee shortly.",
      });
      return newStore;
    } catch (err: any) {
      console.error("createStore error:", err);
      toast({
        title: "Could not submit store",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateStore = async (updates: Partial<Store>) => {
    if (!store) throw new Error("No store found");

    const { error } = await supabase
      .from("stores")
      .update(updates)
      .eq("id", store.id);

    if (error) throw error;
    
    setStore({ ...store, ...updates });
    toast({ title: "Store updated!" });
  };

  const createProduct = async (
    data: Omit<Product, "id" | "store_id" | "views" | "created_at" | "updated_at"> & { variants?: ProductVariantInput[] }
  ) => {
    if (!store) throw new Error("No store found");

    const { variants, ...productData } = data;

    // 1. Insert product record
    const { data: newProduct, error } = await supabase
      .from("products")
      .insert({
        store_id: store.id,
        ...productData,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Cannot add product", description: error.message, variant: "destructive" });
      throw error;
    }

    // 2. Insert product variants including optional variant image_url, price and description
    if (variants && variants.length > 0 && newProduct) {
      const variantRows = variants.map(v => ({
        product_id: newProduct.id,
        color: v.color || null,
        size: v.size || null,
        material: v.material || null,
        stock: v.stock || 0,
        image_url: v.imageUrl || null,
        price: v.price ?? null,
        description: v.description ?? null,
      }));

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert(variantRows);

      if (variantError) {
        console.error("Error saving variants:", variantError);
        toast({ title: "Warning", description: "Product created, but failed to save variants.", variant: "destructive" });
      }
    }
    
    setProducts([newProduct, ...products]);
    toast({ title: "Product added!" });
    return newProduct;
  };

  const updateProduct = async (productId: string, updates: Partial<Product> & { variants?: ProductVariantInput[] }) => {
    const { variants, ...productData } = updates;

    // 1. Update main product details
    const { error } = await supabase
      .from("products")
      .update(productData)
      .eq("id", productId);

    if (error) throw error;

    // 2. If variants were updated, replace existing ones
    if (variants) {
      await supabase.from("product_variants").delete().eq("product_id", productId);

      if (variants.length > 0) {
        const variantRows = variants.map(v => ({
          product_id: productId,
          color: v.color || null,
          size: v.size || null,
          material: v.material || null,
          stock: v.stock || 0,
          image_url: v.imageUrl || null,
          price: v.price ?? null,
          description: v.description ?? null,
        }));

        const { error: variantError } = await supabase
          .from("product_variants")
          .insert(variantRows);

        if (variantError) {
          console.error("Error saving variants:", variantError);
          toast({ title: "Warning", description: "Product updated, but failed to save variants.", variant: "destructive" });
        }
      }
    }

    setProducts(products.map(p => (p.id === productId ? { ...p, ...productData } as Product : p)));
    toast({ title: "Product updated!" });
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      toast({ title: "Could not delete product", description: error.message, variant: "destructive" });
      throw error;
    }

    setProducts(products.filter(p => p.id !== productId));
    toast({ title: "Product deleted" });
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status } as any)
      .eq("id", orderId);

    if (error) {
      toast({ title: "Could not update order", description: error.message, variant: "destructive" });
      throw error;
    }

    const order = orders.find(o => o.id === orderId);
    setOrders(orders.map(o => (o.id === orderId ? { ...o, status } : o)));
    toast({ title: "Order updated!" });

    if (order) {
      sendOrderStatusEmailNotification(order.buyer_id, orderId, status, store?.name || "");
    }

    if (store && (status === "confirmed" || status === "completed")) {
      const fresh = await fetchProducts(store.id);
      setProducts(fresh);
      const low = fresh
        .filter(p => p.is_active && !p.is_service && p.stock <= 5)
        .map(p => ({ name: p.name, stock: p.stock }));
      if (low.length > 0) {
        sendLowStockEmailNotification(store.user_id, low);
      }
    }
  };

  const refetch = loadData;

  return {
    store,
    products,
    orders,
    loading,
    createStore,
    updateStore,
    createProduct,
    updateProduct,
    deleteProduct,
    updateOrderStatus,
    refetch,
  };
};
