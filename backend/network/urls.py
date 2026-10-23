from django.urls import path
from .views import (
    FeedView, PostDetailView, ToggleLikeView, CommentListCreateView,
    SendConnectionRequestView, RespondConnectionRequestView, MyConnectionsView, SuggestedPeopleView,
    ConversationListView, ConversationMessagesView, UnreadMessageCountView,
    CommunityListCreateView, CommunityDetailView, ToggleCommunityMembershipView, CommunityMessagesView,
)

urlpatterns = [
    path("feed/", FeedView.as_view(), name="feed"),
    path("posts/<int:pk>/", PostDetailView.as_view(), name="post_detail"),
    path("posts/<int:post_id>/like/", ToggleLikeView.as_view(), name="toggle_like"),
    path("posts/<int:post_id>/comments/", CommentListCreateView.as_view(), name="post_comments"),
    path("connections/request/<int:user_id>/", SendConnectionRequestView.as_view(), name="send_connection"),
    path("connections/respond/<int:connection_id>/", RespondConnectionRequestView.as_view(), name="respond_connection"),
    path("connections/me/", MyConnectionsView.as_view(), name="my_connections"),
    path("connections/suggestions/", SuggestedPeopleView.as_view(), name="connection_suggestions"),
    # Personal direct 1-on-1 messages
    path("messages/conversations/", ConversationListView.as_view(), name="conversations"),
    path("messages/unread-count/", UnreadMessageCountView.as_view(), name="unread_message_count"),
    path("messages/<int:partner_id>/", ConversationMessagesView.as_view(), name="conversation_messages"),
    # Groups & Communities
    path("communities/", CommunityListCreateView.as_view(), name="community_list_create"),
    path("communities/<int:id>/", CommunityDetailView.as_view(), name="community_detail"),
    path("communities/<int:community_id>/toggle-membership/", ToggleCommunityMembershipView.as_view(), name="community_membership"),
    path("communities/<int:community_id>/messages/", CommunityMessagesView.as_view(), name="community_messages"),
]
