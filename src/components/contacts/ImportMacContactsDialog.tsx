import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseMacContactsCSV, type ParsedMacContact } from "@/lib/contacts-csv-mac";
import { convertContactsXlsxToCSVText } from "@/lib/xlsx-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportResult {
  enriched: number;
  created: number;
  skipped: number;
  collisionsResolved: number;
  ghostsMerged: number;
  touched: number;
  errors: string[];
}

export function ImportMacContactsDialog() {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedMacContact[] | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setParsed(null);
    setPreview(null);
    setResult(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    try {
      const isXlsx = /\.xlsx$/i.test(f.name);
      const text = isXlsx ? await convertContactsXlsxToCSVText(f) : await f.text();
      const contacts = parseMacContactsCSV(text);
      if (contacts.length === 0) {
        toast.error("No se encontraron contactos en el CSV");
        return;
      }
      setParsed(contacts);
      // Dry-run para preview
      const { data, error } = await supabase.functions.invoke("import-mac-contacts", {
        body: { contacts, dryRun: true },
      });
      if (error) throw error;
      setPreview(data as ImportResult);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error procesando CSV");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-mac-contacts", {
        body: { contacts: parsed, dryRun: false },
      });
      if (error) throw error;
      setResult(data as ImportResult);
      toast.success(`Importación completada: ${data.enriched} enriquecidos, ${data.created} creados`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error en la importación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" /> Importar contactos de Mac (CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contactos de Mac</DialogTitle>
          <DialogDescription>
            Sube el CSV exportado desde Contactos de Mac. Enriquecerá los contactos
            existentes con teléfonos y creará los nuevos sin duplicar.
          </DialogDescription>
        </DialogHeader>

        {!parsed && (
          <div className="space-y-3">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFile}
              disabled={loading}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizando…
              </div>
            )}
          </div>
        )}

        {parsed && preview && !result && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              <div>📄 <b>{parsed.length}</b> contactos en el CSV</div>
              <div>✏️ <b>{preview.enriched}</b> existentes a enriquecer (añadir teléfonos)</div>
              <div>➕ <b>{preview.created}</b> nuevos a crear</div>
              <div>⏭️ <b>{preview.skipped}</b> ya completos (sin cambios)</div>
              {preview.ghostsMerged > 0 && (
                <div className="text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <b>{preview.ghostsMerged}</b> duplicados fantasma se fusionarán
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={reset} disabled={loading}>Cancelar</Button>
              <Button onClick={runImport} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar importación
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Importación completada</span>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              <div>✏️ Enriquecidos: <b>{result.enriched}</b></div>
              <div>➕ Creados: <b>{result.created}</b></div>
              <div>⏭️ Sin cambios: <b>{result.skipped}</b></div>
              <div>🔗 Fantasmas fusionados: <b>{result.ghostsMerged}</b></div>
              <div>🧹 Caches IA limpiadas: <b>{result.touched}</b></div>
            </div>
            {result.errors.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary>Errores ({result.errors.length})</summary>
                <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}
            <div className="flex justify-end">
              <Button onClick={() => { setOpen(false); reset(); }}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
