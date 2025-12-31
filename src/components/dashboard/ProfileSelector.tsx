import { DashboardProfile, ProfileIconName, PROFILE_ICONS } from "@/hooks/useDashboardLayout";
import { ProfileIcon } from "./ProfileIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <Select value={activeProfileId} onValueChange={onSwitch}>
      <SelectTrigger className="w-[150px] h-8">
        <div className="flex items-center gap-2">
          {activeProfile && (
            <ProfileIcon name={activeProfile.icon} className="w-3.5 h-3.5" />
          )}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {profiles.map((profile) => (
          <SelectItem key={profile.id} value={profile.id}>
            <div className="flex items-center gap-2">
              <ProfileIcon name={profile.icon} className="w-4 h-4" />
              {profile.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
