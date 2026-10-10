import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MultiImageUpload from "./MultiImageUpload";
import type { Product } from "@/hooks/useStore";

const categories = [
  "Food",
  "Fashion",
  "Electronics",
  "Water",
  "Stationary",
  "Cosmetics",
  "Photography",
];

export interface ProductVariantInput {
  color: string;
  size: string;
  material: string;
  stock: number;
  imageUrl?: string | null;
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: Omit<Product, "id" | "store_id" | "views" | "created_at" | "updated_at"> & { variants?: ProductVariantInput[] }) => Promise<void>;
  onCancel: () => void;
}

const ProductForm = ({ product, onSubmit, onCancel }: ProductFormProps) => {
  const [loading, setLoading] = useState(false);
  
  // Variants state management
  const [variants, setVariants] = useState<ProductVariantInput[]>([]);
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newMaterial, setNewMaterial] = useState("");
  const [newStock, setNewStock] = useState(0);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Fetch existing variants when editing a product
  useEffect(() => {
    if (product?.id) {
      const fetchExistingVariants = async () => {
        const { data, error } = await supabase
          .from('product_variants')
          .select('color, size, material, stock, image_url')
          .eq('product_id', product.id);

        if (!error && data) {
          setVariants(
            data.map(v => ({
              color: v.color || "",
              size: v.size || "",
              material: v.material || "",
              stock: v.stock || 0,
              imageUrl: (v as any).image_url || null,
            }))
          );
        }
      };
      fetchExistingVariants();
    }
  }, [product?.id]);

  // Initialize images from product.images or fallback to image_url
  const getInitialImages = () => {
    if (product?.images && product.images.length > 0) {
      return product.images;
    }
    if (product?.image_url) {
      return [product.image_url];
    }
    return [];
  };

  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price?.toString() || "",
    category: product?.category || "",
    images: getInitialImages(),
    is_service: product?.is_service || false,
    is_active: product?.is_active ?? true,
    stock: product?.stock?.toString() || "0",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        category: formData.category,
        image_url: formData.images[0] || null,
        images: formData.images,
        is_service: formData.is_service,
        is_active: formData.is_active,
        stock: parseInt(formData.stock) || 0,
        variants: variants,
      });
    } finally {
      setLoading(false);
    }
  };

  const isValid = formData.name && formData.price && formData.category;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {product ? "Edit Product" : "Add New Product"}
        </h3>
        <button type="button" onClick={onCancel} className="p-2 hover:bg-muted rounded-lg">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Image Upload - Full width */}
        <div className="md:col-span-2">
          <Label>Product Images (Max 5)</Label>
          <div className="mt-1">
            <MultiImageUpload
              currentImages={formData.images}
              onImagesChanged={(urls) => setFormData({ ...formData, images: urls })}
              maxImages={5}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Homemade Chin-Chin"
            className="mt-1"
            required
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your product or service..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="price">Price (₵) *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="0.00"
            className="mt-1"
            required
          />
        </div>

        <div>
          <Label htmlFor="category">Category *</Label>
          <Select 
            value={formData.category} 
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border">
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="stock">Base Stock Quantity</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            placeholder="0"
            className="mt-1"
            disabled={formData.is_service}
          />
        </div>

        {/* Product Variants Section with Image URL */}
        <div className="md:col-span-2 border p-4 rounded-lg space-y-4 bg-card">
          <div>
            <h4 className="font-medium">Product Specifications & Variations</h4>
            <p className="text-sm text-muted-foreground">Add sizes, colors, materials, stock options, and specific variant images.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
            <Input
              placeholder="Color (e.g. Black)"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            />
            <Input
              placeholder="Size (e.g. 42)"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
            />
            <Input
              placeholder="Material"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
            />
            <Input
              type="number"
              min="0"
              placeholder="Stock Qty"
              value={newStock}
              onChange={(e) => setNewStock(Number(e.target.value))}
            />
            <Input
              placeholder="Image URL"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!newColor && !newSize && !newMaterial) return;
              setVariants([...variants, { 
                color: newColor, 
                size: newSize, 
                material: newMaterial, 
                stock: newStock,
                imageUrl: newImageUrl || null 
              }]);
              setNewColor("");
              setNewSize("");
              setNewMaterial("");
              setNewStock(0);
              setNewImageUrl("");
            }}
          >
            + Add Variant Combination
          </Button>

          {variants.length > 0 && (
            <div className="space-y-2 mt-2">
              {variants.map((v, index) => (
                <div key={index} className="flex justify-between items-center bg-muted p-2 rounded text-sm">
                  <div className="flex items-center gap-3">
                    {v.imageUrl && (
                      <img src={v.imageUrl} alt="Variant" className="h-8 w-8 rounded object-cover" />
                    )}
                    <span>
                      Color: {v.color || 'N/A'} | Size: {v.size || 'N/A'} | Material: {v.material || 'N/A'} | Stock: {v.stock}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVariants(variants.filter((_, i) => i !== index))}
                    className="text-destructive text-xs hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="font-medium">This is a service</p>
            <p className="text-sm text-muted-foreground">No stock tracking needed</p>
          </div>
          <Switch
            checked={formData.is_service}
            onCheckedChange={(checked) => setFormData({ ...formData, is_service: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="font-medium">Active listing</p>
            <p className="text-sm text-muted-foreground">Visible to customers</p>
          </div>
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="hero" disabled={!isValid || loading} className="flex-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {product ? "Update" : "Add Product"}
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;
