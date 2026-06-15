import type { LucideProps } from 'lucide-react';
import {
  Activity,
  Cloud,
  CloudRain,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Sun,
  Thermometer,
  Wind,
  Zap,
  Waves,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface BlockIconDef {
  readonly name: string;
  readonly label: string;
  readonly Icon: ComponentType<LucideProps>;
}

/** Curated weather icons available for custom metric blocks. */
export const BLOCK_ICONS: readonly BlockIconDef[] = [
  { name: 'Thermometer', label: 'Temperature', Icon: Thermometer },
  { name: 'Wind',        label: 'Wind',        Icon: Wind },
  { name: 'Droplets',    label: 'Humidity',    Icon: Droplets },
  { name: 'CloudRain',   label: 'Rain',        Icon: CloudRain },
  { name: 'Sun',         label: 'Sun / UV',    Icon: Sun },
  { name: 'Gauge',       label: 'Pressure',    Icon: Gauge },
  { name: 'Compass',     label: 'Direction',   Icon: Compass },
  { name: 'Cloud',       label: 'Cloud',       Icon: Cloud },
  { name: 'Waves',       label: 'Water',       Icon: Waves },
  { name: 'Zap',         label: 'Solar',       Icon: Zap },
  { name: 'Eye',         label: 'Visibility',  Icon: Eye },
  { name: 'Activity',    label: 'General',     Icon: Activity },
] as const;

const ICON_MAP = new Map<string, ComponentType<LucideProps>>(
  BLOCK_ICONS.map(({ name, Icon }) => [name, Icon]),
);

/** Resolves an icon name string to its Lucide component, or null if not found. */
export function resolveBlockIcon(name: string | null | undefined): ComponentType<LucideProps> | null {
  if (!name) return null;
  return ICON_MAP.get(name) ?? null;
}
