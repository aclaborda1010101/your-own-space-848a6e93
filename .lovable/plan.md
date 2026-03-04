

## Plan: Upload ManIAS logo to Supabase Storage and update cover

The logo needs to be at `project-documents/assets/manias-logo.png` in Supabase Storage for the PDF generator to use it. Since I cannot directly upload binary files to storage, I will:

### Steps

1. **Create a one-shot upload edge function** (`upload-logo`) that:
   - Fetches the logo from the app's preview URL (`/manias-logo.png`)
   - Uploads it to `project-documents/assets/manias-logo.png` in Supabase Storage
   - Returns success/failure

2. **Call the edge function** via `curl_edge_functions` to trigger the upload

3. **Delete the upload edge function** after successful upload (it's single-use)

4. **Update the cover page CSS** — The current logo has a dark background (#0A3039). The cover page needs a dark header section to display it properly, matching the DOCX template style:
   - Add a dark header bar at the top of the cover with the logo image
   - Place the document title below the logo on white background

### Alternative considered
Embedding as base64 would add ~50KB+ to the function code on every PDF render. External URL from storage is cleaner.

