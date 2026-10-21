from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from .models import Post, Like, Comment, Connection, Message
from .serializers import PostSerializer, CommentSerializer, ConnectionSerializer, MessageSerializer


class FeedView(generics.ListCreateAPIView):
    """
    LinkedIn-style feed: shows all posts (general updates, job postings,
    project builds, articles), newest first.
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Post.objects.select_related("author", "related_job").prefetch_related("likes", "comments")
        post_type = self.request.query_params.get("post_type")
        author_id = self.request.query_params.get("author")
        if post_type:
            qs = qs.filter(post_type=post_type)
        if author_id:
            qs = qs.filter(author_id=author_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_serializer_context(self):
        return {"request": self.request}


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        return {"request": self.request}

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method in ("PUT", "PATCH", "DELETE") and obj.author_id != request.user.id:
            raise PermissionDenied("You can only modify your own posts.")


class ToggleLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        like, created = Like.objects.get_or_create(post=post, user=request.user)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True

        return Response({"liked": liked, "like_count": post.likes.count()})


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Comment.objects.filter(post_id=self.kwargs["post_id"]).select_related("author")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user, post_id=self.kwargs["post_id"])


class SendConnectionRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        if int(user_id) == request.user.id:
            return Response({"detail": "You can't connect with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        existing = Connection.objects.filter(
            Q(from_user=request.user, to_user_id=user_id) | Q(from_user_id=user_id, to_user=request.user)
        ).first()
        if existing:
            return Response(ConnectionSerializer(existing).data, status=status.HTTP_200_OK)

        connection = Connection.objects.create(from_user=request.user, to_user_id=user_id, status="pending")
        return Response(ConnectionSerializer(connection).data, status=status.HTTP_201_CREATED)


class RespondConnectionRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, connection_id):
        action = request.data.get("action")  # "accept" or "decline"
        try:
            connection = Connection.objects.get(id=connection_id, to_user=request.user)
        except Connection.DoesNotExist:
            return Response({"detail": "Connection request not found."}, status=status.HTTP_404_NOT_FOUND)

        if action not in ("accept", "decline"):
            return Response({"detail": "action must be 'accept' or 'decline'."}, status=status.HTTP_400_BAD_REQUEST)

        connection.status = "accepted" if action == "accept" else "declined"
        connection.save()
        return Response(ConnectionSerializer(connection).data)


class MyConnectionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        accepted = Connection.objects.filter(
            Q(from_user=user) | Q(to_user=user), status="accepted"
        )
        pending_received = Connection.objects.filter(to_user=user, status="pending")
        pending_sent = Connection.objects.filter(from_user=user, status="pending")

        return Response({
            "connections": ConnectionSerializer(accepted, many=True).data,
            "pending_received": ConnectionSerializer(pending_received, many=True).data,
            "pending_sent": ConnectionSerializer(pending_sent, many=True).data,
        })


class ConversationListView(APIView):
    """
    List all active conversation threads for the current user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        messages = Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).select_related("sender", "recipient", "sender__profile", "recipient__profile").order_by("-created_at")

        conversations = {}
        for msg in messages:
            partner = msg.recipient if msg.sender_id == user.id else msg.sender
            if partner.id not in conversations:
                unread = Message.objects.filter(sender=partner, recipient=user, is_read=False).count()
                conversations[partner.id] = {
                    "partner_id": partner.id,
                    "partner_name": partner.get_full_name() or partner.username,
                    "partner_username": partner.username,
                    "partner_avatar": partner.profile.avatar.url if hasattr(partner, "profile") and partner.profile.avatar else None,
                    "partner_headline": partner.profile.headline if hasattr(partner, "profile") else "",
                    "last_message": msg.content,
                    "last_message_time": msg.created_at,
                    "unread_count": unread,
                    "message_type": msg.message_type,
                }

        return Response(list(conversations.values()))


class ConversationMessagesView(APIView):
    """
    Get messages between request.user and a partner, and send new messages.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, partner_id):
        user = request.user
        # Mark incoming messages as read
        Message.objects.filter(sender_id=partner_id, recipient=user, is_read=False).update(is_read=True)

        messages = Message.objects.filter(
            Q(sender=user, recipient_id=partner_id) | Q(sender_id=partner_id, recipient=user)
        ).select_related("sender", "recipient").order_by("created_at")

        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, partner_id):
        user = request.user
        content = request.data.get("content", "").strip()
        message_type = request.data.get("message_type", "private")

        if not content:
            return Response({"detail": "Message content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        from accounts.models import CustomUser
        try:
            partner = CustomUser.objects.get(id=partner_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "Recipient not found."}, status=status.HTTP_404_NOT_FOUND)

        msg = Message.objects.create(
            sender=user,
            recipient=partner,
            content=content,
            message_type=message_type,
        )
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class UnreadMessageCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Message.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count})
