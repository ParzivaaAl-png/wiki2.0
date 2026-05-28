import { Layout, Server, Search, Cpu, FileText, ArrowRight } from 'lucide-react';

const iconMap = {
  layout: Layout,
  server: Server,
  search: Search,
  cpu: Cpu,
  file: FileText,
  arrow: ArrowRight,
};

export type IconName = keyof typeof iconMap;

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = iconMap[name as IconName] || FileText;
  return <IconComponent className={className} />;
}
