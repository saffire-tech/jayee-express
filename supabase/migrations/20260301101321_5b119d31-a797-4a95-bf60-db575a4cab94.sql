-- Drop the campus check constraint to allow community location values
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_campus_check;