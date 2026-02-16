import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Briefcase, User, Baby, Clock, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";

const BRAIN_CONFIG = {
  professional: { label: "Profesional", icon: Briefcase, color: "text-blue-400" },
  personal: { label: "Personal", icon: User, color: "text-emerald-400" },
  bosco: { label: "Bosco", icon: Baby, color: "text-amber-400" },
};

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brainFilter = searchParams.get("brain");
  
  const dbBrain = brainFilter === "family" ? "bosco" : brainFilter;

  const { data: contacts = [] } = useQuery({
    queryKey: ["people-contacts", user?.id, dbBrain],
    queryFn: async () => {
      let query = supabase
        .from("people_contacts")
        .select("*")
        .order("last_contact", { ascending: false });
      if (dbBrain) {
        query = query.eq("brain", dbBrain);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const groupedByBrain = {
    professional: contacts.filter((c: any) => c.brain === "professional"),
    personal: contacts.filter((c: any) => c.brain === "personal"),
    bosco: contacts.filter((c: any) => c.brain === "bosco"),
  };

  const inactiveContacts = contacts.filter((c: any) => {
    if (!c.last_contact) return false;
    return differenceInDays(new Date(), new Date(c.last_contact)) > 30;
  });

  const ContactCard = ({ contact }: { contact: any }) => {
    const brain = BRAIN_CONFIG[contact.brain as keyof typeof BRAIN_CONFIG] || BRAIN_CONFIG.personal;
    const daysSince = contact.last_contact ? differenceInDays(new Date(), new Date(contact.last_contact)) : null;
    const isInactive = daysSince !== null && daysSince > 30;

    return (
      <Card
        className="border-border hover:border-primary/30 transition-colors cursor-pointer"
        onClick={() => navigate(`/contacts/${contact.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {contact.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm text-foreground truncate">{contact.name}</h3>
                {isInactive && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {contact.relationship && (
                  <Badge variant="outline" className="text-xs">{contact.relationship}</Badge>
                )}
                {contact.company && (
                  <Badge variant="secondary" className="text-xs">{contact.company}</Badge>
                )}
                {contact.role && (
                  <Badge variant="secondary" className="text-xs">{contact.role}</Badge>
                )}
              </div>
              {contact.context && (
                <p className="text-xs text-muted-foreground line-clamp-1">{contact.context}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{contact.interaction_count || 0} interacciones</span>
                {daysSince !== null && (
                  <span className={`flex items-center gap-1 ${isInactive ? "text-amber-400" : ""}`}>
                    <Clock className="w-3 h-3" />
                    hace {daysSince}d
                  </span>
                )}
              </div>
              {contact.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {contact.ai_tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ContactList = ({ items }: { items: any[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((c: any) => <ContactCard key={c.id} contact={c} />)}
      {items.length === 0 && (
        <div className="col-span-2 text-center p-8 text-muted-foreground text-sm">
          Sin contactos en esta categoría
        </div>
      )}
    </div>
  );

  const brainLabel = brainFilter === "professional" ? "Profesional" : brainFilter === "personal" ? "Personal" : brainFilter === "family" ? "Familiar" : null;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          {brainLabel ? `Contactos · ${brainLabel}` : "Contactos CRM"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Red de contactos detectada automáticamente desde tus conversaciones
        </p>
      </div>

      {inactiveContacts.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Alertas de inactividad ({inactiveContacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {inactiveContacts.slice(0, 5).map((c: any) => (
                <Badge key={c.id} variant="outline" className="text-xs text-amber-400 border-amber-500/20">
                  {c.name} · {differenceInDays(new Date(), new Date(c.last_contact))}d
                </Badge>
              ))}
              {inactiveContacts.length > 5 && (
                <Badge variant="secondary" className="text-xs">+{inactiveContacts.length - 5} más</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {brainFilter ? (
        <ContactList items={contacts} />
      ) : (
        <Tabs defaultValue="professional">
          <TabsList className="w-full">
            <TabsTrigger value="professional" className="flex-1 gap-1">
              <Briefcase className="w-4 h-4" /> Profesional ({groupedByBrain.professional.length})
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex-1 gap-1">
              <User className="w-4 h-4" /> Personal ({groupedByBrain.personal.length})
            </TabsTrigger>
            <TabsTrigger value="bosco" className="flex-1 gap-1">
              <Baby className="w-4 h-4" /> Bosco ({groupedByBrain.bosco.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="professional"><ContactList items={groupedByBrain.professional} /></TabsContent>
          <TabsContent value="personal"><ContactList items={groupedByBrain.personal} /></TabsContent>
          <TabsContent value="bosco"><ContactList items={groupedByBrain.bosco} /></TabsContent>
        </Tabs>
      )}

    </div>
  );
}