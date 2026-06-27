export interface Label {
  name: string;
  color: string;
  description: string;
}

export const AREA_LABEL_NAMES = [
  'area:web',
  'area:mobile',
  'area:shared',
  'area:e2e',
  'area:infra',
  'area:multiple',
] as const;

export const TIER_LABEL_NAMES = [
  'tier:low',
  'tier:medium',
  'tier:high',
] as const;

export function parseLabels(raw: string): Label[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('labels.json must be an array');
  return data.map((d, i) => {
    const o = d as Record<string, unknown>;
    if (typeof o.name !== 'string' || typeof o.color !== 'string' || typeof o.description !== 'string') {
      throw new Error(`labels.json[${i}] is malformed`);
    }
    return { name: o.name, color: o.color, description: o.description };
  });
}
