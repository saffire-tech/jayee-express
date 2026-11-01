import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export interface PickedVariant {
  variantId: string;
  color: string | null;
  size: string | null;
  material: string | null;
}

interface Variant {
  id: string;
  color: string | null;
  size: string | null;
  material: string | null;
  stock: number;
}

interface Props {
  productId: string | null;
  productName?: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (variant: PickedVariant) => void;
}

const norm = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

const VariantPickerDialog = ({ productId, productName, open, onCancel, onConfirm }: Props) => {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [material, setMaterial] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !productId) return;
    setColor(null);
    setSize(null);
    setMaterial(null);
    setLoading(true);
    supabase
      .from("product_variants")
      .select("id, color, size, material, stock")
      .eq("product_id", productId)
      .then(({ data }) => {
        setVariants(
          ((data as Variant[]) || []).map((v) => ({
            ...v,
            color: norm(v.color),
            size: norm(v.size),
            material: norm(v.material),
          }))
        );
        setLoading(false);
      });
  }, [open, productId]);

  const options = (key: "color" | "size" | "material") =>
    Array.from(new Set(variants.map((v) => v[key]).filter(Boolean))) as string[];

  const colors = useMemo(() => options("color"), [variants]);
  const sizes = useMemo(() => options("size"), [variants]);
  const materials = useMemo(() => options("material"), [variants]);

  // Every attribute that exists on this product must be chosen.
  const complete =
    (colors.length === 0 || !!color) && (sizes.length === 0 || !!size) && (materials.length === 0 || !!material);

  const selected = useMemo(
    () =>
      complete
        ? variants.find(
            (v) =>
              (colors.length === 0 || v.color === color) &&
              (sizes.length === 0 || v.size === size) &&
              (materials.length === 0 || v.material === material)
          ) || null
        : null,
    [complete, variants, color, size, material, colors.length, sizes.length, materials.length]
  );

  // Is a given option still part of any in-stock combination given other picks?
  const optionAvailable = (key: "color" | "size" | "material", value: string) =>
    variants.some(
      (v) =>
        v[key] === value &&
        v.stock > 0 &&
        (key === "color" || !color || v.color === color) &&
        (key === "size" || !size || v.size === size) &&
        (key === "material" || !material || v.material === material)
    );

  const renderGroup = (
    label: string,
    key: "color" | "size" | "material",
    values: string[],
    current: string | null,
    set: (v: string | null) => void
  ) =>
    values.length > 0 && (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={current === value ? "default" : "outline"}
              disabled={!optionAvailable(key, value) && current !== value}
              onClick={() => set(current === value ? null : value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>
    );

  const outOfStock = complete && selected && selected.stock <= 0;
  const noMatch = complete && !selected;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your preferred variant</DialogTitle>
          <DialogDescription>
            {productName ? `"${productName}" comes in different options. ` : ""}Pick the one you want before continuing.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {renderGroup("Color", "color", colors, color, setColor)}
            {renderGroup("Size", "size", sizes, size, setSize)}
            {renderGroup("Material", "material", materials, material, setMaterial)}
            {noMatch && <p className="text-sm text-destructive">That combination isn't available. Try another.</p>}
            {outOfStock && <p className="text-sm text-destructive">That variant is out of stock.</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={loading || !selected || selected.stock <= 0}
            onClick={() =>
              selected &&
              onConfirm({
                variantId: selected.id,
                color: selected.color,
                size: selected.size,
                material: selected.material,
              })
            }
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VariantPickerDialog;
