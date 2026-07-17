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
  created_at?: string;
  product?: { name: string; image_url: string | null };
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
          *,
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

    // Subscribe to real-time order updates
    const ordersChannel = supabase
      .channel("store-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          console.log("Order update:", payload);
          if (store) {
            const ordersData = await fetchOrders(store.id);
            setOrders(ordersData);
          }
        }
      )
      .subscribe();

    // Subscribe to real-time product updates
    const productsChannel = supabase
      .channel("store-products-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        async (payload) => {
          console.log("Product update:", payload);
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
      // Send branded welcome email (best-effort)
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

  const createProduct = async (data: Omit<Product, "id" | "store_id" | "views" | "created_at" | "updated_at">) => {
    if (!store) throw new Error("No store found");

    const { data: newProduct, error } = await supabase
      .from("products")
      .insert({
        store_id: store.id,
        ...data,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Cannot add product", description: error.message, variant: "destructive" });
      throw error;
    }
    
    setProducts([newProduct, ...products]);
    toast({ title: "Product added!" });
    return newProduct;
  };

  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    const { error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", productId);

    if (error) throw error;
    
    setProducts(products.map(p => p.id === productId ? { ...p, ...updates } : p));
    toast({ title: "Product updated!" });
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) throw error;
    
    setProducts(products.filter(p => p.id !== productId));
    toast({ title: "Product deleted!" });
  };

  const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
    const order = orders.find(o => o.id === orderId);
    const previousStatus = order?.status;

    // If confirming a delivery order, also set delivery_status to 'pending'
    const isDeliveryConfirm = status === 'confirmed' && (order as any)?.delivery_type === 'delivery';
    
    const updatePayload: Record<string, any> = { status };
    if (isDeliveryConfirm) {
      updatePayload.delivery_status = 'pending';
    }

    const { error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (error) throw error;
    
    setOrders(orders.map(o => o.id === orderId ? { ...o, ...updatePayload } : o));
    toast({ title: "Order status updated!" });

    // Send email notification to buyer about status change
    if (order && status !== previousStatus && store) {
      sendOrderStatusEmailNotification(
        order.buyer_id,
        orderId,
        status,
        store.name
      );
    }

    // If order is being completed (and wasn't already completed), update stock
    if (status === "completed" && previousStatus !== "completed" && order?.order_items) {
      const lowStockProducts: Array<{ name: string; stock: number }> = [];
      const LOW_STOCK_THRESHOLD = 5;

      for (const item of order.order_items) {
        // Find the current product
        const product = products.find(p => p.id === item.product_id);
        if (!product || product.is_service) continue;

        const newStock = Math.max(0, product.stock - item.quantity);
        
        // Update stock in database
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", item.product_id);

        if (stockError) {
          console.error("Error updating stock:", stockError);
          continue;
        }

        // Update local state
        setProducts(prev => prev.map(p => 
          p.id === item.product_id ? { ...p, stock: newStock } : p
        ));

        // Check for low stock
        if (newStock <= LOW_STOCK_THRESHOLD && newStock > 0) {
          lowStockProducts.push({ 
            name: item.product?.name || "Unknown product", 
            stock: newStock 
          });
        } else if (newStock === 0) {
          lowStockProducts.push({ 
            name: item.product?.name || "Unknown product", 
            stock: 0 
          });
          toast({
            title: "Out of Stock!",
            description: `${item.product?.name || "A product"} is now out of stock.`,
            variant: "destructive",
          });
        }
      }

      // Alert for low stock products
      if (lowStockProducts.length > 0) {
        const lowButNotEmpty = lowStockProducts.filter(p => p.stock > 0);
        if (lowButNotEmpty.length > 0) {
          toast({
            title: "Low Stock Alert",
            description: `${lowButNotEmpty.map(p => p.name).join(", ")} ${lowButNotEmpty.length === 1 ? "is" : "are"} running low (≤${LOW_STOCK_THRESHOLD} items).`,
            variant: "destructive",
          });
        }
        
        // Send email notification for low stock
        if (user) {
          sendLowStockEmailNotification(user.id, lowStockProducts);
        }
      }

      // Update store's total sales count
      if (store) {
        await supabase
          .from("stores")
          .update({ total_sales: store.total_sales + 1 })
          .eq("id", store.id);
        
        setStore({ ...store, total_sales: store.total_sales + 1 });
      }
    }
  };

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
    refetch: loadData,
  };
};
