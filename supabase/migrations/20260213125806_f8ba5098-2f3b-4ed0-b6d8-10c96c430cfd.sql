
-- Drop the redundant/conflicting SELECT policy
DROP POLICY IF EXISTS "Buyers can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Organizers can view all tickets" ON public.tickets;

-- Create a single clean SELECT policy using auth.email() directly
CREATE POLICY "Users can view own tickets or organizers view all"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  holder_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR has_role(auth.uid(), 'organizer'::app_role)
);
