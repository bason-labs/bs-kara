export type Status = 'Todo' | 'In Progress' | 'In review' | 'Done';

export interface BoardConfig {
  owner: string;
  number: string;
  projectId?: string;
  statusFieldId: string;
  options: Record<Status, string>;
}

const REQUIRED = [
  'ACDC_PROJECT_OWNER',
  'ACDC_PROJECT_NUMBER',
  'ACDC_STATUS_FIELD_ID',
  'ACDC_STATUS_TODO',
  'ACDC_STATUS_IN_PROGRESS',
  'ACDC_STATUS_IN_REVIEW',
  'ACDC_STATUS_DONE',
];

export function isBoardConfigured(env: NodeJS.ProcessEnv): boolean {
  return REQUIRED.every((k) => !!env[k]);
}

export function readBoardConfig(env: NodeJS.ProcessEnv): BoardConfig {
  if (!isBoardConfigured(env)) throw new Error('board not configured (missing ACDC_* env vars)');
  return {
    owner: env.ACDC_PROJECT_OWNER!,
    number: env.ACDC_PROJECT_NUMBER!,
    projectId: env.ACDC_PROJECT_ID,
    statusFieldId: env.ACDC_STATUS_FIELD_ID!,
    options: {
      Todo: env.ACDC_STATUS_TODO!,
      'In Progress': env.ACDC_STATUS_IN_PROGRESS!,
      'In review': env.ACDC_STATUS_IN_REVIEW!,
      Done: env.ACDC_STATUS_DONE!,
    },
  };
}

export function itemEditArgs(cfg: BoardConfig, itemId: string, status: Status): string[] {
  const opt = cfg.options[status];
  if (!opt) throw new Error(`unknown status: ${status}`);
  return [
    'project',
    'item-edit',
    '--id',
    itemId,
    '--project-id',
    cfg.projectId ?? '',
    '--field-id',
    cfg.statusFieldId,
    '--single-select-option-id',
    opt,
  ];
}
