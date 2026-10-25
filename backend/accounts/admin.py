from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Profile, WorkExperience


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "is_staff")
    add_fieldsets = UserAdmin.add_fieldsets + (("Personal info", {"fields": ("email",)}),)


class WorkExperienceInline(admin.TabularInline):
    model = WorkExperience
    extra = 0


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "headline", "location", "total_experience_months")
    search_fields = ("user__username", "user__email", "skills", "location")
    inlines = [WorkExperienceInline]
