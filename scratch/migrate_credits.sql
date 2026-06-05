-- CREATE CREDITS TABLE IN PUBLIC SCHEMA
CREATE TABLE IF NOT EXISTS public.credits (
  id uuid PRIMARY KEY,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  amount numeric NOT NULL,
  description text,
  date date NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  owner_id uuid REFERENCES auth.users(id)
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY FOR USER ACCESS SCOPING
DROP POLICY IF EXISTS "Users can manage their own credits" ON public.credits;
CREATE POLICY "Users can manage their own credits" ON public.credits
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- CREATE TIMESTAMP UPDATE TRIGGER FUNCTION AND TRIGGER
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_credits ON public.credits;
CREATE TRIGGER set_timestamp_credits
BEFORE UPDATE ON public.credits
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();
