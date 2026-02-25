CREATE POLICY "Users can only see item claims of their group"
ON public.item_claims
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.items AS i
    JOIN public.group_members AS gm 
      ON gm.group_id = i.group_id
    WHERE
      i.id = item_id AND
      gm.user_id = (SELECT auth.uid())
  )
);
