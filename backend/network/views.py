from django.db.models import Count, Q
from django.utils.text import slugify
import uuid
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from .models import (
    Post, Like, Comment, Connection, Message, Community, CommunityMessage,
    CommunityMembershipRequest, CommunityInvitation, Notification,
)
from .serializers import (
    PostSerializer, CommentSerializer, ConnectionSerializer, MessageSerializer,
    CommunitySerializer, CommunityMessageSerializer, CommunityMembershipRequestSerializer,
    NotificationSerializer, CommunityInvitationSerializer,
)


def _create_notifications(recipients, **notification_data):
    recipient_ids = recipients.values_list("id", flat=True)
    return Notification.objects.bulk_create([
        Notification(recipient_id=recipient_id, **notification_data)
        for recipient_id in recipient_ids
    ])


def _connected_users(user):
    from accounts.models import CustomUser

    return CustomUser.objects.filter(
        Q(
            received_connections__from_user=user,
            received_connections__status="accepted",
        )
        | Q(
            sent_connections__to_user=user,
            sent_connections__status="accepted",
        )
    ).distinct()


class FeedView(generics.ListCreateAPIView):
    """
    Recent posts from the user's network and public communities.
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

        qs = qs.filter(
            Q(community__isnull=True)
            | Q(community__community_type="public")
            | Q(community__creator=user)
            | Q(community__members=user)
        ).distinct()

        if not any([hashtag, author_id, community_id, search]):
            connected_user_ids = Connection.objects.filter(
                Q(from_user=user) | Q(to_user=user), status="accepted"
            ).values_list("from_user_id", "to_user_id")
            connection_ids = set()
            for from_id, to_id in connected_user_ids:
                connection_ids.update((from_id, to_id))
            connection_ids.discard(user.id)
            qs = qs.filter(
                Q(author=user)
                | Q(author_id__in=connection_ids)
                | Q(community__members=user)
                | Q(community__community_type="public")
            ).distinct()

        return qs.order_by("-created_at", "-id")

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user)
        _create_notifications(
            _connected_users(self.request.user),
            actor=self.request.user,
            notification_type="connection_post",
            title="A connection shared a post",
            body=f"{self.request.user.get_full_name() or self.request.user.username} shared a new post.",
            target_url="/feed",
        )

    def get_serializer_context(self):
        return {"request": self.request}


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Post.objects.filter(
            Q(community__isnull=True)
            | Q(community__community_type="public")
            | Q(community__creator=user)
            | Q(community__members=user)
        ).distinct()

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

        if not PostDetailView.get_queryset(self).filter(id=post_id).exists():
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        like, created = Like.objects.get_or_create(post=post, user=request.user)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True
            if post.author_id != request.user.id:
                Notification.objects.create(
                    recipient=post.author,
                    actor=request.user,
                    notification_type="post_like",
                    title="Someone liked your post",
                    body=f"{request.user.get_full_name() or request.user.username} liked your post.",
                    target_url="/feed",
                )
                _create_notifications(
                    _connected_users(request.user).exclude(id=post.author_id),
                    actor=request.user,
                    notification_type="post_like",
                    title="A connection liked a post",
                    body=(
                        f"{request.user.get_full_name() or request.user.username} "
                        f"liked a post by {post.author.get_full_name() or post.author.username}."
                    ),
                    target_url="/feed",
                )

        return Response({"liked": liked, "like_count": post.likes.count()})


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        visible_post = PostDetailView.get_queryset(self).filter(id=self.kwargs["post_id"])
        if not visible_post.exists():
            return Comment.objects.none()
        return Comment.objects.filter(post_id=self.kwargs["post_id"]).select_related("author")

    def perform_create(self, serializer):
        if not PostDetailView.get_queryset(self).filter(id=self.kwargs["post_id"]).exists():
            raise PermissionDenied("This post is not available.")
        comment = serializer.save(author=self.request.user, post_id=self.kwargs["post_id"])
        post = comment.post
        if post.author_id != self.request.user.id:
            Notification.objects.create(
                recipient=post.author,
                actor=self.request.user,
                notification_type="post_comment",
                title="Someone commented on your post",
                body=f"{self.request.user.get_full_name() or self.request.user.username} commented: {comment.content[:160]}",
                target_url="/feed",
            )
            _create_notifications(
                _connected_users(self.request.user).exclude(id=post.author_id),
                actor=self.request.user,
                notification_type="post_comment",
                title="A connection commented on a post",
                body=(
                    f"{self.request.user.get_full_name() or self.request.user.username} "
                    f"commented on a post by {post.author.get_full_name() or post.author.username}."
                ),
                target_url="/feed",
            )


class SendConnectionRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        if int(user_id) == request.user.id:
            return Response({"detail": "You can't connect with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        from accounts.models import CustomUser
        if not CustomUser.objects.filter(id=user_id).exists():
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        existing = Connection.objects.filter(
            Q(from_user=request.user, to_user_id=user_id) | Q(from_user_id=user_id, to_user=request.user)
        ).first()
        if existing:
            if existing.status == "declined":
                existing.from_user = request.user
                existing.to_user_id = user_id
                existing.status = "pending"
                existing.save(update_fields=["from_user", "to_user", "status", "updated_at"])
                Notification.objects.create(
                    recipient=existing.to_user,
                    actor=request.user,
                    notification_type="connection_request",
                    title="New connection request",
                    body=f"{request.user.get_full_name() or request.user.username} wants to connect.",
                    target_url="/network",
                )
            return Response(ConnectionSerializer(existing, context={"request": request}).data, status=status.HTTP_200_OK)

        connection = Connection.objects.create(from_user=request.user, to_user_id=user_id, status="pending")
        Notification.objects.create(
            recipient=connection.to_user,
            actor=request.user,
            notification_type="connection_request",
            title="New connection request",
            body=f"{request.user.get_full_name() or request.user.username} wants to connect.",
            target_url="/network",
        )
        return Response(ConnectionSerializer(connection, context={"request": request}).data, status=status.HTTP_201_CREATED)


class WithdrawConnectionRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, connection_id):
        try:
            connection = Connection.objects.get(
                id=connection_id, from_user=request.user, status="pending"
            )
        except Connection.DoesNotExist:
            return Response(
                {"detail": "Pending connection request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        Notification.objects.filter(
            recipient=connection.to_user,
            actor=request.user,
            notification_type="connection_request",
            title="New connection request",
        ).delete()
        connection.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        Notification.objects.filter(
            recipient=request.user,
            actor=connection.from_user,
            notification_type="connection_request",
            title="New connection request",
            is_read=False,
        ).update(is_read=True)
        response_verb = "accepted" if action == "accept" else "declined"
        Notification.objects.create(
            recipient=connection.from_user,
            actor=request.user,
            notification_type="connection_request",
            title=f"Connection request {response_verb}",
            body=f"{request.user.get_full_name() or request.user.username} {response_verb} your request.",
            target_url="/network",
        )
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

        excluded_user_ids = set(
            Connection.objects.filter(
                Q(from_user=user) | Q(to_user=user),
                status__in=("pending", "accepted"),
            ).values_list("from_user_id", flat=True)
        ) | set(
            Connection.objects.filter(
                Q(from_user=user) | Q(to_user=user),
                status__in=("pending", "accepted"),
            ).values_list("to_user_id", flat=True)
        )
        exclude_ids = excluded_user_ids | {user.id}

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


def _seed_default_communities(creator_user):
    """Auto-seeds official communities if none exist."""
    seeds = [
        {
            "name": "Open Source AI & ML Innovators",
            "slug": "open-source-ai-ml-innovators",
            "community_type": "public",
            "description": "Collaborative research and engineering on open-source transformer models, vector search, and scalable ML architectures.",
        },
        {
            "name": "Cloud Architecture & High-Scale Systems",
            "slug": "cloud-architecture-high-scale-systems",
            "community_type": "public",
            "description": "Enterprise backend engineers, SREs, and DevOps professionals discussing distributed resilience and cloud microservices.",
        },
        {
            "name": "Healthcare Informatics & BioTech",
            "slug": "healthcare-informatics-biotech",
            "community_type": "public",
            "description": "Clinical informatics specialists, biomedical data scientists, and digital health software builders.",
        },
        {
            "name": "FinTech & Quantitative Engineering",
            "slug": "fintech-quantitative-engineering",
            "community_type": "public",
            "description": "Financial engineers, quantitative analysts, and algorithmic system developers.",
        },
    ]
    for s in seeds:
        comm, _ = Community.objects.get_or_create(
            slug=s["slug"],
            defaults={
                "name": s["name"],
                "community_type": s["community_type"],
                "description": s["description"],
                "creator": creator_user,
            },
        )
        comm.members.add(creator_user)


# ---------- Communities & Groups ----------

class CommunityListCreateView(generics.ListCreateAPIView):
    """
    List personalized community recommendations and joined communities.
    """
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # Auto-seed standard official communities if database is empty
        if not Community.objects.exists():
            _seed_default_communities(self.request.user)

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
        if mine == "true":
            return qs

        profile = getattr(self.request.user, "profile", None)
        interest_terms = set()
        if profile:
            interest_terms.update(
                term.strip().lower()
                for term in (profile.industry or "").split(",")
                if len(term.strip()) > 2
            )
            interest_terms.update(
                term.strip().lower()
                for term in (profile.skills or "").split(",")
                if len(term.strip()) > 2
            )

        all_communities = list(qs.annotate(member_count=Count("members")))
        joined_ids = set(
            Community.objects.filter(
                Q(creator=self.request.user) | Q(members=self.request.user)
            ).values_list("id", flat=True)
        )
        joined_or_owned = [
            community for community in all_communities
            if community.id in joined_ids
        ]
        discoverable = [
            community for community in all_communities
            if community.id not in joined_ids
        ]

        def recommendation_score(community):
            text = f"{community.name} {community.description}".lower()
            return sum(1 for term in interest_terms if term in text)

        discoverable.sort(
            key=lambda community: (
                recommendation_score(community),
                community.member_count,
                community.created_at,
            ),
            reverse=True,
        )
        return joined_or_owned + discoverable[:12]

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

        action = request.data.get("action", "join")
        if action not in ("join", "leave"):
            return Response(
                {"detail": "action must be 'join' or 'leave'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        is_member = comm.members.filter(id=request.user.id).exists()
        if is_member and action == "leave":
            comm.members.remove(request.user)
            joined = False
            request_status = None
        elif is_member:
            joined = True
            request_status = "approved"
        elif action == "leave":
            membership_request = CommunityMembershipRequest.objects.filter(
                community=comm, user=request.user
            ).first()
            joined = False
            request_status = membership_request.status if membership_request else None
        elif comm.community_type == "private":
            membership_request, _ = CommunityMembershipRequest.objects.get_or_create(
                community=comm,
                user=request.user,
                defaults={"status": "pending"},
            )
            if membership_request.status in ("declined", "approved"):
                membership_request.status = "pending"
                membership_request.save(update_fields=["status", "updated_at"])
            joined = False
            request_status = membership_request.status
            if membership_request.status == "pending":
                Notification.objects.get_or_create(
                    recipient=comm.creator,
                    actor=request.user,
                    notification_type="community_request",
                    title="Community join request",
                    body=f"{request.user.get_full_name() or request.user.username} requested to join {comm.name}.",
                    target_url="/network",
                    is_read=False,
                )
        else:
            if action == "join":
                comm.members.add(request.user)
                joined = True
                request_status = "approved"
            else:
                joined = False
                request_status = None

        return Response({
            "joined": joined,
            "members_count": comm.members.count(),
            "join_request_status": request_status,
        })


class CommunityMembershipRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        requests = CommunityMembershipRequest.objects.filter(
            community__creator=request.user, status="pending"
        ).select_related("community", "user").order_by("created_at")
        return Response(CommunityMembershipRequestSerializer(requests, many=True).data)


class RespondCommunityMembershipRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_id):
        action = request.data.get("action")
        if action not in ("allow", "deny"):
            return Response(
                {"detail": "action must be 'allow' or 'deny'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            membership_request = CommunityMembershipRequest.objects.select_related(
                "community"
            ).get(
                id=request_id,
                community__creator=request.user,
                status="pending",
            )
        except CommunityMembershipRequest.DoesNotExist:
            return Response(
                {"detail": "Pending community request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action == "allow":
            membership_request.community.members.add(membership_request.user)
            membership_request.status = "approved"
        else:
            membership_request.status = "declined"
        membership_request.save(update_fields=["status", "updated_at"])
        Notification.objects.filter(
            recipient=request.user,
            actor=membership_request.user,
            notification_type="community_request",
            title="Community join request",
            is_read=False,
        ).update(is_read=True)
        Notification.objects.create(
            recipient=membership_request.user,
            actor=request.user,
            notification_type="community_request",
            title="Community request approved" if action == "allow" else "Community request declined",
            body=(
                f"Your request to join {membership_request.community.name} was "
                f"{'approved' if action == 'allow' else 'declined'}."
            ),
            target_url=(
                f"/messages?community={membership_request.community_id}"
                if action == "allow"
                else "/network"
            ),
        )
        return Response(CommunityMembershipRequestSerializer(membership_request).data)


class CommunityInvitationListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        invitations = CommunityInvitation.objects.filter(
            invitee=request.user, status="pending"
        ).select_related("community", "inviter")
        return Response(CommunityInvitationSerializer(invitations, many=True).data)

    def post(self, request):
        community_id = request.data.get("community_id")
        invitee_id = request.data.get("user_id")
        community = Community.objects.filter(
            id=community_id, creator=request.user
        ).first()
        if not community:
            return Response(
                {"detail": "You can only invite people to communities you manage."},
                status=status.HTTP_404_NOT_FOUND,
            )

        from accounts.models import CustomUser
        invitee = CustomUser.objects.filter(id=invitee_id).first()
        if not invitee:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if invitee.id == request.user.id or community.members.filter(id=invitee.id).exists():
            return Response(
                {"detail": "This person cannot be invited to the community."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation, created = CommunityInvitation.objects.get_or_create(
            community=community,
            inviter=request.user,
            invitee=invitee,
            defaults={"status": "pending"},
        )
        if not created and invitation.status != "pending":
            invitation.status = "pending"
            invitation.save(update_fields=["status", "updated_at"])
            created = True
        if created:
            Notification.objects.create(
                recipient=invitee,
                actor=request.user,
                notification_type="community_invitation",
                title="Community invitation",
                body=f"{request.user.get_full_name() or request.user.username} invited you to {community.name}.",
                target_url="/network",
            )
        return Response(
            CommunityInvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class RespondCommunityInvitationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, invitation_id):
        action = request.data.get("action")
        if action not in ("accept", "decline"):
            return Response(
                {"detail": "action must be 'accept' or 'decline'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation = CommunityInvitation.objects.select_related(
            "community", "inviter"
        ).filter(
            id=invitation_id, invitee=request.user, status="pending"
        ).first()
        if not invitation:
            return Response(
                {"detail": "Pending community invitation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action == "accept":
            invitation.community.members.add(request.user)
            invitation.status = "accepted"
            CommunityMembershipRequest.objects.filter(
                community=invitation.community, user=request.user
            ).update(status="approved")
        else:
            invitation.status = "declined"
        invitation.save(update_fields=["status", "updated_at"])
        Notification.objects.filter(
            recipient=request.user,
            actor=invitation.inviter,
            notification_type="community_invitation",
            title="Community invitation",
            is_read=False,
        ).update(is_read=True)
        response_verb = "accepted" if action == "accept" else "declined"
        Notification.objects.create(
            recipient=invitation.inviter,
            actor=request.user,
            notification_type="community_invitation",
            title="Community invitation response",
            body=f"{request.user.get_full_name() or request.user.username} {response_verb} the invitation to {invitation.community.name}.",
            target_url="/network",
        )
        return Response(CommunityInvitationSerializer(invitation).data)


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(recipient=request.user)[:50]
        return Response({
            "results": NotificationSerializer(notifications, many=True).data,
            "unread_count": Notification.objects.filter(
                recipient=request.user, is_read=False
            ).count(),
        })


class MarkNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        updated = Notification.objects.filter(
            id=notification_id, recipient=request.user, is_read=False
        ).update(is_read=True)
        if not updated and not Notification.objects.filter(
            id=notification_id, recipient=request.user
        ).exists():
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"is_read": True})


class MarkAllNotificationsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"is_read": True})


class CommunityMessagesView(APIView):
    """
    Community messaging restricted to members for private communities.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, community_id):
        try:
            comm = Community.objects.get(id=community_id)
        except Community.DoesNotExist:
            return Response({"detail": "Community not found."}, status=status.HTTP_404_NOT_FOUND)

        if (
            comm.community_type == "private"
            and not comm.members.filter(id=request.user.id).exists()
        ):
            return Response(
                {"detail": "Join this private community to view its messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

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

        if not comm.members.filter(id=request.user.id).exists():
            return Response(
                {"detail": "Join this community before posting messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        msg = CommunityMessage.objects.create(community=comm, sender=request.user, content=content)
        return Response(CommunityMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
