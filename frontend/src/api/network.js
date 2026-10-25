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

export async function withdrawConnectionRequest(connectionId) {
  await client.delete(`/network/connections/request/${connectionId}/withdraw/`);
}

export async function respondConnectionRequest(connectionId, action) {
  const res = await client.post(`/network/connections/respond/${connectionId}/`, { action });
  return res.data;
}

export async function myConnections() {
  const res = await client.get("/network/connections/me/");
  return res.data;
}

export async function getSuggestedPeople() {
  const res = await client.get("/network/connections/suggestions/");
  return res.data;
}

// Personal direct 1-on-1 messages
export async function getConversations() {
  const res = await client.get("/network/messages/conversations/");
  return res.data;
}

export async function getConversationMessages(partnerId) {
  const res = await client.get(`/network/messages/${partnerId}/`);
  return res.data;
}

export async function sendMessage(partnerId, { content }) {
  const res = await client.post(`/network/messages/${partnerId}/`, { content });
  return res.data;
}

export async function getUnreadMessageCount() {
  const res = await client.get("/network/messages/unread-count/");
  return res.data;
}

// Communities & Groups
export async function getCommunities(params) {
  const res = await client.get("/network/communities/", { params });
  return res.data;
}

export async function createCommunity(payload) {
  const res = await client.post("/network/communities/", payload);
  return res.data;
}

export async function getCommunity(id) {
  const res = await client.get(`/network/communities/${id}/`);
  return res.data;
}

export async function updateCommunityMembership(communityId, action) {
  const res = await client.post(`/network/communities/${communityId}/toggle-membership/`, { action });
  return res.data;
}

export async function getNotifications() {
  const res = await client.get("/network/notifications/");
  return res.data;
}

export async function markNotificationRead(notificationId) {
  const res = await client.post(`/network/notifications/${notificationId}/read/`);
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await client.post("/network/notifications/read-all/");
  return res.data;
}

export async function getCommunityMembershipRequests() {
  const res = await client.get("/network/communities/membership-requests/");
  return res.data;
}

export async function respondCommunityMembershipRequest(requestId, action) {
  const res = await client.post(
    `/network/communities/membership-requests/${requestId}/respond/`,
    { action },
  );
  return res.data;
}

export async function getCommunityInvitations() {
  const res = await client.get("/network/communities/invitations/");
  return res.data;
}

export async function inviteToCommunity(communityId, userId) {
  const res = await client.post("/network/communities/invitations/", {
    community_id: communityId,
    user_id: userId,
  });
  return res.data;
}

export async function respondCommunityInvitation(invitationId, action) {
  const res = await client.post(
    `/network/communities/invitations/${invitationId}/respond/`,
    { action },
  );
  return res.data;
}

export async function getCommunityMessages(communityId) {
  const res = await client.get(`/network/communities/${communityId}/messages/`);
  return res.data;
}

export async function sendCommunityMessage(communityId, content) {
  const res = await client.post(`/network/communities/${communityId}/messages/`, { content });
  return res.data;
}
