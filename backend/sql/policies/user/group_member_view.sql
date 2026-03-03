CREATE policy "Users can only view their group members"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  group_id IN (SELECT public.get_user_group_ids()) 
);
