"""Validated public URL and lifetime settings for the MCP OAuth service."""

from dataclasses import dataclass
import os
from urllib.parse import urlparse


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _normalized_url(name: str, default: str, *, allow_path: bool) -> str:
    value = os.getenv(name, default).strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError(f"{name} must be an absolute HTTP(S) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise RuntimeError(
            f"{name} must not contain credentials, a query, or a fragment"
        )
    if not allow_path and parsed.path not in {"", "/"}:
        raise RuntimeError(f"{name} must not contain a path")
    if parsed.scheme != "https" and parsed.hostname not in LOCAL_HOSTS:
        raise RuntimeError(f"{name} must use HTTPS except for localhost development")
    return value


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer") from error
    if value <= 0:
        raise RuntimeError(f"{name} must be positive")
    return value


@dataclass(frozen=True)
class OAuthSettings:
    resource_url: str
    issuer_url: str
    web_url: str
    scope: str
    authorization_request_ttl: int
    authorization_code_ttl: int
    access_token_ttl: int
    refresh_token_ttl: int


def load_oauth_settings() -> OAuthSettings:
    resource_url = _normalized_url(
        "MCP_PUBLIC_URL", "http://localhost:8000/mcp", allow_path=True
    )
    if not urlparse(resource_url).path.endswith("/mcp"):
        raise RuntimeError("MCP_PUBLIC_URL must identify the public /mcp endpoint")

    issuer_url = _normalized_url(
        "OAUTH_ISSUER_URL", "http://localhost:8000", allow_path=False
    )
    # An issuer is an exact identifier. Keep the root-path slash so it matches
    # AnyHttpUrl serialization in the MCP protected-resource metadata.
    issuer_url = f"{issuer_url}/"
    web_url = _normalized_url("WEB_APP_URL", "http://localhost:3000", allow_path=False)

    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        for name, value in {
            "MCP_PUBLIC_URL": resource_url,
            "OAUTH_ISSUER_URL": issuer_url,
            "WEB_APP_URL": web_url,
        }.items():
            if urlparse(value).scheme != "https":
                raise RuntimeError(f"{name} must use HTTPS in production")

    return OAuthSettings(
        resource_url=resource_url,
        issuer_url=issuer_url,
        web_url=web_url,
        scope="mcp:access",
        authorization_request_ttl=_positive_int("OAUTH_REQUEST_TTL_SECONDS", 600),
        authorization_code_ttl=_positive_int("OAUTH_CODE_TTL_SECONDS", 300),
        access_token_ttl=_positive_int("OAUTH_ACCESS_TOKEN_TTL_SECONDS", 900),
        refresh_token_ttl=_positive_int("OAUTH_REFRESH_TOKEN_TTL_SECONDS", 2592000),
    )


oauth_settings = load_oauth_settings()
