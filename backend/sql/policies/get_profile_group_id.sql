CREATE OR REPLACE FUNCTION get_profile_group_ids()
RETURNS SETOF uuid AS $$
SELECT group_id FROM public.group_members
  WHERE profile_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
