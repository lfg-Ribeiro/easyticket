
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('organizer', 'user');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  cpf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  location TEXT NOT NULL,
  venue TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Outros',
  cover_image_url TEXT,
  fee_absorbed BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 5. Create ticket_batches table
CREATE TABLE public.ticket_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_batches ENABLE ROW LEVEL SECURITY;

-- 6. Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_cpf TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  service_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  payment_status TEXT NOT NULL DEFAULT 'confirmed',
  transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 7. Create tickets table (individual tickets with QR)
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.ticket_batches(id) ON DELETE SET NULL,
  qr_code TEXT NOT NULL UNIQUE,
  holder_name TEXT NOT NULL,
  holder_email TEXT NOT NULL,
  check_in_status TEXT NOT NULL DEFAULT 'valid' CHECK (check_in_status IN ('valid', 'used', 'invalid')),
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- 8. Helper functions (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_event_organizer(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = _event_id AND organizer_id = auth.uid()
  )
$$;

-- 9. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 10. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth_id = auth.uid());

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Events: anyone can read published events, organizers manage their own
CREATE POLICY "Anyone can view published events" ON public.events
  FOR SELECT USING (published = true);
CREATE POLICY "Organizers can view own events" ON public.events
  FOR SELECT TO authenticated USING (organizer_id = auth.uid());
CREATE POLICY "Organizers can create events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (
    organizer_id = auth.uid() AND public.has_role(auth.uid(), 'organizer')
  );
CREATE POLICY "Organizers can update own events" ON public.events
  FOR UPDATE TO authenticated USING (organizer_id = auth.uid());
CREATE POLICY "Organizers can delete own events" ON public.events
  FOR DELETE TO authenticated USING (organizer_id = auth.uid());

-- Ticket batches: public read for published events, organizer CRUD
CREATE POLICY "Anyone can view batches for published events" ON public.ticket_batches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND published = true)
  );
CREATE POLICY "Organizers can manage batches" ON public.ticket_batches
  FOR ALL TO authenticated USING (
    public.is_event_organizer(event_id)
  ) WITH CHECK (
    public.is_event_organizer(event_id)
  );

-- Orders: organizer reads orders for their events. Insert handled by edge function.
CREATE POLICY "Organizers can view orders for their events" ON public.orders
  FOR SELECT TO authenticated USING (
    public.is_event_organizer(event_id)
  );

-- Tickets: organizer reads/updates for their events. Insert handled by edge function.
CREATE POLICY "Organizers can view tickets for their events" ON public.tickets
  FOR SELECT TO authenticated USING (
    public.is_event_organizer(event_id)
  );
CREATE POLICY "Organizers can update tickets for their events" ON public.tickets
  FOR UPDATE TO authenticated USING (
    public.is_event_organizer(event_id)
  );

-- 12. Storage bucket for event covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true);

CREATE POLICY "Anyone can view event covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-covers');
CREATE POLICY "Authenticated users can upload event covers" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-covers');
CREATE POLICY "Authenticated users can update own event covers" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'event-covers');
CREATE POLICY "Authenticated users can delete own event covers" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'event-covers');

-- 13. Enable realtime for tickets (for check-in updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
