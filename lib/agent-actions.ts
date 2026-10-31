/** Produces a state patch for a reviewed agent action. A null result means it is invalid or stale. */
export function applyAgentProposal(state: any, action: any): Record<string, any> | null {
  const payload = action.payload || {};
  if (action.kind === 'update_hours' && Number.isFinite(payload.hours) && payload.hours >= 1 && payload.hours <= 40) {
    return { hours: payload.hours };
  }
  if (action.kind === 'complete_task' && state.tasks.some((task: any) => task.id === payload.taskId)) {
    return { tasks: state.tasks.map((task: any) => task.id === payload.taskId ? { ...task, done: true } : task) };
  }
  if (action.kind === 'complete_project' && state.projects.some((project: any) => project.id === payload.projectId)) {
    return { projects: state.projects.map((project: any) => project.id === payload.projectId ? { ...project, progress: 100 } : project) };
  }
  if (action.kind === 'add_task' && typeof payload.title === 'string' && payload.title.trim()) {
    return { tasks: [...state.tasks, { id: Date.now(), title: payload.title.trim(), week: payload.week || 'Week 1', done: false, skill: state.gaps[0] || 'Career skill' }] };
  }
  if (action.kind === 'add_progress_note' && typeof payload.note === 'string' && payload.note.trim()) {
    return { progressNotes: [...(state.progressNotes || []), { id: Date.now(), note: payload.note.trim(), itemName: payload.itemName || null, createdAt: new Date().toISOString() }] };
  }
  if (action.kind === 'add_projects' && Array.isArray(payload.projects) && payload.projects.length) {
    const projects = payload.projects.map((project: any, index: number) => ({
      id: Date.now() + index,
      title: String(project.title || 'Portfolio project'),
      skills: Array.isArray(project.skills) ? project.skills : [],
      progress: 0,
      level: project.difficulty || 'Intermediate',
      problem: project.problem,
      why: project.why,
      technologies: Array.isArray(project.technologies) ? project.technologies : [],
      duration: project.duration,
      milestones: Array.isArray(project.milestones) ? project.milestones : [],
      resume_value: project.resume_value,
    }));
    return { projects: [...state.projects, ...projects] };
  }
  return null;
}
