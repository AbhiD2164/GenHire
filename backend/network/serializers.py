from rest_framework import serializers
from .models import (
    Post, Like, Comment, Connection, Message, Community, CommunityMessage,
    CommunityMembershipRequest, CommunityInvitation, Notification,
)


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "post", "author", "author_name", "author_avatar", "content", "created_at"]
        read_only_fields = ["author", "post", "created_at"]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

    def get_author_avatar(self, obj):
        try:
            if obj.author.profile.avatar:
                return obj.author.profile.avatar.url
        except Exception:
            pass
        return None


class PostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_headline = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)
    related_job_title = serializers.CharField(source="related_job.title", read_only=True, default=None)
    community_name = serializers.CharField(source="community.name", read_only=True, default=None)
    community_type = serializers.CharField(source="community.community_type", read_only=True, default=None)
    community_joined_by_me = serializers.SerializerMethodField()
    community_join_request_status = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id", "author", "author_name", "author_headline", "author_avatar",
            "content", "hashtags", "community", "community_name", "community_type",
            "community_joined_by_me", "community_join_request_status",
            "image", "related_job", "related_job_title",
            "created_at", "updated_at", "like_count", "comment_count", "liked_by_me", "comments",
        ]
        read_only_fields = ["author", "created_at", "updated_at", "hashtags"]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

    def get_author_headline(self, obj):
        try:
            return obj.author.profile.headline
        except Exception:
            return ""

    def get_author_avatar(self, obj):
        try:
            if obj.author.profile.avatar:
                return obj.author.profile.avatar.url
        except Exception:
            pass
        return None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_liked_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()

    def get_community_joined_by_me(self, obj):
        """Returns True if the post belongs to a community the current user has joined."""
        if not obj.community_id:
            return None  # Not a community post — no join prompt needed
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.community.members.filter(id=request.user.id).exists()

    def get_community_join_request_status(self, obj):
        request = self.context.get("request")
        if not obj.community_id or not request or not request.user.is_authenticated:
            return None
        membership_request = CommunityMembershipRequest.objects.filter(
            community=obj.community, user=request.user
        ).first()
        return membership_request.status if membership_request else None


class ConnectionSerializer(serializers.ModelSerializer):
    from_user_name = serializers.SerializerMethodField()
    to_user_name = serializers.SerializerMethodField()
    from_user_headline = serializers.SerializerMethodField()
    to_user_headline = serializers.SerializerMethodField()
    from_user_avatar = serializers.SerializerMethodField()
    to_user_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Connection
        fields = [
            "id", "from_user", "to_user", "status", "created_at", "updated_at",
            "from_user_name", "to_user_name", "from_user_headline", "to_user_headline",
            "from_user_avatar", "to_user_avatar",
        ]
        read_only_fields = ["from_user", "status", "created_at", "updated_at"]

    def get_from_user_name(self, obj):
        return obj.from_user.get_full_name() or obj.from_user.username

    def get_to_user_name(self, obj):
        return obj.to_user.get_full_name() or obj.to_user.username

    def get_from_user_headline(self, obj):
        try:
            return obj.from_user.profile.headline
        except Exception:
            return ""

    def get_to_user_headline(self, obj):
        try:
            return obj.to_user.profile.headline
        except Exception:
            return ""

    def get_from_user_avatar(self, obj):
        try:
            return obj.from_user.profile.avatar.url if obj.from_user.profile.avatar else None
        except Exception:
            return None

    def get_to_user_avatar(self, obj):
        try:
            return obj.to_user.profile.avatar.url if obj.to_user.profile.avatar else None
        except Exception:
            return None


class MessageSerializer(serializers.ModelSerializer):
    """Personal 1-on-1 direct message serializer."""
    sender_name = serializers.SerializerMethodField()
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_avatar = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    recipient_username = serializers.CharField(source="recipient.username", read_only=True)
    recipient_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "sender", "sender_name", "sender_username", "sender_avatar",
            "recipient", "recipient_name", "recipient_username", "recipient_avatar",
            "content", "is_read", "created_at"
        ]
        read_only_fields = ["sender", "is_read", "created_at"]

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username

    def get_recipient_name(self, obj):
        return obj.recipient.get_full_name() or obj.recipient.username

    def get_sender_avatar(self, obj):
        try:
            return obj.sender.profile.avatar.url if obj.sender.profile.avatar else None
        except Exception:
            return None

    def get_recipient_avatar(self, obj):
        try:
            return obj.recipient.profile.avatar.url if obj.recipient.profile.avatar else None
        except Exception:
            return None


class CommunityMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_avatar = serializers.SerializerMethodField()

    class Meta:
        model = CommunityMessage
        fields = ["id", "community", "sender", "sender_name", "sender_username", "sender_avatar", "content", "created_at"]
        read_only_fields = ["sender", "created_at"]

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username

    def get_sender_avatar(self, obj):
        try:
            return obj.sender.profile.avatar.url if obj.sender.profile.avatar else None
        except Exception:
            return None


class CommunitySerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()
    members_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    join_request_status = serializers.SerializerMethodField()
    pending_join_requests_count = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = [
            "id", "name", "slug", "description", "community_type",
            "creator", "creator_name", "members_count", "is_member",
            "join_request_status", "pending_join_requests_count", "avatar", "created_at",
        ]
        read_only_fields = ["creator", "created_at"]

    def get_creator_name(self, obj):
        return obj.creator.get_full_name() or obj.creator.username

    def get_members_count(self, obj):
        return obj.members.count()

    def get_is_member(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.members.filter(id=request.user.id).exists()

    def get_join_request_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        membership_request = CommunityMembershipRequest.objects.filter(
            community=obj, user=request.user
        ).first()
        return membership_request.status if membership_request else None

    def get_pending_join_requests_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or obj.creator_id != request.user.id:
            return 0
        return obj.membership_requests.filter(status="pending").count()


class CommunityMembershipRequestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()
    community_name = serializers.CharField(source="community.name", read_only=True)

    class Meta:
        model = CommunityMembershipRequest
        fields = [
            "id", "community", "community_name", "user", "username", "full_name",
            "status", "created_at",
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id", "notification_type", "title", "body", "target_url",
            "actor", "actor_name", "is_read", "created_at",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor:
            return ""
        return obj.actor.get_full_name() or obj.actor.username


class CommunityInvitationSerializer(serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True)
    inviter_name = serializers.SerializerMethodField()

    class Meta:
        model = CommunityInvitation
        fields = [
            "id", "community", "community_name", "inviter", "inviter_name",
            "status", "created_at",
        ]
        read_only_fields = fields

    def get_inviter_name(self, obj):
        return obj.inviter.get_full_name() or obj.inviter.username
