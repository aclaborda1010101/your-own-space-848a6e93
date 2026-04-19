import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalIcon,
  Activity,
  Briefcase,
  Radar,
  ShieldCheck,
  Upload,
  ContactRound,
  Newspaper,
  UtensilsCrossed,
  Wallet,
  Baby,
  Sparkles,
  Languages,
  GraduationCap,
  PenLine,
  Settings,
  Gauge,
  TerminalSquare,
  Brain,
  Trophy,
  Mic,
  User,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", group: "Principal" },
  { icon: TerminalSquare, label: "OpenClaw Hub", path: "/openclaw/hub", group: "Principal" },
  { icon: CheckSquare, label: "Tareas", path: "/tasks", group: "Principal" },
  { icon: CalIcon, label: "Calendario", path: "/calendar", group: "Principal" },
  { icon: Activity, label: "Salud", path: "/health", group: "Principal" },
  { icon: Trophy, label: "Deportes", path: "/sports", group: "Principal" },
  { icon: Briefcase, label: "Proyectos", path: "/projects", group: "Proyectos" },
  { icon: Radar, label: "Detector de Patrones", path: "/projects/detector", group: "Proyectos" },
  { icon: ShieldCheck, label: "Auditoría IA", path: "/auditoria-ia", group: "Proyectos" },
  { icon: Upload, label: "Importar", path: "/data-import", group: "Datos" },
  { icon: ContactRound, label: "Red Estratégica", path: "/red-estrategica", group: "Datos" },
  { icon: Mic, label: "Comunicaciones", path: "/communications", group: "Datos" },
  { icon: Newspaper, label: "Noticias IA", path: "/ai-news", group: "Módulos" },
  { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition", group: "Módulos" },
  { icon: Wallet, label: "Finanzas", path: "/finances", group: "Módulos" },
  { icon: Baby, label: "Bosco", path: "/bosco", group: "Módulos" },
  { icon: Brain, label: "Bosco · Análisis", path: "/bosco/analysis", group: "Módulos" },
  { icon: PenLine, label: "Contenido", path: "/content", group: "Módulos" },
  { icon: Sparkles, label: "Coach", path: "/coach", group: "Formación" },
  { icon: Languages, label: "Inglés", path: "/english", group: "Formación" },
  { icon: GraduationCap, label: "Curso IA", path: "/ai-course", group: "Formación" },
  { icon: Settings, label: "Ajustes", path: "/settings", group: "Sistema" },
  { icon: Gauge, label: "Consumos IA", path: "/ai-costs", group: "Sistema" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function JarvisCommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Array<{ id: string; title: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; company: string | null }>>([]);

  // Global ⌘K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      const [{ data: tasksData }, { data: contactsData }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title")
          .eq("user_id", user.id)
          .eq("completed", false)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("people_contacts")
          .select("id, name, company")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      setTasks(tasksData ?? []);
      setContacts(contactsData ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const grouped = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar en JARVIS… (menú, tareas, contactos)" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        {Object.entries(grouped).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <CommandItem key={it.path} value={`${group} ${it.label}`} onSelect={() => go(it.path)}>
                  <Icon className="mr-2 h-4 w-4 text-primary" />
                  <span>{it.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tareas pendientes">
              {tasks.map((t) => (
                <CommandItem
                  key={`task-${t.id}`}
                  value={`tarea ${t.title}`}
                  onSelect={() => go("/tasks")}
                >
                  <CheckSquare className="mr-2 h-4 w-4 text-primary" />
                  <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {contacts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contactos">
              {contacts.map((c) => (
                <CommandItem
                  key={`contact-${c.id}`}
                  value={`contacto ${c.name} ${c.company ?? ""}`}
                  onSelect={() => go(`/red-estrategica/${c.id}`)}
                >
                  <User className="mr-2 h-4 w-4 text-primary" />
                  <span className="truncate">
                    {c.name}
                    {c.company ? <span className="text-muted-foreground"> · {c.company}</span> : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
