import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Search, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  name: string;
  category: string | null;
  last_contact: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs ya en la red, para excluirlos del listado */
  excludeIds: string[];
  /** Callback tras añadir uno */
  onAdded: () => void;
}

export function AddToNetworkDialog({ open, onOpenChange, excludeIds, onAdded }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    if (!open || !user) return;
    let cancel = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("people_contacts")
          .select("id,name,category,last_contact")
          .eq("user_id", user.id)
          .order("last_contact", { ascending: false, nullsFirst: false })
          .limit(50);
        if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
        const { data, error } = await q;
        if (error) throw error;
        if (!cancel) {
          setResults((data || []).filter((c) => !excludeSet.has(c.id)) as Candidate[]);
        }
      } catch (e) {
        if (!cancel)
          toast.error("Error buscando contactos", {
            description: e instanceof Error ? e.message : String(e),
          });
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 200);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [open, search, user, excludeSet]);

  async function add(c: Candidate) {
    setAdding(c.id);
    try {
      const { error } = await supabase
        .from("people_contacts")
        .update({ in_strategic_network: true })
        .eq("id", c.id);
      if (error) throw error;
      toast.success(`${c.name} añadido a tu red estratégica`);
      setResults((r) => r.filter((x) => x.id !== c.id));
      onAdded();
    } catch (e) {
      toast.error("No se pudo añadir", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <UserPlus className="w-5 h-5 text-primary" />
            Añadir a tu red estratégica
          </DialogTitle>
          <DialogDescription>
            Elige los contactos que quieres vigilar. Solo estos aparecerán en /red-estrategica
            y se actualizarán al pulsar "Actualizar novedades".
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              {search.trim()
                ? "Sin resultados. Prueba con otro nombre."
                : "Todos tus contactos están ya en la red, o aún no tienes contactos."}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {results.map((c) => {
                const initials = c.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() || "")
                  .join("");
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-primary/5 rounded-md transition"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold font-display shrink-0">
                      {initials || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.category || "Sin categoría"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("h-8 gap-1 shrink-0", adding === c.id && "opacity-60")}
                      disabled={adding === c.id}
                      onClick={() => add(c)}
                    >
                      {adding === c.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Añadir
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
