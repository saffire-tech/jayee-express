import { useParams } from 'react-router-dom';
import ProductDetail from './ProductDetail';
import ProductReviews from '@/components/product/ProductReviews';

export default function ProductDetailWithReviews() {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <ProductDetail />
      {id && <ProductReviews productId={id} />}
    </>
  );
}
