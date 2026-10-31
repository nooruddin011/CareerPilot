import { NextResponse } from 'next/server';
import { careerAi } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 90;

const destinations = new Set(['Dashboard', 'Career profile', 'Skill gap analysis', 'Learning roadmap', 'Portfolio', 'Interview studio', 'Process tracker', 'Application tracker', 'Career analytics']);
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const clarify = (intent: Record<string, any>, message: string) => ({
  intent: { ...intent, action: 'clarify', clarification: message },
  message,
  proposals: [],
});

export async function POST(req: Request) {
  const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  const limit = rateLimit(`agent:${address}`, 12, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: 'Career agent request limit reached. Please wait a few minutes before trying again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });

  try {
    const body = await req.json();
    const command = typeof body?.command === 'string' ? body.command.trim() : '';
    const context = body?.context;
    const conversation = Array.isArray(body?.conversation) ? body.conversation.slice(-12).filter((item: unknown) => record(item) && typeof item.text === 'string').map((item: any) => ({ role: item.role === 'user' ? 'user' : 'assistant', text: item.text.slice(0, 2000) })) : [];
    if (command.length < 3 || command.length > 4000 || !record(context)) return NextResponse.json({ error: 'Provide a career request and saved profile context.' }, { status: 400 });
    if (JSON.stringify(context).length > 90_000) return NextResponse.json({ error: 'Career context is too large. Reduce saved job description or resume details and retry.' }, { status: 413 });

    const output = await careerAi.interpretCommand({ text: command, conversation, context });
    const parsed = output as Record<string, any>;
    const intents: Array<Record<string, any>> = Array.isArray(parsed.actions) ? parsed.actions : [parsed];
    const profile = record(context.profile) ? context.profile : {};
    const tasks = Array.isArray(context.tasks) ? context.tasks : [];
    const projects = Array.isArray(context.projects) ? context.projects : [];
    const proposals: Array<Record<string, unknown>> = [];
    let message = parsed.summary || intents.map(action => action.summary).filter(Boolean).join(' · ') || 'I understood your request.';
    let navigation: string | undefined;
    let result: Record<string, unknown> | undefined;

    for (const intent of intents) {
    switch (intent.action) {
      case 'clarify':
        return NextResponse.json(clarify(intent, intent.clarification || 'What would you like to change?'));
      case 'navigate':
        if (!destinations.has(intent.destination)) return NextResponse.json(clarify(intent, 'Which CareerPilot section would you like to open?'));
        navigation = intent.destination;
        message += ` Opening ${navigation}.`;
        break;
      case 'update_hours':
        if (!Number.isFinite(intent.hours) || intent.hours < 1 || intent.hours > 40) return NextResponse.json(clarify(intent, 'How many study hours per week should I plan for? Please choose between 1 and 40.'));
        proposals.push({ kind: 'update_hours', summary: `Set weekly study availability to ${intent.hours} hours`, reason: intent.reason, payload: { hours: intent.hours } });
        message += ' Review the proposed change and confirm it before I update your plan.';
        break;
      case 'complete_task': {
        const task = tasks.find((item: any) => item.id === intent.itemId || (intent.itemName && item.title?.toLowerCase() === intent.itemName.toLowerCase()));
        if (!task) return NextResponse.json(clarify(intent, 'Which roadmap task should I mark complete? I could not match that name to your saved tasks.'));
        proposals.push({ kind: 'complete_task', summary: `Mark “${task.title}” complete`, reason: intent.reason, payload: { taskId: task.id } });
        message += ' This will update your roadmap progress after confirmation.';
        break;
      }
      case 'complete_project': {
        const project = projects.find((item: any) => item.id === intent.itemId || (intent.itemName && item.title?.toLowerCase() === intent.itemName.toLowerCase()));
        if (!project) return NextResponse.json(clarify(intent, 'Which saved portfolio project should I mark complete?'));
        proposals.push({ kind: 'complete_project', summary: `Mark “${project.title}” complete`, reason: intent.reason, payload: { projectId: project.id } });
        message += ' Your portfolio progress changes only after confirmation.';
        break;
      }
      case 'add_task':
        if (!intent.title?.trim()) return NextResponse.json(clarify(intent, 'What learning task would you like me to add?'));
        proposals.push({ kind: 'add_task', summary: `Add “${intent.title}” to ${intent.week || 'Week 1'}`, reason: intent.reason, payload: { title: intent.title.trim(), week: intent.week || 'Week 1' } });
        message += ' Review and confirm before adding it to your roadmap.';
        break;
      case 'add_progress_note':
        if (!intent.note?.trim()) return NextResponse.json(clarify(intent, 'What progress note should I save?'));
        proposals.push({ kind: 'add_progress_note', summary: 'Save this progress note', reason: intent.reason, payload: { note: intent.note.trim(), itemId: intent.itemId, itemName: intent.itemName } });
        message += ' I’ll save the note to your progress history after you confirm.';
        break;
      case 'analyse_progress': {
        const progress = await careerAi.analyzeProgress({ profile, hours: context.hours, deadlineWeeks: context.durationWeeks, tasks, projects, interviewReports: context.interviewReports, interviewScores: context.interviews, applications: context.applications });
        result = { ...result, progress };
        for (const change of (progress as any).proposed_changes || []) proposals.push({ kind: 'progress_change', summary: `${change.action.replaceAll('_', ' ')}${change.title ? `: ${change.title}` : ''}`, reason: change.reason, impact: change.impact, payload: change });
        message = `${(progress as any).reasoning} Review each suggested adjustment below. Nothing changes until you accept it.`;
        navigation = 'Process tracker';
        break;
      }
      case 'analyse_applications': {
        const applications = Array.isArray(context.applications) ? context.applications : [];
        const responses = applications.filter((a: any) => !['Applied', 'Interested'].includes(a.status)).length;
        const interviewCount = applications.filter((a: any) => ['Interview', 'Offer'].includes(a.status)).length;
        const analysis = await careerAi.analyzeApplications({ applications, profile, metrics: { total: applications.length, responses, responseRate: applications.length ? Math.round(responses / applications.length * 100) : 0, interviews: interviewCount, interviewConversion: applications.length ? Math.round(interviewCount / applications.length * 100) : 0, rejections: applications.filter((a: any) => a.status === 'Rejected').length } });
        result = { ...result, applicationInsights: analysis };
        message = `${(analysis as any).summary} ${(analysis as any).dataQuality}`;
        navigation = 'Career analytics';
        break;
      }
      case 'generate_roadmap': {
        const roadmap = await careerAi.generateRoadmap({ role: profile.role, skills: profile.skills, resume: profile.resumeAnalysis, gaps: profile.gaps, jobs: context.jobRecords, hours: context.hours, durationWeeks: context.durationWeeks, tasks });
        result = { ...result, pendingRoadmap: roadmap };
        message = 'I generated a roadmap proposal using your saved skill gaps, job requirements, available hours and deadline. Review it before applying.';
        navigation = 'Learning roadmap';
        break;
      }
      case 'recommend_projects': {
        const recommended = await careerAi.recommendProjects({ role: profile.role, skills: profile.skills, resume: profile.resumeAnalysis, gaps: profile.gaps, jobRecords: context.jobRecords, projects });
        const rows = (recommended as any).projects || [];
        if (!rows.length) return NextResponse.json(clarify(intent, 'I could not identify a project that fits the current evidence. Add a target job description or skill gap first.'));
        proposals.push({ kind: 'add_projects', summary: `Add ${rows.length} Gemini-recommended portfolio project${rows.length === 1 ? '' : 's'}`, reason: intent.reason, payload: { projects: rows } });
        message = 'These projects are based on the skills your saved job descriptions request. Review and confirm to add them to your portfolio.';
        navigation = 'Portfolio';
        break;
      }
      case 'generate_interview_questions': {
        const questions = await careerAi.generateInterviewQuestions({ role: profile.role, gaps: profile.gaps, jobRecords: context.jobRecords, interviewType: intent.interviewType || 'mixed', difficulty: intent.difficulty || 'medium', count: Math.max(1, Math.min(8, Number(intent.count) || 5)), interviewReports: context.interviewReports });
        result = { ...result, interviewQuestions: questions };
        message = `Generated ${(questions as any).questions?.length || 0} interview questions grounded in your role and saved preparation history.`;
        navigation = 'Interview studio';
        break;
      }
      default:
        return NextResponse.json(clarify(intent, 'I’m not sure which career action you mean. Could you rephrase the request?'));
    }
    }

    return NextResponse.json({ intent: parsed, message, navigation, result, proposals });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status: unknown }).status) : 500;
    const message = error instanceof Error ? error.message : 'Career agent request failed. Please try again.';
    if (status >= 500) console.error('CareerPilot agent request failed:', message);
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : undefined;
    return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status: status >= 400 && status <= 599 ? status : 500 });
  }
}
