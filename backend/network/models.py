from django.db import models
from django.conf import settings


class Post(models.Model):
    POST_TYPE_CHOICES = (
        ("update", "General Update"),
        ("job_posting", "Job Posting"),
        ("project", "Project Build"),
        ("article", "Article"),
    )

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts")
    post_type = models.CharField(max_length=20, choices=POST_TYPE_CHOICES, default="update")
    content = models.TextField()
    image = models.ImageField(upload_to="post_images/", null=True, blank=True)

    # Optional link back to a Job posting if post_type == job_posting
    related_job = models.ForeignKey(
        "jobs.Job", on_delete=models.SET_NULL, null=True, blank=True, related_name="promo_posts"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Post<{self.author}: {self.content[:30]}>"


class Like(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user")


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_comments")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class Connection(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
    )

    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_connections")
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_connections")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("from_user", "to_user")

    def __str__(self):
        return f"{self.from_user} -> {self.to_user} ({self.status})"


class Message(models.Model):
    MESSAGE_TYPES = (
        ("private", "Private Direct Message"),
        ("public", "Public Note / InMail"),
    )

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_messages")
    content = models.TextField()
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default="private")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Msg<{self.sender.username} -> {self.recipient.username}: {self.content[:20]}>"
