
-- Update SELECT policy to allow shared access via resource_shares
DROP POLICY IF EXISTS "Users can view their own plaud transcriptions" ON public.plaud_transcriptions;
CREATE POLICY "Users can view own or shared plaud transcriptions"
  ON public.plaud_transcriptions FOR SELECT
  USING (
    auth.uid() = user_id 
    OR has_shared_access(auth.uid(), 'plaud_transcription', id)
  );

-- Update UPDATE policy to allow shared edit access
DROP POLICY IF EXISTS "Users can update their own plaud transcriptions" ON public.plaud_transcriptions;
CREATE POLICY "Users can update own or shared plaud transcriptions"
  ON public.plaud_transcriptions FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR has_shared_edit_access(auth.uid(), 'plaud_transcription', id)
  );
