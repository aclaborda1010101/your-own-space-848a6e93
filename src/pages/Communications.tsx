import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import {
  Mail,
  MessageCircle,
  Send,
  Inbox,
  Star,
  Clock,
  AlertCircle,
  Settings,
  RefreshCw,
  Loader2,
  ExternalLink
} from "lucide-react";

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  isRead: boolean;
  isStarred: boolean;
  priority: "high" | "normal" | "low";
}

interface ChatMessage {
  id: string;
  platform: "whatsapp" | "telegram";
  from: string;
  message: string;
  time: string;
  isRead: boolean;
  avatar?: string;
}

// Mock data - will be replaced with real integrations
const mockEmails: EmailMessage[] = [
  {
    id: "1",
    from: "cliente@empresa.com",
    subject: "Propuesta de proyecto Q1",
    preview: "Hola Agustín, te envío la propuesta para el nuevo proyecto...",
    time: "10:30",
    isRead: false,
    isStarred: true,
    priority: "high",
  },
  {
    id: "2",
    from: "newsletter@openai.com",
    subject: "GPT-5 Release Notes",
    preview: "We're excited to announce the latest improvements...",
    time: "09:15",
    isRead: true,
    isStarred: false,
    priority: "normal",
  },
];

const mockChats: ChatMessage[] = [
  {
    id: "1",
    platform: "whatsapp",
    from: "María García",
    message: "¿Quedamos mañana para revisar el proyecto?",
    time: "11:45",
    isRead: false,
  },
  {
    id: "2",
    platform: "telegram",
    from: "Bot de alertas",
    message: "Nueva alerta de mercado: BTC +5%",
    time: "10:00",
    isRead: true,
  },
];

const Communications = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [activeTab, setActiveTab] = useState("email");
  const [loading, setLoading] = useState(false);

  const unreadEmails = mockEmails.filter(e => !e.isRead).length;
  const unreadChats = mockChats.filter(c => !c.isRead).length;

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  const getPlatformIcon = (platform: "whatsapp" | "telegram") => {
    switch (platform) {
      case "whatsapp":
        return <MessageCircle className="w-4 h-4 text-success" />;
      case "telegram":
        return <Send className="w-4 h-4 text-primary" />;
    }
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
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                <Mail className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Comunicaciones</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {unreadEmails + unreadChats} MENSAJES SIN LEER
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
              <Button variant="outline" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{unreadEmails}</p>
                  <p className="text-xs text-muted-foreground">Emails</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{mockChats.filter(c => c.platform === "whatsapp" && !c.isRead).length}</p>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{mockChats.filter(c => c.platform === "telegram" && !c.isRead).length}</p>
                  <p className="text-xs text-muted-foreground">Telegram</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="email" className="gap-2">
                <Mail className="w-4 h-4" />
                Email
                {unreadEmails > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                    {unreadEmails}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="telegram" className="gap-2">
                <Send className="w-4 h-4" />
                Telegram
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-4 space-y-3">
              {mockEmails.map((email) => (
                <Card
                  key={email.id}
                  className={cn(
                    "border-border bg-card cursor-pointer transition-all hover:border-primary/30",
                    !email.isRead && "bg-primary/5 border-primary/20"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {email.priority === "high" && (
                            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                          )}
                          <span className={cn("text-sm font-medium truncate", !email.isRead && "font-semibold")}>
                            {email.from}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{email.time}</span>
                        </div>
                        <p className={cn("text-sm truncate mt-1", !email.isRead ? "text-foreground" : "text-muted-foreground")}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {email.preview}
                        </p>
                      </div>
                      <button className={cn(
                        "p-1 rounded transition-colors",
                        email.isStarred ? "text-warning" : "text-muted-foreground hover:text-warning"
                      )}>
                        <Star className={cn("w-4 h-4", email.isStarred && "fill-current")} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                <CardContent className="p-6 text-center">
                  <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Conecta tu cuenta de email</p>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Configurar IMAP
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-4 space-y-3">
              {mockChats.filter(c => c.platform === "whatsapp").map((chat) => (
                <Card
                  key={chat.id}
                  className={cn(
                    "border-border bg-card cursor-pointer transition-all hover:border-success/30",
                    !chat.isRead && "bg-success/5 border-success/20"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", !chat.isRead && "font-semibold")}>
                            {chat.from}
                          </span>
                          <span className="text-xs text-muted-foreground">{chat.time}</span>
                        </div>
                        <p className={cn("text-sm truncate mt-1", !chat.isRead ? "text-foreground" : "text-muted-foreground")}>
                          {chat.message}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                <CardContent className="p-6 text-center">
                  <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Conecta WhatsApp Business</p>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Configurar API
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="telegram" className="mt-4 space-y-3">
              {mockChats.filter(c => c.platform === "telegram").map((chat) => (
                <Card
                  key={chat.id}
                  className={cn(
                    "border-border bg-card cursor-pointer transition-all hover:border-primary/30",
                    !chat.isRead && "bg-primary/5 border-primary/20"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Send className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", !chat.isRead && "font-semibold")}>
                            {chat.from}
                          </span>
                          <span className="text-xs text-muted-foreground">{chat.time}</span>
                        </div>
                        <p className={cn("text-sm truncate mt-1", !chat.isRead ? "text-foreground" : "text-muted-foreground")}>
                          {chat.message}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                <CardContent className="p-6 text-center">
                  <Send className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Conecta tu bot de Telegram</p>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Configurar Bot
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Communications;
