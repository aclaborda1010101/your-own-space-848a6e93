import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Settings2, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Copy, 
  Check,
  Pencil,
} from "lucide-react";
import { 
  DashboardCardId, 
  CardWidth, 
  CARD_LABELS,
  CardSettings,
  DashboardProfile,
  ProfileIconName,
  PROFILE_ICONS,
} from "@/hooks/useDashboardLayout";
import { ProfileIcon } from "./ProfileIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface DashboardSettingsDialogProps {
  cardSettings: Record<DashboardCardId, CardSettings>;
  profiles: DashboardProfile[];
  activeProfileId: string;
  onVisibilityChange: (cardId: DashboardCardId, visible: boolean) => void;
  onWidthChange: (cardId: DashboardCardId, width: CardWidth) => void;
  onReset: () => void;
  onCreateProfile: (name: string, icon?: ProfileIconName) => void;
  onDuplicateProfile: (profileId: string, newName: string) => void;
  onRenameProfile: (profileId: string, newName: string) => void;
  onSetProfileIcon: (profileId: string, icon: ProfileIconName) => void;
  onDeleteProfile: (profileId: string) => void;
  onSwitchProfile: (profileId: string) => void;
}

const WIDTH_OPTIONS: { value: CardWidth; label: string }[] = [
  { value: "1/3", label: "1/3" },
  { value: "1/2", label: "1/2" },
  { value: "2/3", label: "2/3" },
  { value: "full", label: "Completo" },
];

const ALL_CARDS: DashboardCardId[] = [
  "check-in",
  "daily-plan",
  "publications",
  "agenda",
  "challenge",
  "coach",
  "priorities",
  "alerts",
];

const IconPicker = ({
  value,
  onChange,
}: {
  value: ProfileIconName;
  onChange: (icon: ProfileIconName) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
          <ProfileIcon name={value} className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-7 gap-1">
          {PROFILE_ICONS.map((icon) => (
            <Button
              key={icon.name}
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                value === icon.name && "bg-primary/20 text-primary"
              )}
              onClick={() => {
                onChange(icon.name);
                setOpen(false);
              }}
            >
              <ProfileIcon name={icon.name} className="w-4 h-4" />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const DashboardSettingsDialog = ({
  cardSettings,
  profiles,
  activeProfileId,
  onVisibilityChange,
  onWidthChange,
  onReset,
  onCreateProfile,
  onDuplicateProfile,
  onRenameProfile,
  onSetProfileIcon,
  onDeleteProfile,
  onSwitchProfile,
}: DashboardSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileIcon, setNewProfileIcon] = useState<ProfileIconName>("layout-grid");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const hiddenCount = ALL_CARDS.filter(
    (id) => cardSettings[id]?.visible === false
  ).length;

  const handleCreateProfile = () => {
    if (newProfileName.trim()) {
      onCreateProfile(newProfileName.trim(), newProfileIcon);
      setNewProfileName("");
      setNewProfileIcon("layout-grid");
    }
  };

  const handleStartEditing = (profile: DashboardProfile) => {
    setEditingProfileId(profile.id);
    setEditingName(profile.name);
  };

  const handleSaveEditing = () => {
    if (editingProfileId && editingName.trim()) {
      onRenameProfile(editingProfileId, editingName.trim());
      setEditingProfileId(null);
      setEditingName("");
    }
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings2 className="w-4 h-4" />
          {hiddenCount > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center"
            >
              {hiddenCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Configurar Dashboard
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cards" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cards">Tarjetas</TabsTrigger>
            <TabsTrigger value="profiles">Perfiles</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="flex-1 overflow-y-auto space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Elige qué tarjetas mostrar y su ancho en el dashboard.
            </p>

            <div className="space-y-3">
              {ALL_CARDS.map((cardId) => {
                const settings = cardSettings[cardId];
                const isVisible = settings?.visible !== false;

                return (
                  <div
                    key={cardId}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={isVisible}
                        onCheckedChange={(checked) =>
                          onVisibilityChange(cardId, checked)
                        }
                      />
                      <div className="flex items-center gap-2">
                        {isVisible ? (
                          <Eye className="w-4 h-4 text-success" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Label className={!isVisible ? "text-muted-foreground" : ""}>
                          {CARD_LABELS[cardId]}
                        </Label>
                      </div>
                    </div>

                    <Select
                      value={settings?.width || "full"}
                      onValueChange={(value) =>
                        onWidthChange(cardId, value as CardWidth)
                      }
                      disabled={!isVisible}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WIDTH_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={onReset}>
                Restablecer tarjetas
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="profiles" className="flex-1 overflow-y-auto space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Guarda diferentes configuraciones de dashboard para alternar rápidamente.
            </p>

            {/* Current Profile */}
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeProfile && (
                    <ProfileIcon name={activeProfile.icon} className="w-4 h-4 text-primary" />
                  )}
                  <Badge variant="default" className="text-xs">Activo</Badge>
                  <span className="font-medium">{activeProfile?.name}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Profile List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Todos los perfiles</Label>
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    profile.id === activeProfileId
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {editingProfileId === profile.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEditing();
                          if (e.key === "Escape") setEditingProfileId(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEditing}>
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onSwitchProfile(profile.id)}
                        className="flex items-center gap-2 text-left flex-1"
                      >
                        <ProfileIcon name={profile.icon} className="w-4 h-4 text-muted-foreground" />
                        <span className={profile.id === activeProfileId ? "font-medium" : ""}>
                          {profile.name}
                        </span>
                        {profile.id === activeProfileId && (
                          <Badge variant="secondary" className="text-xs">Activo</Badge>
                        )}
                      </button>
                      <div className="flex items-center gap-1">
                        <IconPicker
                          value={profile.icon}
                          onChange={(icon) => onSetProfileIcon(profile.id, icon)}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleStartEditing(profile)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => onDuplicateProfile(profile.id, `${profile.name} (copia)`)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {profiles.length > 1 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar perfil?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará el perfil "{profile.name}" permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDeleteProfile(profile.id)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            {/* Create New Profile */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Crear nuevo perfil</Label>
              <div className="flex gap-2">
                <IconPicker value={newProfileIcon} onChange={setNewProfileIcon} />
                <Input
                  placeholder="Nombre del perfil (ej: Trabajo)"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProfile();
                  }}
                  className="flex-1"
                />
                <Button onClick={handleCreateProfile} disabled={!newProfileName.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Crear
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
