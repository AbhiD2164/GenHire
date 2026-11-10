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


def api_root(request):
    """Friendly response for the backend root URL.
    Visiting the Render service URL directly in a browser shows this.
    The actual application runs at the Vercel frontend URL.
    """
    return JsonResponse({
        "service": "GenHire API",
        "status": "running",
        "version": "1.0.0",
        "frontend": "https://apply-genhire.vercel.app",
        "health": "/health/",
        "api": {
            "auth":    "/api/auth/",
            "jobs":    "/api/jobs/",
            "ats":     "/api/ats/",
            "network": "/api/network/",
        },
        "note": "This is a REST API backend. Open the frontend URL above to use the application.",
    })


urlpatterns = [
    path("", api_root, name="api_root"),
    path("health/", health_check, name="health_check"),
    path("admin/", admin.site.urls),

    path("api/auth/", include("accounts.urls")),
    path("api/jobs/", include("jobs.urls")),
    path("api/ats/", include("ats.urls")),
    path("api/network/", include("network.urls")),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
