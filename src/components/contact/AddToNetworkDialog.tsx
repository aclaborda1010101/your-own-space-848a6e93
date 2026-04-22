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
import {
  Loader2,
  Search,
  Plus,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { z } from "zod";

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

const newContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "El nombre es obligatorio" })
    .max(100, { message: "Máximo 100 caracteres" }),
  phone: z
    .string()
    .trim()
    .min(7, { message: "Teléfono demasiado corto" })
    .max(20, { message: "Teléfono demasiado largo" })
    .regex(/^\+?[0-9\s\-()]{7,20}$/, {
      message: "Formato inválido. Usa solo números, espacios, + - ( )",
    }),
});

/** Normaliza a "+<dígitos>". Si no empieza por +, devuelve solo dígitos. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

export function AddToNetworkDialog({ open, onOpenChange, excludeIds, onAdded }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  // ── Crear nuevo contacto ──
  const [formOpen, setFormOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

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

  // Reset form al cerrar el diálogo
  useEffect(() => {
    if (!open) {
      setFormOpen(false);
      setNewName("");
      setNewPhone("");
      setCreating(false);
    }
  }, [open]);

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

  async function createAndAdd() {
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }

    const parsed = newContactSchema.safeParse({ name: newName, phone: newPhone });
    if (!parsed.success) {
      toast.error("Revisa los campos", {
        description: parsed.error.issues[0]?.message,
      });
      return;
    }

    const cleanName = parsed.data.name;
    const normalized = normalizePhone(parsed.data.phone);
    if (!normalized) {
      toast.error("Teléfono inválido");
      return;
    }

    setCreating(true);
    try {
      // 1) Buscar duplicado por teléfono dentro de los contactos del usuario
      const { data: existing, error: findErr } = await supabase
        .from("people_contacts")
        .select("id, name, in_strategic_network")
        .eq("user_id", user.id)
        .contains("phone_numbers", [normalized])
        .limit(1)
        .maybeSingle();

      if (findErr) throw findErr;

      if (existing) {
        if (existing.in_strategic_network) {
          toast.info(`${existing.name} ya está en tu red estratégica`);
          onAdded();
        } else {
          const { error: upErr } = await supabase
            .from("people_contacts")
            .update({ in_strategic_network: true })
            .eq("id", existing.id);
          if (upErr) throw upErr;
          toast.success(`${existing.name} ya existía: añadido a la red`);
          onAdded();
        }
      } else {
        // 2) Insertar nuevo
        const { error: insErr } = await supabase.from("people_contacts").insert({
          user_id: user.id,
          name: cleanName,
          phone_numbers: [normalized],
          in_strategic_network: true,
          category: "pendiente",
        });
        if (insErr) throw insErr;
        toast.success(`${cleanName} creado y añadido a tu red`);
        onAdded();
      }

      // Reset y cerrar formulario
      setNewName("");
      setNewPhone("");
      setFormOpen(false);
    } catch (e) {
      toast.error("No se pudo crear", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(false);
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
            Crea un contacto nuevo o elige entre los que ya tienes. Solo los marcados aparecerán
            en /red-estrategica.
          </DialogDescription>
        </DialogHeader>

        {/* ── Crear nuevo contacto ── */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium hover:bg-primary/10 transition"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Crear contacto nuevo
            </span>
            {formOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {formOpen && (
            <div className="px-3 pb-3 pt-1 space-y-2.5">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Nombre
                </label>
                <Input
                  placeholder="Ej: Marta Pérez"
                  value={newName}
                  maxLength={100}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Teléfono
                </label>
                <Input
                  placeholder="Ej: +34 600 123 456"
                  value={newPhone}
                  maxLength={20}
                  inputMode="tel"
                  onChange={(e) => setNewPhone(e.target.value)}
                  disabled={creating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !creating) {
                      e.preventDefault();
                      void createAndAdd();
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Recomendado con prefijo internacional (ej: +34).
                </p>
              </div>
              <Button
                size="sm"
                className="w-full gap-1.5"
                disabled={creating || !newName.trim() || !newPhone.trim()}
                onClick={() => void createAndAdd()}
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Crear y añadir a la red
              </Button>
            </div>
          )}
        </div>

        {/* ── Buscador de existentes ── */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="O busca uno existente por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              {search.trim()
                ? "Sin resultados. Prueba con otro nombre o créalo arriba."
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
