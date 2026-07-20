"""OAuth 2.1 authorization-server endpoints used by remote MCP clients."""

import time
from typing import Literal

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from src.api.exceptions import APIException
from src.api.utils import check_rate_limit
from src.db import Token, User, get_db
from src.oauth_config import oauth_settings
from src.oauth_service import (
    OAuthError,
    authorization_error_redirect,
    begin_authorization,
    decide_authorization,
    exchange_authorization_code,
    get_authorization_request,
    register_client,
    revoke_token,
    rotate_refresh_token,
)
from src.utils import hash_secret


router = APIRouter(tags=["oauth"])


class AuthorizationDecision(BaseModel):
    decision: Literal["approve", "deny"]


def get_oauth_consent_user(request: Request, db_context=Depends(get_db)) -> User:
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise APIException(
            status_code=401, detail="A current Anlok sign-in is required"
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise APIException(
            status_code=401, detail="A current Anlok sign-in is required"
        )

    with db_context as session:
        user = (
            session.query(User)
            .join(Token, Token.user_id == User.id)
            .filter(
                Token.token_hash == hash_secret(token),
                Token.expiration > int(time.time()),
            )
            .first()
        )
    if not user:
        raise APIException(status_code=401, detail="Your Anlok sign-in has expired")
    return user


@router.get("/.well-known/oauth-authorization-server")
def authorization_server_metadata():
    issuer = oauth_settings.issuer_url
    endpoint_base = issuer.rstrip("/")
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{endpoint_base}/oauth/authorize",
        "token_endpoint": f"{endpoint_base}/oauth/token",
        "registration_endpoint": f"{endpoint_base}/oauth/register",
        "revocation_endpoint": f"{endpoint_base}/oauth/revoke",
        "scopes_supported": [oauth_settings.scope],
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none"],
        "revocation_endpoint_auth_methods_supported": ["none"],
        "code_challenge_methods_supported": ["S256"],
    }


@router.post("/oauth/register", status_code=201)
async def dynamic_client_registration(request: Request):
    try:
        client_host = request.client.host if request.client else "unknown"
        check_rate_limit(f"oauth-register:{client_host}")
        payload = await request.json()
        if not isinstance(payload, dict):
            raise OAuthError(
                "invalid_client_metadata", "Request body must be an object"
            )
        return JSONResponse(
            register_client(payload),
            status_code=201,
            headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
        )
    except OAuthError as error:
        return _oauth_error_response(error)
    except ValueError:
        return _oauth_error_response(
            OAuthError("invalid_client_metadata", "Request body must be valid JSON")
        )


@router.get("/oauth/authorize")
def authorize(
    response_type: str | None = Query(None),
    client_id: str | None = Query(None),
    redirect_uri: str | None = Query(None),
    state: str | None = Query(None),
    code_challenge: str | None = Query(None),
    code_challenge_method: str | None = Query(None),
    resource: str | None = Query(None),
    scope: str | None = Query(None),
):
    try:
        if not all(
            [
                response_type,
                client_id,
                redirect_uri,
                state,
                code_challenge,
                code_challenge_method,
                resource,
            ]
        ):
            raise OAuthError(
                "invalid_request",
                "response_type, client_id, redirect_uri, state, PKCE, and resource are required",
            )
        consent_url = begin_authorization(
            response_type=response_type,
            client_id=client_id,
            redirect_uri=redirect_uri,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            resource=resource,
            scope=scope,
        )
        return RedirectResponse(consent_url, status_code=302)
    except OAuthError as error:
        error_redirect = authorization_error_redirect(
            client_id=client_id,
            redirect_uri=redirect_uri,
            state=state,
            error=error,
        )
        if error_redirect:
            return RedirectResponse(error_redirect, status_code=302)
        return _oauth_error_response(error)


@router.get("/oauth/authorization-requests/{request_token}")
def inspect_authorization_request(
    request_token: str, current_user: User = Depends(get_oauth_consent_user)
):
    try:
        return get_authorization_request(request_token)
    except OAuthError as error:
        return _oauth_error_response(error)


@router.post("/oauth/authorization-requests/{request_token}")
def submit_authorization_decision(
    request_token: str,
    decision: AuthorizationDecision,
    current_user: User = Depends(get_oauth_consent_user),
):
    try:
        redirect_uri = decide_authorization(
            request_token,
            current_user,
            approved=decision.decision == "approve",
        )
        return {"redirect_uri": redirect_uri}
    except OAuthError as error:
        return _oauth_error_response(error)


@router.post("/oauth/token")
def token(
    grant_type: str | None = Form(None),
    client_id: str | None = Form(None),
    resource: str | None = Form(None),
    code: str | None = Form(None),
    redirect_uri: str | None = Form(None),
    code_verifier: str | None = Form(None),
    refresh_token: str | None = Form(None),
    scope: str | None = Form(None),
):
    try:
        if not grant_type or not client_id or not resource:
            raise OAuthError(
                "invalid_request", "grant_type, client_id, and resource are required"
            )
        if grant_type == "authorization_code":
            if not code or not redirect_uri or not code_verifier:
                raise OAuthError(
                    "invalid_request",
                    "code, redirect_uri, and code_verifier are required",
                )
            result = exchange_authorization_code(
                code=code,
                client_id=client_id,
                redirect_uri=redirect_uri,
                code_verifier=code_verifier,
                resource=resource,
            )
        elif grant_type == "refresh_token":
            if not refresh_token:
                raise OAuthError("invalid_request", "refresh_token is required")
            result = rotate_refresh_token(
                refresh_token=refresh_token,
                client_id=client_id,
                resource=resource,
                scope=scope,
            )
        else:
            raise OAuthError("unsupported_grant_type", "Unsupported grant type")
        return JSONResponse(
            result,
            headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
        )
    except OAuthError as error:
        return _oauth_error_response(error)


@router.post("/oauth/revoke", status_code=200)
def revoke(
    token: str = Form(...),
    client_id: str = Form(...),
    token_type_hint: str | None = Form(None),
):
    del token_type_hint
    revoke_token(token, client_id)
    return JSONResponse({}, headers={"Cache-Control": "no-store"})


def _oauth_error_response(error: OAuthError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"error": error.error, "error_description": error.description},
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )
