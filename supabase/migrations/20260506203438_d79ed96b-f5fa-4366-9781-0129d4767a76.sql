ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;
UPDATE public.orders SET platform_fee = service_fee WHERE platform_fee = 0 AND service_fee > 0;