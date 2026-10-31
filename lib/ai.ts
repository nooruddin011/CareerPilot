import { GoogleGenAI } from '@google/genai';

export const AI_INSTRUCTIONS = {
  connection_test: 'Return JSON with ok true and message "Gemini connection is working."',
  resume_analysis: 'Extract a resume without inventing details. Return JSON with summary (string), education, experience, skills, achievements (string arrays), and projects (array of {title, description, skills:string[]}). Preserve specific employers, dates, metrics and qualifications only when present.',
  job_analysis: 'Analyse only the supplied job description. Return JSON with summary (string), jobTitle (string), experienceLevel (string), requiredSkills (array of {name, category, importance, evidence, proficiency}), qualifications (string array), responsibilities (string array), and gaps (string array). Evidence must quote or closely paraphrase the supplied text. Do not imply you visited a URL.',
  skill_gap: 'Compare the supplied profile and all supplied job descriptions. Return JSON with summary (string), matchPercentage (integer 0-100), matchedSkills, improvingSkills, missingSkills (each an array of {name, category, importance, evidence, currentProficiency, recommendedProficiency, frequency}), and gaps (array of missing skill names). Count frequency only across provided descriptions. Separate confirmed skills from skills with no resume evidence.',
  roadmap: 'Make a personalized week-by-week plan based on target role, gaps, preparation duration, actual weekly hours and supplied postings. Return JSON with weeks (array of {week:integer, objective:string, tasks:string[], resources:string[], milestone:string, hours:number}). Fit the stated time budget and deadline.',
  projects: 'Recommend practical projects directly tied to supplied job requirements and user gaps. Return JSON with projects (array of {title, problem, why, skills:string[], technologies:string[], difficulty, duration, milestones:string[], resume_value}). Do not imply a project is already completed.',
  interview_questions: 'Generate exactly the requested number of questions relevant to target role, interview type and difficulty, using supplied gaps and job descriptions. Return JSON with questions (array of {question, type, why, evaluation_focus:string[]}).',
  interview_evaluation: 'Evaluate this answer fairly against its question. Return JSON with questionScore integer 0-100, overallScore integer 0-100, rubric object with technical_accuracy, depth, problem_solving, communication, relevance each integer 0-100, strengths:string[], weaknesses:string[], feedback:string[], stronger_answer:string, topics:string[]. Base the scores on the submitted answer; do not reward facts not present.',
  progress: 'Review completed and missed tasks, projects, skill improvements, interview results, remaining deadline and available study hours. Return JSON with reasoning:string, proposed_changes array of {action (adjust_hours|reschedule_task|add_task|complete_task), taskId (number|null), hours (number|null), week (string), title (string), reason (string), impact (string)}, risks:string[]. Proposals are previews only. Preserve deadline when feasible and explain tradeoffs.',
  application_analysis: 'Analyse only the supplied application records and supplied computed metrics. Return JSON with summary:string, dataQuality:string, confidence (limited|directional|strong), observedPatterns:string[], roleInsights array of {role, applications:number, responses:number, interviews:number}, resumeInsights array of {resumeVersion, applications:number, responses:number, interviews:number}, recommendations:string[]. Avoid causal claims. If sample sizes are small, say conclusions are limited and do not infer correlations.',
  command: 'Understand a complete conversational request, including filler, corrections, digressions and multiple instructions. Use saved context and conversation turns to resolve follow-ups like “that project” and “the task I missed”; the latest correction overrides earlier values. Return one top-level summary, reason and clarification, plus actions: an ordered array of up to five actionable intents. For each intent choose one action: update_hours, complete_project, complete_task, add_task, add_progress_note, analyse_progress, analyse_applications, generate_roadmap, recommend_projects, generate_interview_questions, navigate, or clarify. Each action object must include action, summary, reason, clarification, hours (number|null), itemId (number|null), itemName (string|null), title (string|null), note (string|null), week (string|null), destination (string|null), interviewType (technical|behavioural|mixed|null), difficulty (easy|medium|hard|null), and count (number|null). Resolve task/project names only against supplied context and use exact numeric IDs. If essential details are missing, return a single clarify action asking one focused question and do not mix it with changes. Preserve user corrections and latest stated values. For roadmap and progress requests use the corresponding analysis actions. For application strategy use analyse_applications. For interview practice use generate_interview_questions. Navigation requests use one of Dashboard, Career profile, Skill gap analysis, Learning roadmap, Portfolio, Interview studio, Process tracker, Application tracker, Career analytics. Never claim modifications are completed; these intents only prepare actions for explicit review and confirmation.'
} as const;

export type AiKind = keyof typeof AI_INSTRUCTIONS;
type JsonObject = Record<string, unknown>;
const object = (v: unknown): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
const array = (v: unknown): v is unknown[] => Array.isArray(v);
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');

export function validateAiOutput(kind: AiKind, value: unknown): string | null {
  if (!object(value)) return 'Gemini returned an invalid JSON object.';
  const hasObjectRows = (key: string, required: string) => array(value[key]) && value[key].every(row => object(row) && typeof row[required] === 'string');
  if (kind === 'connection_test' && (value.ok !== true || typeof value.message !== 'string')) return 'Gemini connection test response was invalid.';
  if (kind === 'resume_analysis' && (typeof value.summary !== 'string' || !['education','experience','skills','achievements'].every(k => strings(value[k])) || !hasObjectRows('projects','title'))) return 'Resume analysis did not match the required structure.';
  if (kind === 'job_analysis' && (typeof value.summary !== 'string' || typeof value.experienceLevel !== 'string' || !strings(value.qualifications) || !strings(value.responsibilities) || !hasObjectRows('requiredSkills','name') || !strings(value.gaps))) return 'Job analysis did not match the required structure.';
  if (kind === 'skill_gap' && (typeof value.summary !== 'string' || typeof value.matchPercentage !== 'number' || value.matchPercentage < 0 || value.matchPercentage > 100 || !strings(value.gaps) || !['matchedSkills','improvingSkills','missingSkills'].every(k => hasObjectRows(k,'name')))) return 'Skill-gap analysis did not match the required structure.';
  if (kind === 'roadmap' && (!array(value.weeks) || !value.weeks.every(w => object(w) && typeof w.week === 'number' && typeof w.objective === 'string' && strings(w.tasks) && strings(w.resources) && typeof w.milestone === 'string' && typeof w.hours === 'number'))) return 'Roadmap did not match the required structure.';
  if (kind === 'projects' && (!array(value.projects) || !hasObjectRows('projects','title') || !value.projects.every(p => object(p) && strings(p.skills) && strings(p.technologies) && strings(p.milestones) && typeof p.problem === 'string' && typeof p.why === 'string' && typeof p.resume_value === 'string'))) return 'Project recommendations did not match the required structure.';
  if (kind === 'interview_questions' && (!array(value.questions) || !value.questions.every(q => object(q) && typeof q.question === 'string' && typeof q.type === 'string' && strings(q.evaluation_focus)))) return 'Interview questions did not match the required structure.';
  if (kind === 'interview_evaluation') {
    const rubric = object(value.rubric) ? value.rubric : null;
    if (typeof value.questionScore !== 'number' || typeof value.overallScore !== 'number' || !rubric || !['technical_accuracy','depth','problem_solving','communication','relevance'].every(k => typeof rubric[k] === 'number') || !strings(value.strengths) || !strings(value.weaknesses) || !strings(value.feedback) || !strings(value.topics) || typeof value.stronger_answer !== 'string') return 'Interview evaluation did not match the required structure.';
  }
  if (kind === 'progress' && (typeof value.reasoning !== 'string' || !strings(value.risks) || !array(value.proposed_changes) || !value.proposed_changes.every(p => object(p) && ['adjust_hours','reschedule_task','add_task','complete_task'].includes(String(p.action)) && typeof p.reason === 'string' && typeof p.impact === 'string'))) return 'Progress analysis did not match the required structure.';
  if (kind === 'application_analysis' && (typeof value.summary !== 'string' || typeof value.dataQuality !== 'string' || !['limited','directional','strong'].includes(String(value.confidence)) || !strings(value.observedPatterns) || !array(value.recommendations) || !value.recommendations.every(r => typeof r === 'string') || !array(value.roleInsights) || !array(value.resumeInsights))) return 'Application analysis did not match the required structure.';
  if (kind === 'command') {
    const validActions = new Set(['update_hours','complete_project','complete_task','add_task','add_progress_note','analyse_progress','analyse_applications','generate_roadmap','recommend_projects','generate_interview_questions','navigate','clarify']);
    const validCommand = (item: unknown) => object(item) && validActions.has(String(item.action)) && typeof item.summary === 'string' && typeof item.reason === 'string' && typeof item.clarification === 'string' && (typeof item.hours === 'number' || item.hours === null) && (typeof item.itemId === 'number' || item.itemId === null) && (typeof item.itemName === 'string' || item.itemName === null) && (typeof item.title === 'string' || item.title === null) && (typeof item.note === 'string' || item.note === null) && (typeof item.week === 'string' || item.week === null) && (typeof item.destination === 'string' || item.destination === null) && (typeof item.interviewType === 'string' || item.interviewType === null) && (typeof item.difficulty === 'string' || item.difficulty === null) && (typeof item.count === 'number' || item.count === null);
    if (!validCommand(value) || !array(value.actions) || value.actions.length < 1 || value.actions.length > 5 || !value.actions.every(validCommand)) return 'Command interpretation did not match the required structure.';
  }
  return null;
}

export async function generateCareerAI(kind: AiKind, payload: unknown) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw Object.assign(new Error('Gemini is not configured. Add GEMINI_API_KEY to .env.local and restart CareerPilot.'), { status: 503, code: 'GEMINI_API_KEY_MISSING' });
  const client = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
  const input = JSON.stringify(payload ?? {});
  let response;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await client.models.generateContent({
        model,
        contents: input,
        config: { systemInstruction: `You are CareerPilot, a careful and evidence-led career coach. Use only supplied user data. Do not fabricate job requirements, qualifications, experience or outcomes. ${AI_INSTRUCTIONS[kind]} Return valid JSON only.`, responseMimeType: 'application/json', temperature: 0.3 }
      });
      break;
    } catch (error) {
      const status = object(error) ? Number(error.status) : 0;
      if (status === 429) throw Object.assign(new Error('Gemini has reached its request quota for this model. Review the API quota or try again after it resets.'), { status: 429, code: 'GEMINI_QUOTA_EXCEEDED' });
      if (attempt === 0 && status === 503) { await new Promise(resolve => setTimeout(resolve, 500)); continue; }
      throw error;
    }
  }
  const text = response.text;
  if (!text) throw Object.assign(new Error('Gemini returned an empty response. Please retry.'), { status: 502 });
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error('Gemini returned malformed JSON. Please retry.'), { status: 502 }); }
  if (kind === 'command' && object(data)) {
    const defaults = { hours: null, itemId: null, itemName: null, title: null, note: null, week: null, destination: null, interviewType: null, difficulty: null, count: null };
    const rawActions = Array.isArray(data.actions) ? data.actions : [data];
    const actions = rawActions.map((action: unknown) => object(action) ? { ...defaults, ...action } : action);
    const first = object(actions[0]) ? actions[0] : {};
    data = { ...defaults, ...first, ...data, summary: typeof data.summary === 'string' ? data.summary : first.summary, reason: typeof data.reason === 'string' ? data.reason : first.reason, action: typeof data.action === 'string' ? data.action : first.action, actions };
  }
  const validationError = validateAiOutput(kind, data);
  if (validationError) throw Object.assign(new Error(validationError), { status: 502 });
  return data as JsonObject;
}

export const careerAi = {
  analyzeResume: (payload: unknown) => generateCareerAI('resume_analysis', payload),
  analyzeJobDescription: (payload: unknown) => generateCareerAI('job_analysis', payload),
  mapSkillGaps: (payload: unknown) => generateCareerAI('skill_gap', payload),
  generateRoadmap: (payload: unknown) => generateCareerAI('roadmap', payload),
  recommendProjects: (payload: unknown) => generateCareerAI('projects', payload),
  generateInterviewQuestions: (payload: unknown) => generateCareerAI('interview_questions', payload),
  evaluateInterviewAnswer: (payload: unknown) => generateCareerAI('interview_evaluation', payload),
  analyzeProgress: (payload: unknown) => generateCareerAI('progress', payload),
  analyzeApplications: (payload: unknown) => generateCareerAI('application_analysis', payload),
  interpretCommand: (payload: unknown) => generateCareerAI('command', payload),
  testConnection: () => generateCareerAI('connection_test', { ping: 'connection test' })
};
