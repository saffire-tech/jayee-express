import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

interface ProductReviewsProps {
  productId: string;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligible, setEligible] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionRow, setActionRow] = useState<HTMLElement | null>(null);

  const myReview = user ? reviews.find((review) => review.user_id === user.id) : undefined;
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  // Mount the trigger in the existing product action row, beside Add to Cart,
  // Contact Seller, and Share. ProductDetail renders after the route wrapper,
  // so watch for the Share control to appear before attaching the portal.
  useEffect(() => {
    let mountedRow: HTMLElement | null = null;
    const locateActionRow = () => {
      const shareButton = Array.from(document.querySelectorAll('button')).find((button) =>
        Array.from(button.querySelectorAll('span')).some((span) => span.textContent?.trim() === 'Share'),
      );
      const row = shareButton?.parentElement;
      if (!row || row === mountedRow) return false;
      mountedRow = row;
      setActionRow(row);
      return true;
    };

    if (locateActionRow()) return;
    const observer = new MutationObserver(() => {
      if (locateActionRow()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    const loadEligibility = async () => {
      setEligibilityLoading(true);
      if (!user) {
        setEligible(false);
        setEligibilityLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_items!inner(product_id)')
        .eq('buyer_id', user.id)
        .eq('payment_status', 'paid')
        .eq('order_items.product_id', productId)
        .limit(1);

      if (!cancelled) {
        if (error) {
          console.error('Error checking product purchase eligibility:', error);
          setEligible(false);
        } else {
          setEligible((data || []).length > 0);
        }
        setEligibilityLoading(false);
      }
    };

    void loadEligibility();
    return () => { cancelled = true; };
  }, [productId, user]);

  useEffect(() => {
    let cancelled = false;
    const loadReviews = async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching product reviews:', error);
        return;
      }

      const userIds = [...new Set((data || []).map((review) => review.user_id))];
      const { data: profiles } = userIds.length
        ? await (supabase as any)
            .from('public_profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', userIds)
        : { data: [] };

      if (cancelled) return;
      const withProfiles = (data || []).map((review) => ({
        ...review,
        profile: profiles?.find((profile: any) => profile.user_id === review.user_id),
      })) as Review[];
      setReviews(withProfiles);
      const mine = user ? withProfiles.find((review) => review.user_id === user.id) : undefined;
      setRating(mine?.rating ?? 5);
      setComment(mine?.comment || '');
    };

    void loadReviews();
    return () => { cancelled = true; };
  }, [productId, user]);

  const submitReview = async () => {
    if (!user || !eligible) return;
    setSubmitting(true);

    const result = myReview
      ? await supabase.from('reviews').update({ rating, comment: comment.trim() || null }).eq('id', myReview.id)
      : await supabase.from('reviews').insert({ product_id: productId, user_id: user.id, rating, comment: comment.trim() || null });

    if (result.error) {
      console.error('Error saving product review:', result.error);
      toast.error(result.error.code === '42501'
        ? 'A paid purchase of this product is required to review it.'
        : 'Could not save your review. Please try again.');
    } else {
      toast.success(myReview ? 'Review updated' : 'Review submitted');
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (!error) {
        const userIds = [...new Set((data || []).map((review) => review.user_id))];
        const { data: profiles } = userIds.length
          ? await (supabase as any).from('public_profiles').select('user_id, full_name, avatar_url').in('user_id', userIds)
          : { data: [] };
        setReviews((data || []).map((review) => ({
          ...review,
          profile: profiles?.find((profile: any) => profile.user_id === review.user_id),
        })) as Review[]);
      }
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {actionRow && createPortal(
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="lg">
            <Star className="mr-2 h-4 w-4" />
            Reviews & ratings ({reviews.length})
          </Button>
        </DialogTrigger>,
        actionRow,
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customer reviews & ratings</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-primary text-primary" />{reviews.length ? averageRating.toFixed(1) : '—'}</span>
            <span>·</span>
            <span>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {eligibilityLoading ? (
            <p className="text-sm text-muted-foreground">Checking purchase eligibility…</p>
          ) : user && eligible ? (
            <Card>
              <CardHeader><CardTitle className="text-lg">{myReview ? 'Update your review' : 'Write a review'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div role="group" aria-label="Choose a rating" className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={rating === value} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Star className={`h-6 w-6 ${value <= rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
                <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share your experience (optional)" maxLength={2000} aria-label="Review comment" />
                <Button onClick={submitReview} disabled={submitting}>{submitting ? 'Saving…' : myReview ? 'Update review' : 'Submit review'}</Button>
              </CardContent>
            </Card>
          ) : user ? (
            <p className="text-sm text-muted-foreground">Purchase this product to leave a review.</p>
          ) : (
            <p className="text-sm text-muted-foreground"><Link className="text-primary underline" to="/auth">Sign in</Link> and purchase this product to leave a review.</p>
          )}

          {reviews.length === 0 ? (
            <p className="text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const name = review.profile?.full_name || 'Customer';
                return (
                  <Card key={review.id}>
                    <CardContent className="flex gap-3 p-4">
                      <Avatar><AvatarImage src={review.profile?.avatar_url || undefined} alt="" /><AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{name}</p>
                          <time className="text-xs text-muted-foreground" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time>
                        </div>
                        <div className="mt-1 flex" aria-label={`${review.rating} out of 5 stars`}>
                          {[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`h-4 w-4 ${value <= review.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />)}
                        </div>
                        {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{review.comment}</p>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
