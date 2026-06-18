-- supabase/migrations/20260618000000_delete_user_rpc.sql

-- Creates an RPC function to allow users to securely delete their own account.
-- Since the `user_app_state` table has `ON DELETE CASCADE` foreign key for `user_id`,
-- deleting the user from `auth.users` will automatically delete all their app data too.

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Deletes the currently authenticated user from auth.users.
  -- This requires SECURITY DEFINER to bypass RLS restrictions on auth.users.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION delete_user() FROM public;
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
