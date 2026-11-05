DELETE FROM public.locations WHERE city IN ('Tamale','Wa');
UPDATE public.profiles SET city='Accra' WHERE city IS DISTINCT FROM 'Accra';