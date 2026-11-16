        <SimilarProducts
          currentProductId={product.id}
          category={product.category}
          price={product.price}
        />

        <div className="mt-8 md:mt-12">
          <ProductReviews productId={product.id} />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
