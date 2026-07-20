from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from .models import Post, Like, Comment, Connection
from .serializers import PostSerializer, CommentSerializer, ConnectionSerializer


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
