import mammoth from 'mammoth';
// Import the parser module directly: the package entry point includes a debug
// fixture runner that can execute when bundled by Next.js.
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<{ text: string }>;
import { NextResponse } from 'next/server';
import { careerAi } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  const limit = rateLimit(`resume:${address}`, 6, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: 'Resume analysis limit reached. Please wait a few minutes before uploading again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  try {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) return NextResponse.json({ error: 'Upload a PDF or DOCX resume using the file upload form.' }, { status: 400 });
    const form = await req.formData();
    const candidate = form.get('file');
    const role = String(form.get('role') || '').slice(0, 200);
    if (!(candidate instanceof File)) return NextResponse.json({ error: 'Choose a PDF or DOCX resume to analyse.' }, { status: 400 });
    if (!candidate.size || candidate.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Resume files must be between 1 byte and 10 MB.' }, { status: 413 });
    const extension = candidate.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(extension || '')) return NextResponse.json({ error: 'Only PDF and DOCX resume files are supported.' }, { status: 415 });
    const buffer = Buffer.from(await candidate.arrayBuffer());
    let resumeText = '';
    if (extension === 'pdf') {
      if (buffer.subarray(0, 5).toString() !== '%PDF-') return NextResponse.json({ error: 'This file does not appear to be a valid PDF.' }, { status: 415 });
      const parsed = await pdfParse(buffer);
      resumeText = parsed.text;
    } else {
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return NextResponse.json({ error: 'This file does not appear to be a valid DOCX document.' }, { status: 415 });
      const parsed = await mammoth.extractRawText({ buffer });
      resumeText = parsed.value;
    }
    resumeText = resumeText.replace(/\u0000/g, '').trim();
    if (resumeText.length < 40) return NextResponse.json({ error: 'Could not extract enough selectable text. If this is a scanned PDF, paste its text or use OCR first.' }, { status: 422 });
    if (resumeText.length > 100_000) resumeText = resumeText.slice(0, 100_000);
    const data = await careerAi.analyzeResume({ resume: resumeText, targetRole: role, fileName: candidate.name });
    return NextResponse.json({ mode: 'live', data });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number((error as {status: unknown}).status) : 500;
    const message = error instanceof Error ? error.message : 'Resume analysis failed. Please try again.';
    if (status >= 500) console.error('CareerPilot resume analysis failed:', message);
    return NextResponse.json({ error: message }, { status: status >= 400 && status <= 599 ? status : 500 });
  }
}
