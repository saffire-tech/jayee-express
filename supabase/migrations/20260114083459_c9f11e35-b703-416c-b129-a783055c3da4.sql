-- Create store_web_services table for external service links
CREATE TABLE public.store_web_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  icon TEXT DEFAULT 'link',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_web_services ENABLE ROW LEVEL SECURITY;

-- Anyone can view active web services
CREATE POLICY "Active web services are viewable by everyone"
  ON public.store_web_services FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_web_services.store_id 
    AND stores.user_id = auth.uid()
  ));

-- Store owners can create web services
CREATE POLICY "Store owners can create web services"
  ON public.store_web_services FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_web_services.store_id 
    AND stores.user_id = auth.uid()
  ));

-- Store owners can update their web services
CREATE POLICY "Store owners can update web services"
  ON public.store_web_services FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_web_services.store_id 
    AND stores.user_id = auth.uid()
  ));

-- Store owners can delete their web services
CREATE POLICY "Store owners can delete web services"
  ON public.store_web_services FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_web_services.store_id 
    AND stores.user_id = auth.uid()
  ));

-- Admins can manage all web services
CREATE POLICY "Admins can manage all web services"
  ON public.store_web_services FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_store_web_services_updated_at
  BEFORE UPDATE ON public.store_web_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();