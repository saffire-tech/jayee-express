import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useSearchTracking } from '@/hooks/useSearchTracking';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LocationSelector from '@/components/ui/LocationSelector';
import { Search, Package, Heart, ShoppingCart, X, SlidersHorizontal, Eye } from 'lucide-react';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  is_service: boolean | null;
  views: number | null;
  store: {
    name: string;
    campus: string | null;
  } | null;
}

const CATEGORIES = [
  'All',
  'Fashion',
  'Electronics',
  'Food & Snacks',
  'Books & Notes',
  'Services',
  'Beauty',
  'Sports',
  'Other'
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
];

const fetchAllProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      description,
      price,
      image_url,
      category,
      is_service,
      views,
      store:stores(name, campus)
    `)
    .eq('is_active', true);

  if (error) throw error;
  
  return data?.map(p => ({
    ...p,
    store: Array.isArray(p.store) ? p.store[0] : p.store
  })) || [];
};

const ITEMS_PER_PAGE = 12;

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [selectedCampus, setSelectedCampus] = useState(searchParams.get('campus') || 'All');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [showFilters, setShowFilters] = useState(false);
  const { addToCart } = useCart();
  const { trackSearch } = useSearchTracking();

  // Debounced search tracking
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      trackSearch(searchQuery, selectedCategory, selectedCampus);
    }, 1000); // Track after 1 second of no typing
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, selectedCampus, trackSearch]);

  // Sync URL params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    if (selectedCampus !== 'All') params.set('campus', selectedCampus);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (currentPage > 1) params.set('page', String(currentPage));
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategory, selectedCampus, sortBy, currentPage, setSearchParams]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedCampus, sortBy]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['all-products'],
    queryFn: fetchAllProducts,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.store?.name.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Filter by campus
    if (selectedCampus !== 'All') {
      result = result.filter(p => p.store?.campus === selectedCampus);
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        result.reverse();
        break;
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedCampus, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedProducts, currentPage]);

  const handleAddToCart = async (productId: string) => {
    await addToCart(productId, 1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedCampus('All');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedCategory !== 'All' || selectedCampus !== 'All' || sortBy !== 'newest';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Browse Products</h1>
          <p className="text-muted-foreground">
            Discover amazing products and services from local sellers
          </p>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, services, or sellers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              variant="outline" 
              className="md:hidden gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Desktop Filters */}
          <div className={`flex flex-wrap gap-4 ${showFilters ? 'block' : 'hidden md:flex'}`}>
            {/* Campus Filter */}
            <LocationSelector
              value={selectedCampus}
              onChange={setSelectedCampus}
              showAllOption
              allOptionLabel="All Areas"
              className="w-full md:w-[200px]"
            />

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border">
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border">
                {SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCampus !== 'All' && (
                <Badge variant="secondary" className="gap-1">
                  {selectedCampus}
                  <button onClick={() => setSelectedCampus('All')}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCategory !== 'All' && (
                <Badge variant="secondary" className="gap-1">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory('All')}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-6">
          {filteredAndSortedProducts.length} {filteredAndSortedProducts.length === 1 ? 'product' : 'products'} found
        </p>

        {/* Products Grid */}
        {isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-xl mb-2">No products found</h3>
            <p className="text-muted-foreground mb-6">
              {hasActiveFilters 
                ? 'Try adjusting your filters or search query'
                : 'Be the first to list your products on Jayee Express!'}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters}>Clear Filters</Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card-hover w-[calc(50%-6px)] sm:w-auto"
                >
                  {/* Image */}
                  <Link to={`/product/${product.id}`}>
                    <div className="relative aspect-square overflow-hidden">
                      {product.image_url && !product.image_url.startsWith('data:') ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <button className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors">
                        <Heart className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        <span className="px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-[10px] font-medium">
                          {product.category}
                        </span>
                        {product.is_service && (
                          <span className="px-1.5 py-0.5 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-medium">
                            Service
                          </span>
                        )}
                      </div>
                      {(product.views ?? 0) > 0 && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-[10px] font-medium text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          {product.views}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Content */}
                  <div className="p-2.5 sm:p-3">
                    <Link to={`/product/${product.id}`}>
                      <h3 className="font-semibold text-sm text-foreground mb-0.5 group-hover:text-primary transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                      by {product.store?.name || 'Unknown Seller'}
                    </p>
                    {product.store?.campus && (
                      <p className="text-[10px] text-primary font-medium mb-2 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                        {product.store.campus}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-bold text-foreground">
                        ₵{product.price.toFixed(2)}
                      </p>
                      <Button size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => handleAddToCart(product.id)}>
                        <ShoppingCart className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <PaginationEllipsis key={page} />;
                    }
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Products;
