import { useQuery } from "@tanstack/react-query";
import { fetchProductBySlug, fetchRelatedProducts } from "@/api/products";
import { fetchProductReviews } from "@/api/reviews";

export function useProduct(slug: string) {
  const product = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProductBySlug(slug),
    enabled: !!slug,
  });

  const productId = product.data?.id;
  const category = product.data?.category;

  const reviews = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => (productId ? fetchProductReviews(productId) : Promise.resolve([])),
    enabled: !!productId,
  });

  const related = useQuery({
    queryKey: ["related", category, productId],
    queryFn: () =>
      category && productId ? fetchRelatedProducts(category, productId) : Promise.resolve([]),
    enabled: !!category && !!productId,
  });

  return { product, reviews, related };
}
