from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.db import connection
from django.http import JsonResponse


def health_check(request):
    try:
        connection.ensure_connection()
        return JsonResponse({"status": "ok", "database": "ok"})
    except Exception:
        return JsonResponse({"status": "degraded", "database": "unavailable"}, status=503)

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("admin/", admin.site.urls),

    path("api/auth/", include("accounts.urls")),
    path("api/jobs/", include("jobs.urls")),
    path("api/ats/", include("ats.urls")),
    path("api/network/", include("network.urls")),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
