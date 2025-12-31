import { DashboardProfile } from "@/hooks/useDashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid } from "lucide-react";

interface ProfileSelectorProps {
  profiles: DashboardProfile[];
  activeProfileId: string;
  onSwitch: (profileId: string) => void;
}

export const ProfileSelector = ({
  profiles,
  activeProfileId,
  onSwitch,
}: ProfileSelectorProps) => {
  if (profiles.length <= 1) return null;

  return (
    <Select value={activeProfileId} onValueChange={onSwitch}>
      <SelectTrigger className="w-[140px] h-8">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {profiles.map((profile) => (
          <SelectItem key={profile.id} value={profile.id}>
            {profile.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
