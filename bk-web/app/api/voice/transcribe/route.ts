import { toFile } from 'openai';
import { parseBuffer } from 'music-metadata';
import { bearer, limitedBytes, respond, runtimeServices } from '@/features/voice/server/http';
import { VoiceError } from '@/features/voice/server/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const MAX_AUDIO = 2 * 1024 * 1024;
const formats: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };
export async function POST(req: Request) {
  return respond(async () => {
    const token = bearer(req);
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.startsWith('multipart/form-data;')) throw new VoiceError(415, 'Multipart audio required.');
    const bytes = await limitedBytes(req, MAX_AUDIO + 16_384);
    let form: FormData;
    try { form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData(); }
    catch { throw new VoiceError(400, 'Invalid multipart audio.'); }
    const sessionId = form.get('sessionId');
    const audio = form.get('audio');
    if (typeof sessionId !== 'string' || !audio || typeof audio === 'string' || form.getAll('audio').length !== 1 || form.getAll('sessionId').length !== 1) throw new VoiceError(400, 'Session and one audio file required.');
    const mime = audio.type.split(';')[0];
    if (!formats[mime]) throw new VoiceError(415, 'Unsupported audio format.');
    if (!audio.size) throw new VoiceError(400, 'Audio is empty.');
    if (audio.size > MAX_AUDIO) throw new VoiceError(413, 'Audio is too large.');
    const { service, client } = runtimeServices();
    const session = await service.authenticate(sessionId, token);
    await service.limit('transcribe-global', 60);
    await service.limit(`transcribe-${session.roomCode}`, 12);
    const buffer = Buffer.from(await audio.arrayBuffer());
    let duration: number | undefined;
    try { duration = (await parseBuffer(buffer, { mimeType: mime, size: audio.size }, { duration: true })).format.duration; }
    catch { throw new VoiceError(422, 'Audio container is invalid or unreadable.'); }
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) throw new VoiceError(422, 'Audio duration is unavailable.');
    if (duration > 45) throw new VoiceError(413, 'Audio must be 45 seconds or shorter.');
    const result = await client.audio.transcriptions.create({
      model: 'whisper-1', language: session.language, response_format: 'verbose_json',
      file: await toFile(buffer, `voice.${formats[mime]}`, { type: mime }),
    });
    const text = result.text.trim();
    if (!text || text.length > 2000) throw new VoiceError(422, 'No usable speech detected.');
    await service.authenticate(sessionId, token);
    return { text };
  });
}
