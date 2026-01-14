-- Add image_url column to store_web_services for flyers/promotional images
ALTER TABLE public.store_web_services 
ADD COLUMN image_url TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.store_web_services.image_url IS 'URL for promotional flyer/image displayed when sharing the service on social media';