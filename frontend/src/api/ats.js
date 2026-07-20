import client from './client';

export async function analyzeResume({ resumeFile, jobId }) {
  const form = new FormData();
  if (resumeFile) form.append('resume', resumeFile);
  if (jobId) form.append('job_id', jobId);
  const res = await client.post('/ats/resume-analysis/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
}

export async function recommendJobs() {
  const res = await client.get('/ats/recommend-jobs/');
  return res.data;
}

export async function autoCreateResume() {
  const res = await client.get('/ats/auto-create-resume/');
  return res.data;
}
