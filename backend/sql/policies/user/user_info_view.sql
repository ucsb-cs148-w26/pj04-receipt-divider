CREATE POLICY "Users can users in the same group"
ON public.users_public_info
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members AS gm1
    JOIN public.group_members AS gm2
      ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = public.users_public_info.user_id
      AND gm2.user_id = (SELECT auth.uid())
  )
);
