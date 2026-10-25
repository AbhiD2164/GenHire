from django.urls import path
from .views import (
    FeedView, PostDetailView, ToggleLikeView, CommentListCreateView,
    SendConnectionRequestView, WithdrawConnectionRequestView, RespondConnectionRequestView,
    MyConnectionsView, SuggestedPeopleView,
    ConversationListView, ConversationMessagesView, UnreadMessageCountView,
    CommunityListCreateView, CommunityDetailView, ToggleCommunityMembershipView,
    CommunityMembershipRequestListView, RespondCommunityMembershipRequestView, CommunityMessagesView,
    NotificationListView, MarkNotificationReadView, MarkAllNotificationsReadView,
    CommunityInvitationListCreateView, RespondCommunityInvitationView,
)

urlpatterns = [
    path("feed/", FeedView.as_view(), name="feed"),
    path("posts/<int:pk>/", PostDetailView.as_view(), name="post_detail"),
    path("posts/<int:post_id>/like/", ToggleLikeView.as_view(), name="toggle_like"),
    path("posts/<int:post_id>/comments/", CommentListCreateView.as_view(), name="post_comments"),
    path("connections/request/<int:user_id>/", SendConnectionRequestView.as_view(), name="send_connection"),
    path("connections/request/<int:connection_id>/withdraw/", WithdrawConnectionRequestView.as_view(), name="withdraw_connection"),
    path("connections/respond/<int:connection_id>/", RespondConnectionRequestView.as_view(), name="respond_connection"),
    path("connections/me/", MyConnectionsView.as_view(), name="my_connections"),
    path("connections/suggestions/", SuggestedPeopleView.as_view(), name="connection_suggestions"),
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("notifications/read-all/", MarkAllNotificationsReadView.as_view(), name="mark_all_notifications_read"),
    path("notifications/<int:notification_id>/read/", MarkNotificationReadView.as_view(), name="mark_notification_read"),
    # Personal direct 1-on-1 messages
    path("messages/conversations/", ConversationListView.as_view(), name="conversations"),
    path("messages/unread-count/", UnreadMessageCountView.as_view(), name="unread_message_count"),
    path("messages/<int:partner_id>/", ConversationMessagesView.as_view(), name="conversation_messages"),
    # Groups & Communities
    path("communities/", CommunityListCreateView.as_view(), name="community_list_create"),
    path("communities/<int:id>/", CommunityDetailView.as_view(), name="community_detail"),
    path("communities/<int:community_id>/toggle-membership/", ToggleCommunityMembershipView.as_view(), name="community_membership"),
    path("communities/membership-requests/", CommunityMembershipRequestListView.as_view(), name="community_membership_requests"),
    path("communities/invitations/", CommunityInvitationListCreateView.as_view(), name="community_invitations"),
    path("communities/invitations/<int:invitation_id>/respond/", RespondCommunityInvitationView.as_view(), name="community_invitation_response"),
    path("communities/membership-requests/<int:request_id>/respond/", RespondCommunityMembershipRequestView.as_view(), name="community_membership_request_response"),
    path("communities/<int:community_id>/messages/", CommunityMessagesView.as_view(), name="community_messages"),
]
