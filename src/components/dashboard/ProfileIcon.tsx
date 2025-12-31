import {
  Briefcase,
  Home,
  User,
  Star,
  Heart,
  Zap,
  Target,
  Rocket,
  Coffee,
  Sun,
  Moon,
  Sparkles,
  Flame,
  LayoutGrid,
  LucideIcon,
} from "lucide-react";
import { ProfileIconName } from "@/hooks/useDashboardLayout";

// Map icon names to actual icon components
const iconComponents: Record<ProfileIconName, LucideIcon> = {
  "layout-grid": LayoutGrid,
  "briefcase": Briefcase,
  "home": Home,
  "user": User,
  "star": Star,
  "heart": Heart,
  "zap": Zap,
  "target": Target,
  "rocket": Rocket,
  "coffee": Coffee,
  "sun": Sun,
  "moon": Moon,
  "sparkles": Sparkles,
  "flame": Flame,
};

interface ProfileIconProps {
  name: ProfileIconName;
  className?: string;
}

export const ProfileIcon = ({ name, className }: ProfileIconProps) => {
  const IconComponent = iconComponents[name] || LayoutGrid;
  return <IconComponent className={className} />;
};

export const getProfileIconComponent = (name: ProfileIconName): LucideIcon => {
  return iconComponents[name] || LayoutGrid;
};
