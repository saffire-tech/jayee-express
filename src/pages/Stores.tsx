import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SEO from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LocationSelector from '@/components/ui/LocationSelector';
import { Search, Store, MapPin, Verified, X, SlidersHorizontal, Eye } from 'lucide-react';
import { StoreGridSkeleton } from '@/components/ui/skeletons';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface StoreData {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  location: string | null;
  campus: string | null;
  is_verified: boolean | null;
  total_views: number | null;
  product_count?: number;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
  { value: 'top-sales', label: 'Top Sales' },
];

const fetchAllStores = async (): Promise<StoreData[]> => {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, description, logo_url, cover_url, location, campus, is_verified, total_views')
    .eq('is_active', true)
    .eq('is_verified', true)
    .eq('is_suspended', false);

  if (error) throw error;

  // Fetch product counts for each store in parallel
  const storesWithCounts = await Promise.all(
    (data || []).map(async (store) => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('is_active', true);
      
      return { ...store, product_count: count || 0 };
    })
  );
  
  return storesWithCounts;
};

const ITEMS_PER_PAGE = 9;

const Stores = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCampus, setSelectedCampus] = useState(searchParams.get('campus') || 'All');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [showFilters, setShowFilters] = useState(false);

  // Sync URL params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedCampus !== 'All') params.set('campus', selectedCampus);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (currentPage > 1) params.set('page', String(currentPage));
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCampus, sortBy, currentPage, setSearchParams]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCampus, sortBy]);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['all-stores'],
    queryFn: fetchAllStores,
    staleTime: 1000 * 60 * 5,
  });

  const filteredAndSortedStores = useMemo(() => {
    let result = [...stores];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.location?.toLowerCase().includes(query) ||
        s.campus?.toLowerCase().includes(query)
      );
    }

    // Filter by campus
    if (selectedCampus !== 'All') {
      result = result.filter(s => s.campus === selectedCampus);
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        result.reverse();
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'top-sales':
        // Already sorted by product count as proxy for sales
        result.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
        break;
    }

    return result;
  }, [stores, searchQuery, selectedCampus, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedStores.length / ITEMS_PER_PAGE);
  const paginatedStores = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedStores.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedStores, currentPage]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCampus('All');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedCampus !== 'All' || sortBy !== 'newest';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Browse Local Stores | Jayee Express"
        description="Discover verified community stores in Ghana. Browse local entrepreneurs, hustles, and shops on Jayee Express."
        canonicalPath="/stores"
      />
      <Navbar />
      
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Browse Stores</h1>
          <p className="text-muted-foreground">
            Discover amazing stores from local sellers
          </p>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores..."
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
            </div>
          )}
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-6">
          {filteredAndSortedStores.length} {filteredAndSortedStores.length === 1 ? 'store' : 'stores'} found
        </p>

        {/* Stores Grid */}
        {isLoading ? (
          <StoreGridSkeleton count={6} />
        ) : filteredAndSortedStores.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-xl mb-2">No stores found</h3>
            <p className="text-muted-foreground mb-6">
              {hasActiveFilters 
                ? 'Try adjusting your filters or search query'
                : 'Be the first to create your store on Jayee Express!'}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters}>Clear Filters</Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
              {paginatedStores.map((store) => (
                <div
                  key={store.id}
                  className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card-hover w-[calc(50%-6px)] sm:w-auto"
                >
                  {/* Cover Image */}
                  <div className="relative h-24 sm:h-28 overflow-hidden bg-muted">
                    {store.cover_url ? (
                      <img
                        src={store.cover_url}
                        alt={store.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="relative p-3 pt-0">
                    {/* Avatar */}
                    <div className="relative -mt-6 mb-2">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 border-card shadow-md bg-muted flex items-center justify-center overflow-hidden">
                        {store.logo_url ? (
                          <img
                            src={store.logo_url}
                            alt={store.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Store className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      {store.is_verified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full gradient-primary flex items-center justify-center">
                          <Verified className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-foreground mb-0.5 group-hover:text-primary transition-colors line-clamp-1">
                      {store.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                      {store.description || 'No description'}
                    </p>

                    {/* Meta */}
                    <div className="flex flex-col gap-1 mb-2">
                      {store.campus && (
                        <div className="flex items-center gap-1 text-xs text-primary font-medium">
                          <MapPin className="h-3 w-3" />
                          <span>{store.campus}</span>
                        </div>
                      )}
                      {store.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="line-clamp-1">{store.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{store.product_count} {store.product_count === 1 ? 'product' : 'products'}</span>
                        {(store.total_views ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {store.total_views}
                          </span>
                        )}
                      </div>
                      <Link to={`/store/${store.slug || store.id}`}>
                        <Button size="sm" className="h-7 px-2 text-xs">Visit</Button>
                      </Link>
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

export default Stores;