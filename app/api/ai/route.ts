import { NextResponse } from 'next/server';
import { careerAi, type AiKind } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const handlers: Record<AiKind, (payload: unknown) => Promise<unknown>> = {
  connection_test: () => careerAi.testConnection(),
  resume_analysis: careerAi.analyzeResume,
  job_analysis: careerAi.analyzeJobDescription,
  skill_gap: careerAi.mapSkillGaps,
  roadmap: careerAi.generateRoadmap,
  projects: careerAi.recommendProjects,
  interview_questions: careerAi.generateInterviewQuestions,
  interview_evaluation: careerAi.evaluateInterviewAnswer,
  progress: careerAi.analyzeProgress,
  application_analysis: careerAi.analyzeApplications,
  command: careerAi.interpretCommand
};

export async function POST(req: Request) {
  const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  const limit = rateLimit(`ai:${address}`, 24, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: 'CareerPilot AI request limit reached. Please wait a few minutes before trying again.', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  try {
    const body = await req.json();
    if (!body || typeof body.kind !== 'string' || !(body.kind in handlers)) return NextResponse.json({ error: 'Unsupported AI task.' }, { status: 400 });
    const encoded = JSON.stringify(body.payload ?? {});
    if (encoded.length > 100_000) return NextResponse.json({ error: 'This request is too large. Keep pasted career material under 100 KB.' }, { status: 413 });
    const data = await handlers[body.kind as AiKind](body.payload ?? {});
    return NextResponse.json({ mode: 'live', data });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number((error as {status: unknown}).status) : 500;
    const message = error instanceof Error ? error.message : 'Gemini request failed. Please try again.';
    if (status >= 500) console.error('CareerPilot AI request failed:', message);
    return NextResponse.json({ error: message, ...(error && typeof error === 'object' && 'code' in error ? { code: String((error as {code: unknown}).code) } : {}) }, { status: status >= 400 && status <= 599 ? status : 500 });
  }
}
