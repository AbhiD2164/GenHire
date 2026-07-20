from rest_framework import serializers
from .models import Post, Like, Comment, Connection


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
    author_role = serializers.CharField(source="author.role", read_only=True)
    author_headline = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)
    related_job_title = serializers.CharField(source="related_job.title", read_only=True, default=None)

    class Meta:
        model = Post
        fields = [
            "id", "author", "author_name", "author_role", "author_headline", "author_avatar",
            "post_type", "content", "image", "related_job", "related_job_title",
            "created_at", "updated_at", "like_count", "comment_count", "liked_by_me", "comments",
        ]
        read_only_fields = ["author", "created_at", "updated_at"]

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


class ConnectionSerializer(serializers.ModelSerializer):
    from_user_name = serializers.SerializerMethodField()
    to_user_name = serializers.SerializerMethodField()
    from_user_headline = serializers.SerializerMethodField()
    to_user_headline = serializers.SerializerMethodField()

    class Meta:
        model = Connection
        fields = [
            "id", "from_user", "to_user", "status", "created_at", "updated_at",
            "from_user_name", "to_user_name", "from_user_headline", "to_user_headline",
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
