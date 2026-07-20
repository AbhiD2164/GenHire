import client from "./client";

export async function getFeed(params) {
  const res = await client.get("/network/feed/", { params });
  return res.data;
}

export async function createPost(payload, isMultipart = false) {
  const res = await client.post("/network/feed/", payload, {
    headers: isMultipart ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return res.data;
}

export async function deletePost(id) {
  await client.delete(`/network/posts/${id}/`);
}

export async function toggleLike(postId) {
  const res = await client.post(`/network/posts/${postId}/like/`);
  return res.data;
}

export async function getComments(postId) {
  const res = await client.get(`/network/posts/${postId}/comments/`);
  return res.data;
}

export async function addComment(postId, content) {
  const res = await client.post(`/network/posts/${postId}/comments/`, { content });
  return res.data;
}

export async function sendConnectionRequest(userId) {
  const res = await client.post(`/network/connections/request/${userId}/`);
  return res.data;
}

export async function respondConnectionRequest(connectionId, action) {
  const res = await client.post(`/network/connections/respond/${connectionId}/`, { action });
  return res.data;
}

export async function myConnections() {
  const res = await client.get("/network/connections/me/");
  return res.data;
}
