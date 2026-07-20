"""Persistence and security primitives for Anlok's OAuth 2.1 service."""

import base64
import hashlib
import json
import re
import secrets
import time
from contextlib import contextmanager
from urllib.parse import urlencode, urlparse

from src.db import SessionLocal, User
from src.oauth_models import (
    OAuthAccessToken,
    OAuthAuthorizationCode,
    OAuthAuthorizationRequest,
    OAuthClient,
    OAuthRefreshToken,
)
from src.oauth_config import oauth_settings
from src.utils import hash_secret


PKCE_PATTERN = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")
LOCAL_REDIRECT_HOSTS = {"localhost", "127.0.0.1", "::1"}


@contextmanager
def _oauth_db():
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


class OAuthError(Exception):
    def __init__(self, error: str, description: str, status_code: int = 400):
        super().__init__(description)
        self.error = error
        self.description = description
        self.status_code = status_code


def _now() -> int:
    return int(time.time())


def _new_secret() -> str:
    return secrets.token_urlsafe(32)


def _valid_redirect_uri(uri: str) -> bool:
    if not uri or len(uri) > 2048:
        return False
    parsed = urlparse(uri)
    if parsed.fragment or parsed.username or parsed.password or not parsed.netloc:
        return False
    if parsed.scheme == "https":
        return True
    return parsed.scheme == "http" and parsed.hostname in LOCAL_REDIRECT_HOSTS


def _redirect_with_query(uri: str, values: dict[str, str]) -> str:
    separator = "&" if urlparse(uri).query else "?"
    return f"{uri}{separator}{urlencode(values)}"


def _scope_value(scope: str | None) -> str:
    requested = set((scope or oauth_settings.scope).split())
    if requested != {oauth_settings.scope}:
        raise OAuthError("invalid_scope", f"Only {oauth_settings.scope} is supported")
    return oauth_settings.scope


def register_client(metadata: dict) -> dict:
    redirect_uris = metadata.get("redirect_uris")
    if not isinstance(redirect_uris, list) or not 1 <= len(redirect_uris) <= 10:
        raise OAuthError("invalid_client_metadata", "Provide 1 to 10 redirect URIs")
    if any(
        not isinstance(uri, str) or not _valid_redirect_uri(uri)
        for uri in redirect_uris
    ):
        raise OAuthError(
            "invalid_redirect_uri",
            "Redirect URIs must use HTTPS or localhost HTTP and must not contain fragments",
        )
    if len(set(redirect_uris)) != len(redirect_uris):
        raise OAuthError("invalid_client_metadata", "Redirect URIs must be unique")

    grant_types = metadata.get("grant_types", ["authorization_code", "refresh_token"])
    response_types = metadata.get("response_types", ["code"])
    auth_method = metadata.get("token_endpoint_auth_method", "none")
    if set(grant_types) - {"authorization_code", "refresh_token"}:
        raise OAuthError("invalid_client_metadata", "Unsupported grant type")
    if response_types != ["code"] or auth_method != "none":
        raise OAuthError(
            "invalid_client_metadata",
            "Anlok supports public authorization-code clients without a client secret",
        )

    client_name = str(metadata.get("client_name") or "MCP client").strip()
    if not client_name or len(client_name) > 200:
        raise OAuthError("invalid_client_metadata", "Client name is invalid")

    issued_at = _now()
    client_id = f"anlok_{secrets.token_urlsafe(24)}"
    with _oauth_db() as session:
        session.add(
            OAuthClient(
                client_id=client_id,
                client_name=client_name,
                redirect_uris_json=json.dumps(redirect_uris),
                created_at=issued_at,
            )
        )
        session.commit()

    return {
        "client_id": client_id,
        "client_id_issued_at": issued_at,
        "client_name": client_name,
        "redirect_uris": redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
    }


def begin_authorization(
    *,
    client_id: str,
    redirect_uri: str,
    state: str,
    code_challenge: str,
    code_challenge_method: str,
    resource: str,
    scope: str | None,
    response_type: str,
) -> str:
    if response_type != "code":
        raise OAuthError(
            "unsupported_response_type", "Only code responses are supported"
        )
    if not state or len(state) > 2048:
        raise OAuthError("invalid_request", "A valid state value is required")
    if code_challenge_method != "S256" or not PKCE_PATTERN.fullmatch(code_challenge):
        raise OAuthError(
            "invalid_request", "PKCE with an S256 code challenge is required"
        )
    if resource != oauth_settings.resource_url:
        raise OAuthError(
            "invalid_target", "The requested resource is not this MCP server"
        )
    normalized_scope = _scope_value(scope)

    with _oauth_db() as session:
        client = session.query(OAuthClient).filter_by(client_id=client_id).first()
        if not client:
            raise OAuthError("invalid_request", "Unknown client_id")
        if redirect_uri not in json.loads(client.redirect_uris_json):
            raise OAuthError(
                "invalid_request", "redirect_uri does not match registration"
            )

        request_token = _new_secret()
        session.add(
            OAuthAuthorizationRequest(
                request_hash=hash_secret(request_token),
                client_id=client_id,
                redirect_uri=redirect_uri,
                state=state,
                code_challenge=code_challenge,
                resource=resource,
                scope=normalized_scope,
                expires_at=_now() + oauth_settings.authorization_request_ttl,
            )
        )
        session.commit()

    query = urlencode({"request_id": request_token})
    return f"{oauth_settings.web_url}/oauth/authorize?{query}"


def authorization_error_redirect(
    *,
    client_id: str | None,
    redirect_uri: str | None,
    state: str | None,
    error: OAuthError,
) -> str | None:
    """Return a client error redirect only after exact redirect registration validation."""
    if not client_id or not redirect_uri or not state:
        return None
    with _oauth_db() as session:
        client = session.query(OAuthClient).filter_by(client_id=client_id).first()
        if not client or redirect_uri not in json.loads(client.redirect_uris_json):
            return None
    return _redirect_with_query(
        redirect_uri,
        {
            "error": error.error,
            "error_description": error.description,
            "state": state,
        },
    )


def get_authorization_request(request_token: str) -> dict:
    with _oauth_db() as session:
        item = (
            session.query(OAuthAuthorizationRequest, OAuthClient)
            .join(
                OAuthClient,
                OAuthClient.client_id == OAuthAuthorizationRequest.client_id,
            )
            .filter(
                OAuthAuthorizationRequest.request_hash == hash_secret(request_token)
            )
            .first()
        )
        if not item:
            raise OAuthError(
                "invalid_request", "Authorization request was not found", 404
            )
        request, client = item
        if request.expires_at <= _now():
            session.delete(request)
            session.commit()
            raise OAuthError(
                "invalid_request", "Authorization request has expired", 410
            )
        return {
            "client_name": client.client_name,
            "scope": request.scope,
            "resource": request.resource,
        }


def decide_authorization(request_token: str, user: User, approved: bool) -> str:
    request_hash = hash_secret(request_token)
    with _oauth_db() as session:
        request = (
            session.query(OAuthAuthorizationRequest)
            .filter_by(request_hash=request_hash)
            .first()
        )
        if not request or request.expires_at <= _now():
            if request:
                session.delete(request)
                session.commit()
            raise OAuthError(
                "invalid_request", "Authorization request has expired", 410
            )

        redirect_uri = request.redirect_uri
        state = request.state
        if not approved:
            session.query(OAuthAuthorizationRequest).filter_by(
                request_hash=request_hash
            ).delete(synchronize_session=False)
            session.commit()
            return _redirect_with_query(
                redirect_uri, {"error": "access_denied", "state": state}
            )

        if not user.is_active:
            raise OAuthError(
                "access_denied", "Inactive accounts cannot connect to MCP", 403
            )

        claimed = (
            session.query(OAuthAuthorizationRequest)
            .filter(
                OAuthAuthorizationRequest.request_hash == request_hash,
                OAuthAuthorizationRequest.expires_at > _now(),
            )
            .delete(synchronize_session=False)
        )
        if claimed != 1:
            session.rollback()
            raise OAuthError(
                "invalid_request", "Authorization request was already used", 410
            )

        code = _new_secret()
        session.add(
            OAuthAuthorizationCode(
                code_hash=hash_secret(code),
                client_id=request.client_id,
                user_id=user.id,
                redirect_uri=redirect_uri,
                code_challenge=request.code_challenge,
                resource=request.resource,
                scope=request.scope,
                expires_at=_now() + oauth_settings.authorization_code_ttl,
            )
        )
        session.commit()
        return _redirect_with_query(redirect_uri, {"code": code, "state": state})


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _issue_token_pair(
    session, *, user_id, client_id, resource, scope, family_id, refresh_expires_at
):
    now = _now()
    access_token = _new_secret()
    refresh_token = _new_secret()
    session.add(
        OAuthAccessToken(
            token_hash=hash_secret(access_token),
            family_id=family_id,
            client_id=client_id,
            user_id=user_id,
            resource=resource,
            scope=scope,
            expires_at=now + oauth_settings.access_token_ttl,
        )
    )
    session.add(
        OAuthRefreshToken(
            token_hash=hash_secret(refresh_token),
            family_id=family_id,
            client_id=client_id,
            user_id=user_id,
            resource=resource,
            scope=scope,
            expires_at=refresh_expires_at,
        )
    )
    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": oauth_settings.access_token_ttl,
        "refresh_token": refresh_token,
        "scope": scope,
    }


def exchange_authorization_code(
    *, code: str, client_id: str, redirect_uri: str, code_verifier: str, resource: str
) -> dict:
    if not PKCE_PATTERN.fullmatch(code_verifier or ""):
        raise OAuthError("invalid_grant", "Invalid code verifier")
    now = _now()
    with _oauth_db() as session:
        item = (
            session.query(OAuthAuthorizationCode)
            .filter_by(code_hash=hash_secret(code))
            .first()
        )
        if not item or item.used_at is not None or item.expires_at <= now:
            raise OAuthError(
                "invalid_grant", "Authorization code is invalid or expired"
            )
        if (
            item.client_id != client_id
            or item.redirect_uri != redirect_uri
            or item.resource != resource
            or resource != oauth_settings.resource_url
        ):
            raise OAuthError(
                "invalid_grant", "Authorization code binding does not match"
            )
        if not secrets.compare_digest(
            _pkce_challenge(code_verifier), item.code_challenge
        ):
            raise OAuthError("invalid_grant", "PKCE verification failed")

        user = session.query(User).filter_by(id=item.user_id).first()
        if not user or not user.is_active:
            raise OAuthError("invalid_grant", "The authorizing account is inactive")

        claimed = (
            session.query(OAuthAuthorizationCode)
            .filter(
                OAuthAuthorizationCode.code_hash == item.code_hash,
                OAuthAuthorizationCode.used_at.is_(None),
                OAuthAuthorizationCode.expires_at > now,
            )
            .update({OAuthAuthorizationCode.used_at: now}, synchronize_session=False)
        )
        if claimed != 1:
            session.rollback()
            raise OAuthError("invalid_grant", "Authorization code was already used")
        family_id = secrets.token_urlsafe(24)
        response = _issue_token_pair(
            session,
            user_id=item.user_id,
            client_id=item.client_id,
            resource=item.resource,
            scope=item.scope,
            family_id=family_id,
            refresh_expires_at=now + oauth_settings.refresh_token_ttl,
        )
        session.commit()
        return response


def _revoke_family(session, family_id: str, now: int) -> None:
    session.query(OAuthAccessToken).filter(
        OAuthAccessToken.family_id == family_id,
        OAuthAccessToken.revoked_at.is_(None),
    ).update({OAuthAccessToken.revoked_at: now}, synchronize_session=False)
    session.query(OAuthRefreshToken).filter(
        OAuthRefreshToken.family_id == family_id,
        OAuthRefreshToken.revoked_at.is_(None),
    ).update({OAuthRefreshToken.revoked_at: now}, synchronize_session=False)


def rotate_refresh_token(
    *, refresh_token: str, client_id: str, resource: str, scope: str | None
) -> dict:
    now = _now()
    token_hash = hash_secret(refresh_token)
    with _oauth_db() as session:
        item = session.query(OAuthRefreshToken).filter_by(token_hash=token_hash).first()
        if not item:
            raise OAuthError("invalid_grant", "Refresh token is invalid")
        if item.used_at is not None or item.revoked_at is not None:
            _revoke_family(session, item.family_id, now)
            session.commit()
            raise OAuthError("invalid_grant", "Refresh token reuse was detected")
        if item.expires_at <= now:
            item.revoked_at = now
            session.commit()
            raise OAuthError("invalid_grant", "Refresh token has expired")
        if item.client_id != client_id or item.resource != resource:
            raise OAuthError("invalid_grant", "Refresh token binding does not match")
        if scope is not None and _scope_value(scope) != item.scope:
            raise OAuthError("invalid_scope", "Refresh cannot increase or change scope")

        user = session.query(User).filter_by(id=item.user_id).first()
        if not user or not user.is_active:
            _revoke_family(session, item.family_id, now)
            session.commit()
            raise OAuthError("invalid_grant", "The authorizing account is inactive")

        family_id = item.family_id
        claimed = (
            session.query(OAuthRefreshToken)
            .filter(
                OAuthRefreshToken.token_hash == token_hash,
                OAuthRefreshToken.used_at.is_(None),
                OAuthRefreshToken.revoked_at.is_(None),
                OAuthRefreshToken.expires_at > now,
            )
            .update({OAuthRefreshToken.used_at: now}, synchronize_session=False)
        )
        if claimed != 1:
            session.rollback()
            with _oauth_db() as replay_session:
                _revoke_family(replay_session, family_id, now)
                replay_session.commit()
            raise OAuthError("invalid_grant", "Refresh token reuse was detected")
        response = _issue_token_pair(
            session,
            user_id=item.user_id,
            client_id=item.client_id,
            resource=item.resource,
            scope=item.scope,
            family_id=family_id,
            refresh_expires_at=item.expires_at,
        )
        session.commit()
        return response


def verify_access_token(token: str) -> dict | None:
    now = _now()
    with _oauth_db() as session:
        item = (
            session.query(OAuthAccessToken)
            .filter_by(token_hash=hash_secret(token))
            .first()
        )
        if (
            not item
            or item.revoked_at is not None
            or item.expires_at <= now
            or item.resource != oauth_settings.resource_url
        ):
            return None
        user = session.query(User).filter_by(id=item.user_id).first()
        if not user or not user.is_active:
            return None
        return {
            "client_id": item.client_id,
            "user_id": item.user_id,
            "role": user.role,
            "scopes": item.scope.split(),
            "resource": item.resource,
            "expires_at": item.expires_at,
        }


def revoke_token(token: str, client_id: str) -> None:
    token_hash = hash_secret(token)
    now = _now()
    with _oauth_db() as session:
        refresh = (
            session.query(OAuthRefreshToken).filter_by(token_hash=token_hash).first()
        )
        if refresh and refresh.client_id == client_id:
            _revoke_family(session, refresh.family_id, now)
            session.commit()
            return
        access = (
            session.query(OAuthAccessToken).filter_by(token_hash=token_hash).first()
        )
        if access and access.client_id == client_id and access.revoked_at is None:
            access.revoked_at = now
            session.commit()


def cleanup_expired_oauth_data() -> None:
    now = _now()
    with _oauth_db() as session:
        session.query(OAuthAuthorizationRequest).filter(
            OAuthAuthorizationRequest.expires_at <= now
        ).delete(synchronize_session=False)
        session.query(OAuthAuthorizationCode).filter(
            OAuthAuthorizationCode.expires_at <= now
        ).delete(synchronize_session=False)
        session.query(OAuthAccessToken).filter(
            OAuthAccessToken.expires_at <= now
        ).delete(synchronize_session=False)
        session.query(OAuthRefreshToken).filter(
            OAuthRefreshToken.expires_at <= now
        ).delete(synchronize_session=False)
        session.commit()
