CREATE policy "Users can only see items in their group"
ON public.items
FOR SELECT
TO authenticated
USING (
  group_id IN (
    SELECT gm.group_id FROM public.group_members AS gm
    WHERE gm.user_id = (SELECT auth.uid())
  )
);
