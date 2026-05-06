import { useEffect, useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  company?: string | null;
  wa_id?: string | null;
}

interface Props {
  value?: string;
  onChange: (contactId: string | undefined, contact?: Contact) => void;
  placeholder?: string;
}

// Normalize a phone string → digits only (e.g. "+34 600 123 456" → "34600123456")
function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

export const ContactCombobox = ({ value, onChange, placeholder = "Seleccionar contacto" }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const loadContacts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch ALL contacts in pages of 1000 (Supabase default limit)
      const all: Contact[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("people_contacts")
          .select("id, name, company, wa_id")
          .eq("user_id", user.id)
          .order("name", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data || [];
        all.push(...batch);
        if (batch.length < PAGE) break;
      }
      setContacts(all);
    } catch (err: any) {
      console.error("[ContactCombobox] load failed:", err);
      toast.error("No se pudieron cargar los contactos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const selected = useMemo(() => contacts.find((c) => c.id === value), [contacts, value]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background font-normal"
          >
            <span className="truncate">
              {loading
                ? "Cargando contactos…"
                : selected
                ? selected.name
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter>
            <CommandInput
              placeholder={`Buscar entre ${contacts.length} contactos…`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>
                <div className="p-2 space-y-2">
                  <p className="text-xs text-muted-foreground">No se encontró ningún contacto.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="w-full gap-2"
                    onClick={() => {
                      setOpen(false);
                      setCreateOpen(true);
                    }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Crear "{search.trim() || "nuevo contacto"}"
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__create_new__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                  className="text-primary font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear contacto nuevo
                </CommandItem>
                {contacts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.company || ""} ${c.wa_id || ""}`}
                    onSelect={() => {
                      onChange(c.id, c);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{c.name}</span>
                      {c.company && (
                        <span className="text-xs text-muted-foreground truncate">{c.company}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultName={search.trim()}
        onCreated={async (contact) => {
          await loadContacts();
          onChange(contact.id, contact);
          setCreateOpen(false);
        }}
      />
    </>
  );
};

// ── Create Contact Dialog ─────────────────────────────────────────────────────

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onCreated: (contact: Contact) => void;
}

const CreateContactDialog = ({ open, onOpenChange, defaultName, onCreated }: CreateContactDialogProps) => {
  const { user } = useAuth();
  const [name, setName] = useState(defaultName || "");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName || "");
      setCompany("");
      setPhone("");
    }
  }, [open, defaultName]);

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const waId = phone ? normalizePhone(phone) : null;
      const phoneNumbers = waId ? [waId] : null;

      // Pre-check: ¿ya existe un contacto con este wa_id?
      let created: Contact | null = null;
      let reused = false;

      if (waId) {
        const { data: existing } = await supabase
          .from("people_contacts")
          .select("id, name, company, wa_id")
          .eq("user_id", user.id)
          .eq("wa_id", waId)
          .maybeSingle();
        if (existing) {
          created = existing as Contact;
          reused = true;
          toast.info(`Ya tenías un contacto con ese número: «${existing.name}». Lo seleccionamos.`);
        }
      }

      if (!created) {
        const { data: inserted, error } = await supabase
          .from("people_contacts")
          .insert({
            user_id: user.id,
            name: name.trim(),
            company: company.trim() || null,
            wa_id: waId,
            phone_numbers: phoneNumbers,
            in_strategic_network: true,
            relationship: "professional",
          })
          .select("id, name, company, wa_id")
          .single();

        if (error) {
          // Red de seguridad: carrera o índice no detectado en el pre-check
          if ((error as any).code === "23505" && waId) {
            const { data: existing2 } = await supabase
              .from("people_contacts")
              .select("id, name, company, wa_id")
              .eq("user_id", user.id)
              .eq("wa_id", waId)
              .maybeSingle();
            if (existing2) {
              created = existing2 as Contact;
              reused = true;
              toast.info(`Ya tenías un contacto con ese número: «${existing2.name}». Lo seleccionamos.`);
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        } else {
          created = inserted as Contact;
        }
      }

      if (!created) throw new Error("No se pudo crear ni recuperar el contacto");

      // Try to link existing WhatsApp messages where sender contains the phone
      let linkedMessages = 0;
      if (waId && waId.length >= 6) {
        try {
          const { data: candidates } = await supabase
            .from("contact_messages")
            .select("id, sender")
            .eq("user_id", user.id)
            .is("contact_id", null)
            .ilike("sender", `%${waId.slice(-9)}%`)
            .limit(500);

          const matchIds = (candidates || [])
            .filter((m: any) => normalizePhone(m.sender || "").endsWith(waId.slice(-9)))
            .map((m: any) => m.id);

          if (matchIds.length > 0) {
            const { error: linkErr } = await supabase
              .from("contact_messages")
              .update({ contact_id: created.id })
              .in("id", matchIds);
            if (!linkErr) linkedMessages = matchIds.length;
          }
        } catch (linkErr) {
          console.warn("[CreateContactDialog] link messages failed:", linkErr);
        }
      }

      if (!reused) {
        toast.success(
          linkedMessages > 0
            ? `Contacto creado y vinculado a ${linkedMessages} mensajes WhatsApp`
            : "Contacto creado en tu Red Estratégica",
        );
      } else if (linkedMessages > 0) {
        toast.success(`Vinculados ${linkedMessages} mensajes WhatsApp al contacto existente`);
      }
      onCreated(created);
    } catch (err: any) {
      console.error("[CreateContactDialog] save failed:", err);
      toast.error(err.message || "No se pudo crear el contacto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo contacto</DialogTitle>
          <DialogDescription>
            Se añadirá a tu Red Estratégica. Si pones un teléfono, se intentará vincular con tus mensajes de WhatsApp existentes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Empresa (opcional)</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Empresa S.L."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Teléfono / WhatsApp (opcional)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 123 456"
              type="tel"
            />
            <p className="text-[11px] text-muted-foreground">
              Con el código de país (ej: 34 para España). Sin este número no podemos vincular WhatsApp.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Crear contacto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
