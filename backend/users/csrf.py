import re
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from functools import wraps

def csrf_exempt_for(view_func=None, exempt_urls=None):
    """
    Google OAuth gibi belirli URLler için CSRF豁免功能.
    Yalnızca settings.CSRF_EXEMPT_URLS'de tanımlanan URLler için çalışır.
    """
    if exempt_urls is None:
        exempt_urls = getattr(settings, 'CSRF_EXEMPT_URLS', [])
    
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            path = request.path_info.lstrip('/')
            for pattern in exempt_urls:
                if re.match(pattern, path):
                    return csrf_exempt(view_func)(request, *args, **kwargs)
            return view_func(request, *args, **kwargs)
        return wrapped_view
    
    if view_func:
        return decorator(view_func)
    return decorator 