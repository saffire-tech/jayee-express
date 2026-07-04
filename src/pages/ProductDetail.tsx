import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useProductViewTracking } from '@/hooks/useViewTracking';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, ShoppingCart, Store, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import ShareButton from '@/components/ui/ShareButton';
import ContactSellerDialog from '@/components/messaging/ContactSellerDialog';
import SimilarProducts from '@/components/sections/SimilarProducts';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  images: string[] | null;
  category: string;
  stock: number | null;
  is_service: boolean | null;
  store_id: string;
  store: {
    id: string;
    name: string;
    logo_url: string | null;
    description: string | null;
    location: string | null;
    user_id: string;
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Track product view
  useProductViewTracking(id);

  // Get gallery images from the images array or fallback to image_url
  const getGalleryImages = () => {
    if (product?.images && product.images.length > 0) {
      return product.images;
    }
    if (product?.image_url) {
      return [product.image_url];
    }
    return [];
  };

  const galleryImages = getGalleryImages();

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchReviews();
    }
  }, [id]);

  const fetchProduct = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        store:stores(id, name, logo_url, description, location, user_id)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching product:', error);
    } else if (data) {
      setProduct({
        ...data,
        store: Array.isArray(data.store) ? data.store[0] : data.store
      });
    }
    setLoading(false);
  };

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
    } else {
      // Fetch profiles separately
      const userIds = [...new Set(data?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const reviewsWithProfiles = data?.map(review => ({
        ...review,
        profile: profiles?.find(p => p.user_id === review.user_id)
      })) || [];

      setReviews(reviewsWithProfiles);
    }
  };

  const handleAddToCart = async () => {
    await addToCart(product!.id, quantity);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please login to submit a review');
      return;
    }

    setSubmittingReview(true);
    const { error } = await supabase
      .from('reviews')
      .insert({
        product_id: id,
        user_id: user.id,
        rating: newReview.rating,
        comment: newReview.comment || null
      });

    if (error) {
      toast.error('Failed to submit review');
    } else {
      toast.success('Review submitted');
      setNewReview({ rating: 5, comment: '' });
      fetchReviews();
    }
    setSubmittingReview(false);
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Product not found</h1>
          <Link to="/">
            <Button className="mt-4">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const productImage = galleryImages[0] || 'https://jayeeexpress.com/icons/icon-512x512.png';
  const productDescription = product.description
    ? product.description.slice(0, 155)
    : `Buy ${product.name} from ${product.store?.name ?? 'a local seller'} on Jayee Express.`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDescription,
    image: productImage,
    sku: product.id,
    category: product.category,
    brand: product.store?.name
      ? { "@type": "Brand", name: product.store.name }
      : undefined,
    offers: {
      "@type": "Offer",
      url: `https://jayeeexpress.com/product/${product.id}`,
      priceCurrency: "GHS",
      price: product.price,
      availability:
        (product.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${product.name} — ₵${product.price.toLocaleString()} | Jayee Express`}
        description={productDescription}
        canonicalPath={`/product/${product.id}`}
        image={productImage}
        type="product"
        jsonLd={productJsonLd}
      />
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-8">
        {/* Breadcrumb */}
        <div className="mb-4 md:mb-6">
          <Link to="/" className="text-muted-foreground hover:text-primary text-sm md:text-base">Home</Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-foreground text-sm md:text-base line-clamp-1">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {galleryImages.length > 0 ? (
                <img 
                  src={galleryImages[currentImageIndex]} 
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No image available
                </div>
              )}
              
              {galleryImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                    onClick={() => setCurrentImageIndex(prev => prev === galleryImages.length - 1 ? 0 : prev + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            
            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-20 h-20 rounded-md overflow-hidden border-2 ${
                      idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4 md:space-y-6">
            <div>
              <Badge variant="secondary" className="mb-2">{product.category}</Badge>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{product.name}</h1>
              
              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      className={`h-5 w-5 ${star <= averageRating ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            </div>

            <p className="text-3xl md:text-4xl font-bold text-primary">
              ₵{product.price.toLocaleString()}
            </p>

            <p className="text-muted-foreground leading-relaxed">
              {product.description || 'No description available.'}
            </p>

            {!product.is_service && (
              <p className="text-sm">
                <span className="text-muted-foreground">Stock: </span>
                <span className={product.stock && product.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                  {product.stock && product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
                </span>
              </p>
            )}

            <Separator />

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border rounded-md">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center">{quantity}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setQuantity(q => q + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Button 
                  size="lg" 
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={!product.is_service && (!product.stock || product.stock <= 0)}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Add to Cart
                </Button>
                <ContactSellerDialog
                  sellerId={product.store.user_id}
                  sellerName={product.store.name}
                  storeId={product.store.id}
                  storeName={product.store.name}
                  productId={product.id}
                  productName={product.name}
                />
                <ShareButton 
                  url={`/product/${product.id}`}
                  title={product.name}
                  description={product.description || undefined}
                  size="lg"
                />
              </div>
            </div>

            <Separator />

            {/* Seller Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={product.store?.logo_url || ''} />
                    <AvatarFallback>
                      <Store className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.store?.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.store?.location || 'Local Store'}</p>
                  </div>
                  <Link to={`/store/${product.store?.id}`}>
                    <Button variant="outline" size="sm">Visit Store</Button>
                  </Link>
                </div>
                {product.store?.description && (
                  <p className="text-sm text-muted-foreground mt-3">{product.store.description}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
          
          {/* Write Review */}
          {user && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Write a Review</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                        >
                          <Star 
                            className={`h-6 w-6 cursor-pointer transition-colors ${
                              star <= newReview.rating 
                                ? 'fill-primary text-primary' 
                                : 'text-muted-foreground hover:text-primary'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    placeholder="Share your experience with this product..."
                    value={newReview.comment}
                    onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                  />
                  <Button onClick={handleSubmitReview} disabled={submittingReview}>
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No reviews yet. Be the first to review this product!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src={review.profile?.avatar_url || ''} />
                        <AvatarFallback>
                          {review.profile?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{review.profile?.full_name || 'Anonymous'}</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex mb-2">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star 
                              key={star} 
                              className={`h-4 w-4 ${star <= review.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                            />
                          ))}
                        </div>
                        {review.comment && (
                          <p className="text-muted-foreground">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Similar Products */}
        <SimilarProducts 
          currentProductId={product.id}
          category={product.category}
          price={product.price}
        />
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
