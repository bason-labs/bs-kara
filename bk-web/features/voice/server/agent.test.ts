import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { runAgent } from './agent';
import type { Session } from './service';

const session: Session = { tokenHash: 'hash', roomCode: '1234', language: 'en', expiresAt: 999999, epoch: 0,
  history: [{ role: 'user', content: 'Happy Birthday' }, { role: 'assistant', content: 'Which number?' }],
  results: { searchId: 'list1', expiresAt: 999999, videos: [] } };

describe('intent extraction SDK boundary', () => {
  it('sends strict tools and recent context and extracts an ordinal tool call', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { tool_calls: [{ type: 'function', function: { name: 'chooseResult', arguments: '{"searchId":"list1","position":1}' } }] } }] });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    expect(await runAgent(client, 'The first one', session)).toEqual({ name: 'chooseResult', args: { searchId: 'list1', position: 1 } });
    const input = create.mock.calls[0][0];
    expect(input.parallel_tool_calls).toBe(false);
    expect(input.tools.every((tool: { function: { strict: boolean } }) => tool.function.strict)).toBe(true);
    expect(input.messages.slice(1)).toEqual([...session.history!, { role: 'user', content: 'The first one' }]);
  });

  it.each([{ calls: [] }, { calls: [{ type: 'function', function: { name: 'reply', arguments: 'invalid' } }] }])('rejects malformed provider output', async ({ calls }) => {
    const client = { chat: { completions: { create: async () => ({ choices: [{ message: { tool_calls: calls } }] }) } } } as unknown as OpenAI;
    await expect(runAgent(client, 'Hello', session)).rejects.toMatchObject({ status: 502 });
  });
});
