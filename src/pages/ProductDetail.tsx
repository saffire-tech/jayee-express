import { getCdnImageUrl } from "@/lib/cdn";
import { useState, useEffect, useMemo } from 'react';
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

interface ProductVariant {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  material: string | null;
  stock: number;
  price?: number | null;
  description?: string | null;
  image_url?: string | null;
}

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

const norm = (v: string | null | undefined) => (v == null ? null : String(v).trim());

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Track product view
  useProductViewTracking(id);

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
      fetchVariants();
      fetchReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('id, product_id, color, size, material, stock, price, description, image_url')
      .eq('product_id', id);

    if (error) {
      console.error('Error fetching product variants:', error);
      setVariants([]);
      setSelectedColor(null);
      setSelectedSize(null);
      setSelectedMaterial(null);
      return;
    }

    if (data && data.length > 0) {
      const normalized = (data as ProductVariant[]).map(v => ({
        ...v,
        color: norm(v.color),
        size: norm(v.size),
        material: norm(v.material),
      }));

      setVariants(normalized);

      // IMPORTANT: no default variant pre-selection
      setSelectedColor(null);
      setSelectedSize(null);
      setSelectedMaterial(null);
    } else {
      setVariants([]);
      setSelectedColor(null);
      setSelectedSize(null);
      setSelectedMaterial(null);
    }
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
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await (supabase as any)
        .from('public_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const reviewsWithProfiles = (data || []).map(review => ({
        ...review,
        profile: profiles?.find((p: any) => p.user_id === review.user_id)
      })) as Review[];

      setReviews(reviewsWithProfiles);

      if (user) {
        const mine = reviewsWithProfiles.find(r => r.user_id === user.id);
        if (mine) {
          setNewReview({ rating: mine.rating, comment: mine.comment || '' });
        }
      }
    }
  };

  // Helpers to compute available options depending on current partial selection
  const unique = (arr: Array<string | null>) => Array.from(new Set(arr.filter(Boolean))) as string[];

  const colors = useMemo(() => unique(variants.map(v => norm(v.color))), [variants]);
  const sizes = useMemo(() => unique(variants.map(v => norm(v.size))), [variants]);
  const materials = useMemo(() => unique(variants.map(v => norm(v.material))), [variants]);

  const getAvailableSizes = (color?: string | null, material?: string | null) => {
    return unique(variants
      .filter(v => (color ? v.color === color : true) && (material ? v.material === material : true))
      .map(v => norm(v.size))
    );
  };

  const getAvailableColors = (size?: string | null, material?: string | null) => {
    return unique(variants
      .filter(v => (size ? v.size === size : true) && (material ? v.material === material : true))
      .map(v => norm(v.color))
    );
  };

  const getAvailableMaterials = (color?: string | null, size?: string | null) => {
    return unique(variants
      .filter(v => (color ? v.color === color : true) && (size ? v.size === size : true))
      .map(v => norm(v.material))
    );
  };

  // find a variant that matches provided attributes (null means ignore)
  const findVariant = (color?: string | null, size?: string | null, material?: string | null) => {
    return variants.find(v =>
      (color ? v.color === color : true) &&
      (size ? v.size === size : true) &&
      (material ? v.material === material : true)
    ) || null;
  };

  const selectedVariant = useMemo(() => {
    return findVariant(selectedColor, selectedSize, selectedMaterial) || null;
  }, [variants, selectedColor, selectedSize, selectedMaterial]);

  const availableStock = variants.length > 0
    ? (selectedVariant?.stock ?? 0)
    : (product?.stock ?? 0);

  const onSelectColor = (color: string) => {
    const c = norm(color);
    const sizesForColor = getAvailableSizes(c, selectedMaterial);
    const materialsForColor = getAvailableMaterials(c, selectedSize);

    const newSize = sizesForColor.includes(selectedSize || "") ? selectedSize : (sizesForColor[0] || null);
    const newMaterial = materialsForColor.includes(selectedMaterial || "") ? selectedMaterial : (materialsForColor[0] || null);

    setSelectedColor(c);
    setSelectedSize(newSize);
    setSelectedMaterial(newMaterial);
    setCurrentImageIndex(0);
  };

  const onSelectSize = (size: string) => {
    const s = norm(size);
    const colorsForSize = getAvailableColors(s, selectedMaterial);
    const materialsForSize = getAvailableMaterials(selectedColor, s);

    const newColor = colorsForSize.includes(selectedColor || "") ? selectedColor : (colorsForSize[0] || null);
    const newMaterial = materialsForSize.includes(selectedMaterial || "") ? selectedMaterial : (materialsForSize[0] || null);

    setSelectedSize(s);
    setSelectedColor(newColor);
    setSelectedMaterial(newMaterial);
    setCurrentImageIndex(0);
  };

  const onSelectMaterial = (material: string) => {
    const m = norm(material);
    const colorsForMat = getAvailableColors(selectedSize, m);
    const sizesForMat = getAvailableSizes(selectedColor, m);

    const newColor = colorsForMat.includes(selectedColor || "") ? selectedColor : (colorsForMat[0] || null);
    const newSize = sizesForMat.includes(selectedSize || "") ? selectedSize : (sizesForMat[0] || null);

    setSelectedMaterial(m);
    setSelectedColor(newColor);
    setSelectedSize(newSize);
    setCurrentImageIndex(0);
  };

  const handleAddToCart = async () => {
    if (!product) return;

    if (variants.length > 0) {
      const hasSelection = !!(selectedColor || selectedSize || selectedMaterial);

      if (hasSelection && !selectedVariant) {
        toast.error('Please select a valid variant combination.');
        return;
      }

      if (!hasSelection) {
        await addToCart(product.id, quantity, undefined);
        return;
      }
    }

    await addToCart(
      product.id,
      quantity,
      selectedVariant
        ? {
            variantId: selectedVariant.id,
            color: selectedVariant.color,
            size: selectedVariant.size,
            material: selectedVariant.material,
          }
        : undefined
    );
  };

  const myReview = user ? reviews.find(r => r.user_id === user.id) : undefined;

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please login to submit a review');
      return;
    }

    setSubmittingReview(true);

    const { error } = myReview
      ? await supabase
          .from('reviews')
          .update({
            rating: newReview.rating,
            comment: newReview.comment || null,
          })
          .eq('id', myReview.id)
      : await supabase
          .from('reviews')
          .insert({
            product_id: id,
            user_id: user.id,
            rating: newReview.rating,
            comment: newReview.comment || null,
          });

    if (error) {
      if ((error as any).code === '23505') {
        toast.error("You've already reviewed this product");
      } else {
        toast.error('Failed to submit review');
      }
    } else {
      toast.success(myReview ? 'Review updated' : 'Review submitted');
      if (!myReview) setNewReview({ rating: 5, comment: '' });
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

  const displayedImage = selectedVariant?.image_url || galleryImages[currentImageIndex] || product.image_url || null;
  const displayedPrice = Number(selectedVariant?.price ?? product.price);
  const displayedDescription = selectedVariant?.description ?? product.description;

  const productImage = displayedImage ?? 'https://jayeeexpress.com/icons/icon-512x512.png';
  const productDescription = (displayedDescription
    ? displayedDescription.slice(0, 155)
    : `Buy ${product.name} from ${product.store?.name ?? 'a local seller'} on Jayee Express.`);

  const isColorDisabled = (color: string) => {
    const c = norm(color);
    return !variants.some(v =>
      v.color === c &&
      (selectedSize ? v.size === selectedSize : true) &&
      (selectedMaterial ? v.material === selectedMaterial : true)
    );
  };

  const isSizeDisabled = (size: string) => {
    const s = norm(size);
    return !variants.some(v =>
      v.size === s &&
      (selectedColor ? v.color === selectedColor : true) &&
      (selectedMaterial ? v.material === selectedMaterial : true)
    );
  };

  const isMaterialDisabled = (material: string) => {
    const m = norm(material);
    return !variants.some(v =>
      v.material === m &&
      (selectedColor ? v.color === selectedColor : true) &&
      (selectedSize ? v.size === selectedSize : true)
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${product.name} — ₵${displayedPrice.toLocaleString()} | Jayee Express`}
        description={productDescription}
        canonicalPath={`/product/${product.id}`}
        image={productImage}
        type="product"
      />
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="mb-4 md:mb-6">
          <Link to="/" className="text-muted-foreground hover:text-primary text-sm md:text-base">Home</Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-foreground text-sm md:text-base line-clamp-1">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {displayedImage ? (
                <img
                  src={getCdnImageUrl(displayedImage)}
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
                    <img loading="lazy" src={getCdnImageUrl(img)} alt="" className="w-full h-full object-contain bg-muted" />
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
              ₵{displayedPrice.toLocaleString()}
            </p>

            <p className="text-muted-foreground leading-relaxed">
              {displayedDescription || 'No description available.'}
            </p>

            {/* Variant Selectors */}
            {colors.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Color: <span className="text-muted-foreground">{selectedColor || 'Not selected'}</span></label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map(color => {
                    const disabled = isColorDisabled(color);
                    const c = norm(color);
                    return (
                      <Button
                        key={color}
                        type="button"
                        variant={selectedColor === c ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSelectColor(color)}
                        disabled={disabled}
                        className={disabled ? "opacity-40 pointer-events-none" : ""}
                      >
                        {color}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Size: <span className="text-muted-foreground">{selectedSize || 'Not selected'}</span></label>
                <div className="flex gap-2 flex-wrap">
                  {sizes.map(size => {
                    const disabled = isSizeDisabled(size);
                    const s = norm(size);
                    return (
                      <Button
                        key={size}
                        type="button"
                        variant={selectedSize === s ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSelectSize(size)}
                        disabled={disabled}
                        className={disabled ? "opacity-40 pointer-events-none" : ""}
                      >
                        {size}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {materials.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Material: <span className="text-muted-foreground">{selectedMaterial || 'Not selected'}</span></label>
                <div className="flex gap-2 flex-wrap">
                  {materials.map(mat => {
                    const disabled = isMaterialDisabled(mat);
                    const m = norm(mat);
                    return (
                      <Button
                        key={mat}
                        type="button"
                        variant={selectedMaterial === m ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSelectMaterial(mat)}
                        disabled={disabled}
                        className={disabled ? "opacity-40 pointer-events-none" : ""}
                      >
                        {mat}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {!product.is_service && (
              <p className="text-sm">
                <span className="text-muted-foreground">Stock: </span>
                <span className={availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                  {availableStock > 0 ? `${availableStock} available` : 'Out of stock'}
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
                  disabled={!product.is_service && availableStock <= 0}
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
                  description={displayedDescription || undefined}
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
                    <AvatarImage src={getCdnImageUrl(product.store?.logo_url)} />
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
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews & Similar Products */}
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
