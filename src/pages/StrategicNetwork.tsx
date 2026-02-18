import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SidebarNew } from '@/components/layout/SidebarNew';
import { TopBar } from '@/components/layout/TopBar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  User, Briefcase, Heart, Target, FileText, Users,
  Loader2, RefreshCw, Network, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  role: string | null;
  personality_profile: {
    personalidad_disc?: string;
    estilo_comunicacion?: string;
    relacion_con_agustin?: string;
    percepcion_de_agustin?: string;
    estrategia_abordaje?: string;
    puntos_dolor_placer?: string[];
    oportunidades_negocio?: string[];
    como_me_habla?: string;
    tono_habitual?: string;
    fuente?: string;
  } | null;
  ai_tags: string[];
}

interface PlaudThread {
  id: string;
  event_title: string;
  event_date: string;
  contacts_extracted: any[];
  agent_type: string;
}

export default function StrategicNetwork() {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [threads, setThreads] = useState<PlaudThread[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('perfil');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contactsRes, threadsRes] = await Promise.all([
        supabase.from('people_contacts').select('*').order('name'),
        supabase.from('plaud_threads').select('id,event_title,event_date,contacts_extracted,agent_type').order('event_date', { ascending: false }).limit(50)
      ]);

      if (contactsRes.data) {
        setContacts(contactsRes.data);
        if (contactsRes.data.length > 0 && !selectedContact) {
          setSelectedContact(contactsRes.data[0]);
        }
      }
      if (threadsRes.data) setThreads(threadsRes.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Error cargando contactos');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch { return dateStr; }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: es });
    } catch { return dateStr; }
  };

  const getBrainBadge = (contact: Contact) => {
    const tags = contact.ai_tags || [];
    const profile = contact.personality_profile;
    const relacion = profile?.relacion_con_agustin?.toLowerCase() || '';
    
    if (tags.some(t => t.includes('profesional')) || relacion.includes('profesional') || relacion.includes('colega') || relacion.includes('trabajo') || relacion.includes('negocio')) {
      return { label: '💼 Profesional', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    }
    if (tags.some(t => t.includes('familiar')) || relacion.includes('familiar') || relacion.includes('familia') || relacion.includes('hijo') || relacion.includes('padre') || relacion.includes('madre')) {
      return { label: '👨‍👩‍👧 Familiar', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    }
    return { label: '❤️ Personal', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30' };
  };

  const getContactThreads = (contactId: string) => {
    return threads.filter(t => {
      const extracted = Array.isArray(t.contacts_extracted) ? t.contacts_extracted : [];
      return extracted.some((c: any) => c.id === contactId || c.name === selectedContact?.name);
    });
  };

  const ProfileField = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    );
  };

  const ListField = ({ label, items }: { label: string; items?: string[] | null }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{label}</p>
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
              <span className="text-primary mt-1">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarNew
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={openSidebar} />

        <main className="p-4 lg:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Network className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Red Estratégica</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {contacts.length} CONTACTOS DETECTADOS
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* === LISTA DE CONTACTOS (izquierda) === */}
            <div className="lg:col-span-1 space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground font-mono uppercase tracking-wider mb-3">
                Contactos ({contacts.length})
              </h2>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                  <CardContent className="p-6 text-center">
                    <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay contactos aún</p>
                    <p className="text-xs text-muted-foreground mt-1">Se detectan automáticamente al procesar grabaciones Plaud</p>
                  </CardContent>
                </Card>
              ) : (
                contacts.map(contact => {
                  const brain = getBrainBadge(contact);
                  const isSelected = selectedContact?.id === contact.id;
                  return (
                    <Card
                      key={contact.id}
                      className={cn(
                        "cursor-pointer transition-all border hover:border-primary/40",
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                      )}
                      onClick={() => { setSelectedContact(contact); setActiveTab('perfil'); }}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold flex-shrink-0">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded border inline-block mt-0.5", brain.color)}>
                            {brain.label}
                          </span>
                        </div>
                        {isSelected && <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* === FICHA DETALLADA (derecha) === */}
            <div className="lg:col-span-2">
              {selectedContact ? (
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-xl">
                        {selectedContact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl">{selectedContact.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {selectedContact.role || selectedContact.personality_profile?.relacion_con_agustin || 'Sin rol definido'}
                        </p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {getBrainBadge(selectedContact) && (
                            <span className={cn("text-xs px-2 py-0.5 rounded border", getBrainBadge(selectedContact).color)}>
                              {getBrainBadge(selectedContact).label}
                            </span>
                          )}
                          {selectedContact.personality_profile?.fuente && (
                            <span className="text-xs px-2 py-0.5 rounded border bg-muted/20 text-muted-foreground border-muted/30">
                              🎙️ Plaud
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-5 mb-4">
                        <TabsTrigger value="perfil" className="text-xs gap-1">
                          <User className="w-3 h-3" />
                          Perfil
                        </TabsTrigger>
                        <TabsTrigger value="profesional" className="text-xs gap-1">
                          <Briefcase className="w-3 h-3" />
                          Profesional
                        </TabsTrigger>
                        <TabsTrigger value="personal" className="text-xs gap-1">
                          <Heart className="w-3 h-3" />
                          Personal
                        </TabsTrigger>
                        <TabsTrigger value="estrategia" className="text-xs gap-1">
                          <Target className="w-3 h-3" />
                          Estrategia
                        </TabsTrigger>
                        <TabsTrigger value="historial" className="text-xs gap-1">
                          <FileText className="w-3 h-3" />
                          Historial
                        </TabsTrigger>
                      </TabsList>

                      {/* 👤 PERFIL */}
                      <TabsContent value="perfil" className="space-y-4">
                        {selectedContact.personality_profile ? (
                          <>
                            <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-4">
                              <ProfileField
                                label="Personalidad DISC"
                                value={selectedContact.personality_profile.personalidad_disc}
                              />
                              <ProfileField
                                label="Estilo de Comunicación"
                                value={selectedContact.personality_profile.estilo_comunicacion}
                              />
                              <ProfileField
                                label="Tono Habitual"
                                value={selectedContact.personality_profile.tono_habitual}
                              />
                              <ProfileField
                                label="Cómo Me Habla"
                                value={selectedContact.personality_profile.como_me_habla}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="p-6 text-center text-muted-foreground">
                            <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay perfil generado aún</p>
                            <p className="text-xs mt-1">El perfil se genera automáticamente al procesar grabaciones</p>
                          </div>
                        )}
                      </TabsContent>

                      {/* 💼 PROFESIONAL */}
                      <TabsContent value="profesional" className="space-y-4">
                        {selectedContact.personality_profile ? (
                          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-4">
                            <ListField
                              label="Oportunidades de Negocio"
                              items={selectedContact.personality_profile.oportunidades_negocio}
                            />
                            <ProfileField
                              label="Cómo Me Habla en Contexto Laboral"
                              value={selectedContact.personality_profile.como_me_habla}
                            />
                            <ProfileField
                              label="Estilo de Comunicación Profesional"
                              value={selectedContact.personality_profile.estilo_comunicacion}
                            />
                            {(!selectedContact.personality_profile.oportunidades_negocio?.length) && (
                              <p className="text-sm text-muted-foreground">No se detectaron oportunidades de negocio en las conversaciones</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-6">Sin datos profesionales</p>
                        )}
                      </TabsContent>

                      {/* ❤️ PERSONAL */}
                      <TabsContent value="personal" className="space-y-4">
                        {selectedContact.personality_profile ? (
                          <div className="p-4 rounded-lg bg-pink-500/5 border border-pink-500/20 space-y-4">
                            <ProfileField
                              label="Relación con Agustín"
                              value={selectedContact.personality_profile.relacion_con_agustin}
                            />
                            <ProfileField
                              label="Cómo Percibe a Agustín"
                              value={selectedContact.personality_profile.percepcion_de_agustin}
                            />
                            <ProfileField
                              label="Tono Habitual"
                              value={selectedContact.personality_profile.tono_habitual}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-6">Sin datos personales</p>
                        )}
                      </TabsContent>

                      {/* 🎯 ESTRATEGIA */}
                      <TabsContent value="estrategia" className="space-y-4">
                        {selectedContact.personality_profile ? (
                          <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-4">
                            <ProfileField
                              label="Estrategia de Abordaje Recomendada"
                              value={selectedContact.personality_profile.estrategia_abordaje}
                            />
                            <ListField
                              label="Puntos de Dolor / Placer"
                              items={selectedContact.personality_profile.puntos_dolor_placer}
                            />
                            <div className="pt-2 border-t border-border">
                              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide mb-2">Resumen Rápido</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                                  <p className="text-xs text-green-400 font-mono">ACERCAMIENTO</p>
                                  <p className="text-xs text-foreground mt-1">{selectedContact.personality_profile.personalidad_disc?.slice(0, 50) || 'Ver perfil DISC'}</p>
                                </div>
                                <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                                  <p className="text-xs text-red-400 font-mono">EVITAR</p>
                                  <p className="text-xs text-foreground mt-1">Presión directa sin contexto previo</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-6">Sin estrategia definida</p>
                        )}
                      </TabsContent>

                      {/* 📝 HISTORIAL */}
                      <TabsContent value="historial" className="space-y-3">
                        {(() => {
                          const contactThreads = getContactThreads(selectedContact.id);
                          if (contactThreads.length === 0) {
                            return (
                              <div className="text-center py-6">
                                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Sin grabaciones asociadas</p>
                                <p className="text-xs text-muted-foreground mt-1">Las grabaciones aparecen aquí tras procesar el pipeline</p>
                              </div>
                            );
                          }
                          return contactThreads.map(thread => (
                            <Card key={thread.id} className="border-border bg-muted/10">
                              <CardContent className="p-3">
                                <p className="text-sm font-medium">{thread.event_title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{formatDate(thread.event_date)}</p>
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {thread.agent_type || 'sin categoría'}
                                </Badge>
                              </CardContent>
                            </Card>
                          ));
                        })()}

                        {/* Tags */}
                        {selectedContact.ai_tags?.length > 0 && (
                          <div className="pt-3 border-t border-border">
                            <p className="text-xs text-muted-foreground font-mono mb-2">TAGS</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedContact.ai_tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent h-96 flex items-center justify-center">
                  <div className="text-center">
                    <Network className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Selecciona un contacto para ver su ficha</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
