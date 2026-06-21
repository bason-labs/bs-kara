export interface AgentTask {
  context: string;
  acceptance: string;
  scope: string;
  area: string;
}

const AREAS = ['web', 'mobile', 'shared', 'e2e', 'infra', 'multiple'];

function section(body: string, heading: string): string {
  const re = new RegExp(`###\\s+${heading}\\s*\\n([\\s\\S]*?)(?:\\n###\\s|$)`, 'i');
  const m = body.match(re);
  if (!m) throw new Error(`agent_task issue is missing the "${heading}" section`);
  return m[1].trim();
}

export function parseAgentTaskIssue(body: string): AgentTask {
  const context = section(body, 'Context');
  const acceptance = section(body, 'Acceptance criteria');
  const scope = section(body, 'Scope boundaries');
  const areaRaw = section(body, 'Area').toLowerCase();
  const area = AREAS.find((a) => areaRaw.startsWith(a)) ?? areaRaw;
  return { context, acceptance, scope, area };
}
