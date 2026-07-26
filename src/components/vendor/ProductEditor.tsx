import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { saveLocalProduct } from "@/lib/mock-products";

const productSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  price_pkr: z.coerce.number().min(1, "Price must be greater than 0"),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  manufacturer: z.string().optional(),
  color: z.string().optional(),
  availability: z.enum(["in_stock", "on_demand", "coming_soon", "obsolete"]),
  discount_pct: z.coerce.number().min(0).max(100).optional(),
});

type ProductValues = z.infer<typeof productSchema>;

export function ProductEditor({
  vendorId,
  product,
  open,
  onOpenChange,
}: {
  vendorId: string;
  product?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const form = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      title: product?.title || "",
      description: product?.description || "",
      category: product?.category || "",
      price_pkr: product?.price_pkr || 0,
      stock: product?.stock || 0,
      image_url: product?.image_url || "",
      manufacturer: product?.manufacturer || "",
      color: product?.color || "",
      availability: product?.availability || "in_stock",
      discount_pct: product?.discount_pct || 0,
    },
  });

  // reset form when product changes
  useState(() => {
    if (product) {
      form.reset(product);
    } else {
      form.reset({
        title: "",
        description: "",
        category: "",
        price_pkr: 0,
        stock: 0,
        image_url: "",
        manufacturer: "",
        color: "",
        availability: "in_stock",
        discount_pct: 0,
      });
    }
  }, [product, form]);

  const onSubmit = async (values: ProductValues) => {
    if (!vendorId) return toast.error("Vendor ID is missing");
    setLoading(true);

    try {
      const slug = values.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      const payload = {
        ...values,
        vendor_id: vendorId,
      };

      if (product?.id) {
        // Edit
        try {
          const { error } = await supabase
            .from("products")
            .update(payload)
            .eq("id", product.id)
            .eq("vendor_id", vendorId);
          if (error) throw error;
          toast.success("Product updated successfully (Database)");
        } catch (err: any) {
          console.warn("Supabase update failed, falling back to local storage:", err);
          const localProduct = {
            ...product,
            ...payload,
            price_pkr: Number(payload.price_pkr) || 0,
            stock: Number(payload.stock) || 0,
            discount_pct: Number(payload.discount_pct) || 0,
          };
          saveLocalProduct(localProduct as any);
          toast.success("Product updated successfully (Local Storage)");
        }
      } else {
        // Add
        const newSlug = `${slug}-${Math.floor(Math.random() * 10000)}`;
        try {
          const { error } = await supabase.from("products").insert({
            ...payload,
            slug: newSlug,
          });
          if (error) throw error;
          toast.success("Product added successfully (Database)");
        } catch (err: any) {
          console.warn("Supabase insert failed, falling back to local storage:", err);
          const localProduct = {
            id: `mock-${Date.now()}`,
            title: payload.title || "",
            slug: newSlug,
            description: payload.description || "",
            category: payload.category || "Components",
            price_pkr: Number(payload.price_pkr) || 0,
            stock: Number(payload.stock) || 0,
            image_url: payload.image_url || "",
            manufacturer: payload.manufacturer || "",
            discount_pct: Number(payload.discount_pct) || 0,
            availability: payload.availability || "in_stock",
            rating: 4.5,
            color: payload.color || "",
            vendor_id: vendorId || "demo-vendor",
            gallery_urls: [],
            specs: {},
          };
          saveLocalProduct(localProduct as any);
          toast.success("Product added successfully (Local Storage)");
        }
      }

      qc.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Update your product details below."
              : "Fill in the details to list a new product in your store."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Title</Label>
              <Input {...form.register("title")} placeholder="e.g. Smart Wi-Fi Plug" />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Describe the product..." />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input {...form.register("category")} placeholder="e.g. Smart Home" />
              {form.formState.errors.category && (
                <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Image URL (Optional)</Label>
              <Input {...form.register("image_url")} placeholder="https://..." />
              {form.formState.errors.image_url && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.image_url.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Price (PKR)</Label>
              <Input type="number" {...form.register("price_pkr")} />
              {form.formState.errors.price_pkr && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.price_pkr.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Stock</Label>
              <Input type="number" {...form.register("stock")} />
              {form.formState.errors.stock && (
                <p className="text-xs text-destructive">{form.formState.errors.stock.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Manufacturer (Optional)</Label>
              <Input {...form.register("manufacturer")} />
            </div>

            <div className="space-y-2">
              <Label>Color (Optional)</Label>
              <Input {...form.register("color")} />
            </div>

            <div className="space-y-2">
              <Label>Availability</Label>
              <Select
                value={form.watch("availability")}
                onValueChange={(val: any) => form.setValue("availability", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="on_demand">On Demand</SelectItem>
                  <SelectItem value="coming_soon">Coming Soon</SelectItem>
                  <SelectItem value="obsolete">Obsolete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Discount % (Optional)</Label>
              <Input type="number" {...form.register("discount_pct")} />
            </div>
          </div>

          <div className="flex justify-end pt-4 gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
