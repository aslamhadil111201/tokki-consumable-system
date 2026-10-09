// @ts-nocheck
import { Search, Plus, PackageOpen, Filter, Check, ShieldCheck, Clock, AlertTriangle, XCircle, Boxes, RotateCcw, Trash2, Bell, CalendarDays, LogOut } from "lucide-react";

const iconMap = {
  logout: LogOut,
  bell: Bell,
  calendar: CalendarDays,
  search: Search,
  plus: Plus,
  receive: PackageOpen,
  filter: Filter,
  check: Check,
  shield: ShieldCheck,
  clock: Clock,
  alert: AlertTriangle,
  x: XCircle,
  boxes: Boxes,
  rotate: RotateCcw,
  trash: Trash2,
};

export const UIIcon = ({ name, size = 14, color = "currentColor" }) => {
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={2} />;
};
