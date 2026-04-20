import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ContactOption {
  id: string;
  name: string;
}

interface ContactSelectProps {
  value: string | null;
  onChange: (contactId: string | null, contactName: string | null) => void;
  placeholder?: string;
  className?: string;
  size?: "default" | "sm";
}

/**
 * Selector ligero de contacto con búsqueda. Carga la lista completa de
 * `people_contacts` del usuario actual una vez y la filtra en cliente.
 */
export function ContactSelect({
  value,
  onChange,
  placeholder = "Vincular a contacto…",
  className,
  size = "default",
}: ContactSelectProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Cargar TODOS los contactos del usuario (chunked para superar el límite de 1000).
        const all: ContactOption[] = [];
        let from = 0;
        const STEP = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("people_contacts")
            .select("id, name")
            .eq("user_id", user.id)
            .order("name", { ascending: true })
            .range(from, from + STEP - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < STEP) break;
          from += STEP;
        }
        if (!cancelled) setContacts(all);
      } catch (e) {
        console.error("ContactSelect load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const selected = useMemo(
    () => contacts.find((c) => c.id === value) || null,
    [contacts, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          size={size}
          className={cn(
            "justify-between gap-2 font-normal border-border bg-background",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{selected ? selected.name : placeholder}</span>
          </span>
          {selected ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null, null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null, null);
                }
              }}
              className="rounded p-0.5 hover:bg-muted"
              aria-label="Quitar contacto"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 z-50 bg-popover">
        <Command>
          <CommandInput placeholder="Buscar contacto…" />
          <CommandList>
            <CommandEmpty>{loading ? "Cargando…" : "Sin resultados"}</CommandEmpty>
            <CommandGroup>
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onChange(c.id, c.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
