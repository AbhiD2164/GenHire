from django.urls import path
from .views import (
    FeedView, PostDetailView, ToggleLikeView, CommentListCreateView,
    SendConnectionRequestView, RespondConnectionRequestView, MyConnectionsView,
    ConversationListView, ConversationMessagesView, UnreadMessageCountView,
)

urlpatterns = [
    path("feed/", FeedView.as_view(), name="feed"),
    path("posts/<int:pk>/", PostDetailView.as_view(), name="post_detail"),
    path("posts/<int:post_id>/like/", ToggleLikeView.as_view(), name="toggle_like"),
    path("posts/<int:post_id>/comments/", CommentListCreateView.as_view(), name="post_comments"),
    path("connections/request/<int:user_id>/", SendConnectionRequestView.as_view(), name="send_connection"),
    path("connections/respond/<int:connection_id>/", RespondConnectionRequestView.as_view(), name="respond_connection"),
    path("connections/me/", MyConnectionsView.as_view(), name="my_connections"),
    path("messages/conversations/", ConversationListView.as_view(), name="conversations"),
    path("messages/unread-count/", UnreadMessageCountView.as_view(), name="unread_message_count"),
    path("messages/<int:partner_id>/", ConversationMessagesView.as_view(), name="conversation_messages"),
]
