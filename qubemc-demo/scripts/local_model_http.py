"""Private Spark inference only: no public endpoints, proxy forwarding, or redirects."""
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, build_opener

ENDPOINTS = {
    "llm": "http://100.89.121.112:8000/v1/chat/completions",
    "decision": "http://100.89.121.112:8001/v1/systemone",
    "tts": "http://100.89.121.112:8004/v1/audio/speech",
}

class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise URLError("Local inference redirects are disabled")

def open_local_model(request, *, service, timeout):
    url = urlsplit(request.full_url)
    if request.full_url != ENDPOINTS[service] or url.username or url.password:
        raise URLError(f"Use the local Spark endpoint: {ENDPOINTS[service]}")
    return build_opener(ProxyHandler({}), NoRedirects()).open(request, timeout=timeout)
