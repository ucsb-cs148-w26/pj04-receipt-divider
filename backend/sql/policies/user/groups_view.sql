CREATE policy "Enable users to view their group only"
ON public.groups
FOR SELECT
TO authenticated
USING (
  id IN (SELECT public.get_user_group_ids())
);
