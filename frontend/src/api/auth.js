import client, { setTokens, clearTokens } from "./client";

export async function signup(payload) {
  const res = await client.post("/auth/signup/", payload);
  return res.data;
}

export async function login({ username, password }) {
  const res = await client.post("/auth/login/", { username, password });
  setTokens({ access: res.data.access, refresh: res.data.refresh });
  return res.data;
}

export function logout() {
  clearTokens();
}

export async function getMe() {
  const res = await client.get("/auth/me/");
  return res.data;
}

export async function updateMe(payload, isMultipart = false) {
  const res = await client.patch("/auth/me/", payload, {
    headers: isMultipart ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return res.data;
}

export async function getPublicProfile(userId) {
  const res = await client.get(`/auth/profile/${userId}/`);
  return res.data;
}

export async function listExperience() {
  const res = await client.get("/auth/experience/");
  return res.data;
}

export async function addExperience(payload) {
  const res = await client.post("/auth/experience/", payload);
  return res.data;
}

export async function updateExperience(id, payload) {
  const res = await client.patch(`/auth/experience/${id}/`, payload);
  return res.data;
}

export async function deleteExperience(id) {
  await client.delete(`/auth/experience/${id}/`);
}

export async function searchCandidates(params) {
  const res = await client.get("/auth/candidates/search/", { params });
  return res.data;
}

export async function googleSignIn(id_token) {
  const res = await client.post("/auth/google/", { id_token });
  if (res.data.access && res.data.refresh) setTokens({ access: res.data.access, refresh: res.data.refresh });
  return res.data;
}

export async function passwordResetRequest(email, frontendUrl) {
  const res = await client.post("/auth/password-reset/", { email, frontend_url: frontendUrl });
  return res.data;
}

export async function passwordResetConfirm({ uid, token, new_password }) {
  const res = await client.post("/auth/password-reset-confirm/", { uid, token, new_password });
  return res.data;
}
