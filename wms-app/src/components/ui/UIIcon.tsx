// @ts-nocheck
import { Search, Plus, PackageOpen, Filter, Check, ShieldCheck, Clock, AlertTriangle, XCircle, Boxes, RotateCcw } from "lucide-react";

const iconMap = {
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
};

export const UIIcon = ({ name, size = 14, color = "currentColor" }) => {
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={2} />;
};
