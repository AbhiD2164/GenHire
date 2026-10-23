from django.contrib import admin
from .models import Post, Like, Comment, Connection, Message, Community, CommunityMessage


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("author", "hashtags", "created_at")
    search_fields = ("content", "author__username", "hashtags")


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ("name", "community_type", "creator", "created_at")
    list_filter = ("community_type",)
    search_fields = ("name", "description")


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)


admin.site.register(Like)
admin.site.register(Comment)
admin.site.register(Message)
admin.site.register(CommunityMessage)
