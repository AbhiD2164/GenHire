from django.db.models import Q
from django.utils.text import slugify
import uuid
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from .models import Post, Like, Comment, Connection, Message, Community, CommunityMessage
from .serializers import (
    PostSerializer, CommentSerializer, ConnectionSerializer, MessageSerializer,
    CommunitySerializer, CommunityMessageSerializer,
)


class FeedView(generics.ListCreateAPIView):
    """
    LinkedIn/Instagram-style ranked feed:
    Priority 1 — Posts from users you're connected with or communities you've joined
    Priority 2 — Posts liked/commented on by your connections (social signal)
    Priority 3 — Posts matching your industry/domain (interest-based)
    Priority 4 — All other posts (discovery)
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        qs = Post.objects.select_related(
            "author", "related_job", "community"
        ).prefetch_related("likes", "comments")

        # Explicit filters (hashtag search, community filter etc.)
        hashtag = self.request.query_params.get("hashtag")
        author_id = self.request.query_params.get("author")
        community_id = self.request.query_params.get("community")
        search = self.request.query_params.get("search")

        if hashtag:
            clean_tag = hashtag if hashtag.startswith("#") else f"#{hashtag}"
            qs = qs.filter(hashtags__icontains=clean_tag)
        if author_id:
            qs = qs.filter(author_id=author_id)
        if community_id:
            qs = qs.filter(community_id=community_id)
        if search:
            qs = qs.filter(
                Q(content__icontains=search)
                | Q(hashtags__icontains=search)
                | Q(author__username__icontains=search)
            )

        # When no explicit filter, apply social ranking
        if not any([hashtag, author_id, community_id, search]):
            return self._ranked_feed(user, qs)

        return qs

    def _ranked_feed(self, user, qs):
        """Partition posts into priority buckets and merge them."""
        from django.db.models import Case, IntegerField, Value, When

        # Bucket 1: connections
        accepted_conns = Connection.objects.filter(
            Q(from_user=user) | Q(to_user=user), status="accepted"
        )
        connected_ids = set()
        for c in accepted_conns:
            connected_ids.add(c.from_user_id)
            connected_ids.add(c.to_user_id)
        connected_ids.discard(user.id)

        # Bucket 2: joined communities
        joined_community_ids = list(
            user.joined_communities.values_list("id", flat=True)
        )

        # Bucket 3: posts liked/commented by connections (social signal)
        social_post_ids = set(
            Like.objects.filter(user_id__in=connected_ids).values_list("post_id", flat=True)
        ) | set(
            Comment.objects.filter(author_id__in=connected_ids).values_list("post_id", flat=True)
        )

        # Priority annotation
        priority = Case(
            # Priority 1a: authored by connection
            When(author_id__in=connected_ids, then=Value(10)),
            # Priority 1b: in a joined community
            When(community_id__in=joined_community_ids, then=Value(9)),
            # Priority 2: social signal (connection liked/commented)
            When(id__in=list(social_post_ids), then=Value(5)),
            default=Value(1),
            output_field=IntegerField(),
        )

        # Interest filter for priority 3 (non-connection, non-community)
        user_industry = getattr(getattr(user, "profile", None), "industry", "") or ""

        return qs.annotate(feed_priority=priority).order_by(
            "-feed_priority", "-created_at"
        )

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
            return Response(ConnectionSerializer(existing, context={"request": request}).data, status=status.HTTP_200_OK)

        connection = Connection.objects.create(from_user=request.user, to_user_id=user_id, status="pending")
        return Response(ConnectionSerializer(connection, context={"request": request}).data, status=status.HTTP_201_CREATED)


class RespondConnectionRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, connection_id):
        action = request.data.get("action")
        try:
            connection = Connection.objects.get(id=connection_id, to_user=request.user)
        except Connection.DoesNotExist:
            return Response({"detail": "Connection request not found."}, status=status.HTTP_404_NOT_FOUND)

        if action not in ("accept", "decline"):
            return Response({"detail": "action must be 'accept' or 'decline'."}, status=status.HTTP_400_BAD_REQUEST)

        connection.status = "accepted" if action == "accept" else "declined"
        connection.save()
        return Response(ConnectionSerializer(connection, context={"request": request}).data)


class MyConnectionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        accepted = Connection.objects.filter(
            Q(from_user=user) | Q(to_user=user), status="accepted"
        ).select_related("from_user", "to_user", "from_user__profile", "to_user__profile")
        pending_received = Connection.objects.filter(to_user=user, status="pending").select_related("from_user", "from_user__profile")
        pending_sent = Connection.objects.filter(from_user=user, status="pending").select_related("to_user", "to_user__profile")

        return Response({
            "connections": ConnectionSerializer(accepted, many=True, context={"request": request}).data,
            "pending_received": ConnectionSerializer(pending_received, many=True, context={"request": request}).data,
            "pending_sent": ConnectionSerializer(pending_sent, many=True, context={"request": request}).data,
        })


class SuggestedPeopleView(APIView):
    """
    LinkedIn-style suggestions: people user may know, excluding already connected/pending members.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        connected_pairs = Connection.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        ).values_list("from_user_id", "to_user_id")

        exclude_ids = {user.id}
        for f, t in connected_pairs:
            exclude_ids.add(f)
            exclude_ids.add(t)

        from accounts.models import CustomUser
        from accounts.serializers import UserSummarySerializer

        suggestions = CustomUser.objects.exclude(id__in=exclude_ids).select_related("profile").order_by("-date_joined")[:12]
        return Response(UserSummarySerializer(suggestions, many=True).data)


# ---------- Personal Direct Messaging (1-on-1) ----------

class ConversationListView(APIView):
    """
    List all active 1-on-1 personal direct chat threads for the current user.
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
                }

        return Response(list(conversations.values()))


class ConversationMessagesView(APIView):
    """
    Personal 1-on-1 messages between request.user and a partner.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, partner_id):
        user = request.user
        Message.objects.filter(sender_id=partner_id, recipient=user, is_read=False).update(is_read=True)

        messages = Message.objects.filter(
            Q(sender=user, recipient_id=partner_id) | Q(sender_id=partner_id, recipient=user)
        ).select_related("sender", "recipient", "sender__profile", "recipient__profile").order_by("created_at")

        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, partner_id):
        user = request.user
        content = request.data.get("content", "").strip()

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
        )
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class UnreadMessageCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Message.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count})


# ---------- Communities & Groups ----------

class CommunityListCreateView(generics.ListCreateAPIView):
    """
    List open-source communities and public/private groups, or create a new community.
    """
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Community.objects.all().prefetch_related("members")
        ctype = self.request.query_params.get("type")
        mine = self.request.query_params.get("mine")
        search = self.request.query_params.get("search")

        if ctype:
            qs = qs.filter(community_type=ctype)
        if mine == "true":
            qs = qs.filter(Q(creator=self.request.user) | Q(members=self.request.user)).distinct()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

        return qs

    def perform_create(self, serializer):
        name = serializer.validated_data.get("name", "Community")
        slug_base = slugify(name) or "community"
        unique_slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"
        community = serializer.save(creator=self.request.user, slug=unique_slug)
        community.members.add(self.request.user)


class CommunityDetailView(generics.RetrieveAPIView):
    queryset = Community.objects.all().prefetch_related("members", "posts")
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"


class ToggleCommunityMembershipView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, community_id):
        try:
            comm = Community.objects.get(id=community_id)
        except Community.DoesNotExist:
            return Response({"detail": "Community not found."}, status=status.HTTP_404_NOT_FOUND)

        is_member = comm.members.filter(id=request.user.id).exists()
        if is_member:
            comm.members.remove(request.user)
            joined = False
        else:
            comm.members.add(request.user)
            joined = True

        return Response({"joined": joined, "members_count": comm.members.count()})


class CommunityMessagesView(APIView):
    """
    Group messaging inside an open-source community or private/public group.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, community_id):
        try:
            comm = Community.objects.get(id=community_id)
        except Community.DoesNotExist:
            return Response({"detail": "Community not found."}, status=status.HTTP_404_NOT_FOUND)

        messages = CommunityMessage.objects.filter(community=comm).select_related("sender", "sender__profile").order_by("created_at")
        return Response(CommunityMessageSerializer(messages, many=True).data)

    def post(self, request, community_id):
        try:
            comm = Community.objects.get(id=community_id)
        except Community.DoesNotExist:
            return Response({"detail": "Community not found."}, status=status.HTTP_404_NOT_FOUND)

        content = request.data.get("content", "").strip()
        if not content:
            return Response({"detail": "Message content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        # Auto-join community if not member
        if not comm.members.filter(id=request.user.id).exists():
            comm.members.add(request.user)

        msg = CommunityMessage.objects.create(community=comm, sender=request.user, content=content)
        return Response(CommunityMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
