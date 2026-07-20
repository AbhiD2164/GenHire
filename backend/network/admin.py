from django.contrib import admin
from .models import Post, Like, Comment, Connection


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("author", "post_type", "created_at")
    list_filter = ("post_type",)
    search_fields = ("content", "author__username")


admin.site.register(Like)
admin.site.register(Comment)


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)
