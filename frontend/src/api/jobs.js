import client from "./client";

export async function listJobs(params) {
  const res = await client.get("/jobs/", { params });
  return res.data;
}

export async function getJob(id) {
  const res = await client.get(`/jobs/${id}/`);
  return res.data;
}

export async function createJob(payload) {
  const res = await client.post("/jobs/", payload);
  return res.data;
}

export async function updateJob(id, payload) {
  const res = await client.patch(`/jobs/${id}/`, payload);
  return res.data;
}

export async function deleteJob(id) {
  await client.delete(`/jobs/${id}/`);
}

export async function applyToJob(jobId, resumeFile) {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  const res = await client.post(`/jobs/${jobId}/apply/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function myApplications() {
  const res = await client.get("/jobs/my-applications/");
  return res.data;
}

export async function jobApplications(jobId, statusFilter) {
  const res = await client.get(`/jobs/${jobId}/applications/`, {
    params: statusFilter ? { status: statusFilter } : {},
  });
  return res.data;
}

export async function recruiterDashboard() {
  const res = await client.get("/jobs/recruiter/dashboard/");
  return res.data;
}
