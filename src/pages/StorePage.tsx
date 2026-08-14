import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import SEO from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useStoreViewTracking } from '@/hooks/useViewTracking';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import WebServicesSection from '@/components/store/WebServicesSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Verified, Store as StoreIcon, Package, ShoppingCart, Heart, Eye } from 'lucide-react';
import ShareButton from '@/components/ui/ShareButton';
import ContactSellerDialog from '@/components/messaging/ContactSellerDialog';

interface Store {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  location: string | null;
  phone: string | null;
  is_verified: boolean | null;
  total_views: number | null;
  total_sales: number | null;
  created_at: string;
  user_id: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  is_service: boolean | null;
  stock: number | null;
}

interface WebService {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string;
}

const StorePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [webServices, setWebServices] = useState<WebService[]>([]);
  const [loading, setLoading] = useState(true);

  // Track store view (uses real id once loaded)
  useStoreViewTracking(store?.id);

  useEffect(() => {
    if (slug) {
      fetchStoreData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchStoreData = async () => {
    if (!slug) return;
    setLoading(true);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(slug);

    let storeQuery = supabase.from('stores').select('*');
    storeQuery = isUuid ? storeQuery.eq('id', slug) : storeQuery.eq('slug', slug);

    const { data: storeData, error: storeError } = await storeQuery.maybeSingle();

    if (storeError) {
      console.error('Error fetching store:', storeError);
      setLoading(false);
      return;
    }

    if (!storeData) {
      setStore(null);
      setLoading(false);
      return;
    }

    setStore(storeData as Store);

    // If user landed on a UUID URL but the store has a slug, redirect to the pretty URL
    if (isUuid && (storeData as Store).slug) {
      navigate(`/store/${(storeData as Store).slug}`, { replace: true });
    }

    // Fetch store products
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, description, price, image_url, category, is_service, stock')
      .eq('store_id', storeData.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching products:', productsError);
    } else {
      setProducts(productsData || []);
    }

    // Fetch web services
    const { data: servicesData, error: servicesError } = await supabase
      .from('store_web_services')
      .select('id, name, description, url, icon')
      .eq('store_id', storeData.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (servicesError) {
      console.error('Error fetching web services:', servicesError);
    } else {
      setWebServices(servicesData || []);
    }

    setLoading(false);
  };

  const handleAddToCart = async (productId: string) => {
    await addToCart(productId, 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center pt-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center pt-24">
          <StoreIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Store not found</h1>
          <p className="text-muted-foreground mb-6">This store doesn't exist or has been removed.</p>
          <Link to="/products">
            <Button>Browse Products</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const storeImage = store.logo_url || store.cover_url || 'https://jayeeexpress.com/icons/icon-512x512.png';
  const storeDescription = store.description
    ? store.description.slice(0, 155)
    : `Shop at ${store.name}${store.location ? ` in ${store.location}` : ''} on Jayee Express — buy and sell locally in Ghana.`;

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: storeDescription,
    image: storeImage,
    url: `https://jayeeexpress.com/store/${store.slug || store.id}`,
    address: store.location
      ? { "@type": "PostalAddress", addressLocality: store.location, addressCountry: "GH" }
      : undefined,
    telephone: store.phone || undefined,
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${store.name} | Jayee Express`}
        description={storeDescription}
        canonicalPath={`/store/${store.slug || store.id}`}
        image={storeImage}
        jsonLd={storeJsonLd}
      />
      <Navbar />
      
      <main>
        {/* Store Header */}
        <div className="relative">
          {/* Cover Image */}
          <div className="h-48 md:h-64 bg-muted overflow-hidden">
            {store.cover_url ? (
              <img
                src={store.cover_url}
                alt={`${store.name} cover`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-primary/20 to-primary/5" />
            )}
          </div>

          {/* Store Info */}
          <div className="container mx-auto px-4">
            <div className="relative -mt-16 md:-mt-20 pb-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Logo */}
                <div className="relative">
                  <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl border-4 border-background bg-card shadow-lg overflow-hidden flex items-center justify-center">
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt={store.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <StoreIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  {store.is_verified && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Verified className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>

                {/* Store Details */}
                <div className="flex-1 pt-2">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold">{store.name}</h1>
                    {store.is_verified && (
                      <Badge variant="secondary" className="gap-1">
                        <Verified className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  
                  {store.description && (
                    <p className="text-muted-foreground mb-3 max-w-2xl">
                      {store.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                    {store.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{store.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span>{products.length} {products.length === 1 ? 'product' : 'products'}</span>
                    </div>
                    {(store.total_views ?? 0) > 0 && (
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>{store.total_views?.toLocaleString()} {store.total_views === 1 ? 'view' : 'views'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <ContactSellerDialog
                      sellerId={store.user_id}
                      sellerName={store.name}
                      storeId={store.id}
                      storeName={store.name}
                    />
                    <ShareButton 
                      url={`/store/${store.slug || store.id}`}
                      title={store.name}
                      description={store.description || undefined}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Web Services Section */}
        <WebServicesSection services={webServices} />

        {/* Products Section */}
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-xl font-bold mb-6">Products & Services</h2>

          {products.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-xl mb-2">No products yet</h3>
              <p className="text-muted-foreground">
                This store hasn't listed any products yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card-hover"
                >
                  {/* Image */}
                  <Link to={`/product/${product.id}`}>
                    <div className="relative aspect-square overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <button className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors">
                        <Heart className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                      <div className="absolute bottom-3 left-3 flex gap-2">
                        <span className="px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium">
                          {product.category}
                        </span>
                        {product.is_service && (
                          <span className="px-2 py-1 rounded-full bg-primary/80 text-primary-foreground text-xs font-medium">
                            Service
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Content */}
                  <div className="p-4">
                    <Link to={`/product/${product.id}`}>
                      <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                    </Link>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-foreground">
                        ₵{product.price.toFixed(2)}
                      </p>
                      <Button 
                        size="sm" 
                        className="gap-1" 
                        onClick={() => handleAddToCart(product.id)}
                        disabled={!product.is_service && (!product.stock || product.stock <= 0)}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StorePage;
