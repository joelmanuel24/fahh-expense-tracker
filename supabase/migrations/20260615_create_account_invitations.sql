-- Create account_invitations table
CREATE TABLE IF NOT EXISTS public.account_invitations (
  id uuid PRIMARY KEY,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  invitee_email text NOT NULL,
  inviter_email text NOT NULL,
  inviter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for account_invitations
DROP POLICY IF EXISTS "Users can view and manage their invitations" ON public.account_invitations;
CREATE POLICY "Users can view and manage their invitations" ON public.account_invitations
  FOR ALL TO authenticated
  USING (
    auth.uid() = inviter_id OR 
    LOWER(invitee_email) = LOWER(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    auth.uid() = inviter_id OR 
    LOWER(invitee_email) = LOWER(auth.jwt() ->> 'email')
  );

-- Trigger to update timestamp
DROP TRIGGER IF EXISTS set_timestamp_account_invitations ON public.account_invitations;
CREATE TRIGGER set_timestamp_account_invitations
BEFORE UPDATE ON public.account_invitations
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Update collaborators table INSERT policy to allow invited users to accept
DROP POLICY IF EXISTS "Allow insert for account owner" ON public.collaborators;
CREATE POLICY "Allow insert for account owner and invitees" ON public.collaborators
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Case 1: Inserter is the owner of the account
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = collaborators.account_id 
        AND accounts.owner_id = auth.uid()
    )
    OR
    -- Case 2: Inserter is the invitee accepting a pending invitation
    (
      collaborators.user_id = auth.uid() 
      AND EXISTS (
        SELECT 1 FROM public.account_invitations 
        WHERE account_invitations.account_id = collaborators.account_id 
          AND LOWER(account_invitations.invitee_email) = LOWER(auth.jwt() ->> 'email') 
          AND account_invitations.status = 'pending'
      )
    )
  );

