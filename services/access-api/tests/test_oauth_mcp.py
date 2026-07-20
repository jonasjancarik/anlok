import base64
import hashlib
import time
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi.testclient import TestClient
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

import api
import src.db as db
from src.oauth_config import oauth_settings
from src.oauth_models import (
    OAuthAccessToken,
    OAuthAuthorizationCode,
    OAuthAuthorizationRequest,
    OAuthRefreshToken,
)
from src.oauth_service import (
    OAuthError,
    begin_authorization,
    decide_authorization,
    exchange_authorization_code,
    get_authorization_request,
    register_client,
    rotate_refresh_token,
    verify_access_token,
)
from src.utils import hash_secret


VERIFIER = "v" * 43
CHALLENGE = (
    base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode("ascii")).digest())
    .rstrip(b"=")
    .decode("ascii")
)
REDIRECT_URI = "http://127.0.0.1:8765/callback"


class DatabaseTestMixin:
    def setUp(self):
        self.original_bind = db.SessionLocal.kw.get("bind")
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        db.SessionLocal.configure(bind=self.engine)
        db.Base.metadata.create_all(self.engine)
        with db.get_db() as session:
            apartment_one = db.Apartment(number="1", description="First")
            apartment_two = db.Apartment(number="2", description="Second")
            session.add_all([apartment_one, apartment_two])
            session.flush()
            users = [
                db.User(
                    name="Resident One",
                    email="resident1@example.com",
                    role="user",
                    apartment_id=apartment_one.id,
                    is_active=True,
                ),
                db.User(
                    name="Apartment Manager",
                    email="manager@example.com",
                    role="apartment_admin",
                    apartment_id=apartment_one.id,
                    is_active=True,
                ),
                db.User(
                    name="Resident Two",
                    email="resident2@example.com",
                    role="user",
                    apartment_id=apartment_two.id,
                    is_active=True,
                ),
                db.User(
                    name="Building Admin",
                    email="admin@example.com",
                    role="admin",
                    apartment_id=apartment_one.id,
                    is_active=True,
                ),
                db.User(
                    name="Inactive Resident",
                    email="inactive@example.com",
                    role="user",
                    apartment_id=apartment_one.id,
                    is_active=False,
                ),
            ]
            session.add_all(users)
            session.commit()
            self.user_ids = {user.email: user.id for user in users}

    def tearDown(self):
        db.SessionLocal.configure(bind=self.original_bind)
        self.engine.dispose()

    def register(self):
        return register_client(
            {"client_name": "Test MCP Client", "redirect_uris": [REDIRECT_URI]}
        )

    def authorization_code(self, user_email="resident1@example.com", **overrides):
        client = overrides.pop("client", self.register())
        redirect_uri = overrides.pop("redirect_uri", REDIRECT_URI)
        authorization_url = begin_authorization(
            response_type="code",
            client_id=client["client_id"],
            redirect_uri=redirect_uri,
            state=overrides.pop("state", "client-state"),
            code_challenge=overrides.pop("code_challenge", CHALLENGE),
            code_challenge_method=overrides.pop("code_challenge_method", "S256"),
            resource=overrides.pop("resource", oauth_settings.resource_url),
            scope=overrides.pop("scope", oauth_settings.scope),
            **overrides,
        )
        request_token = parse_qs(urlparse(authorization_url).query)["request_id"][0]
        user = db.get_user(self.user_ids[user_email])
        callback = decide_authorization(request_token, user, approved=True)
        parsed_callback = parse_qs(urlparse(callback).query)
        return client, parsed_callback["code"][0], parsed_callback["state"][0]

    def access_token(self, user_email="resident1@example.com"):
        client, code, _ = self.authorization_code(user_email)
        tokens = exchange_authorization_code(
            code=code,
            client_id=client["client_id"],
            redirect_uri=REDIRECT_URI,
            code_verifier=VERIFIER,
            resource=oauth_settings.resource_url,
        )
        return client, tokens

    def http_access_token(self, user_email="resident1@example.com"):
        http = TestClient(api.app)
        registration = http.post(
            "/oauth/register",
            json={"client_name": "HTTP MCP Client", "redirect_uris": [REDIRECT_URI]},
        )
        self.assertEqual(registration.status_code, 201)
        client = registration.json()
        authorization = http.get(
            "/oauth/authorize",
            params={
                "response_type": "code",
                "client_id": client["client_id"],
                "redirect_uri": REDIRECT_URI,
                "state": "http-state",
                "code_challenge": CHALLENGE,
                "code_challenge_method": "S256",
                "resource": oauth_settings.resource_url,
                "scope": oauth_settings.scope,
            },
            follow_redirects=False,
        )
        self.assertEqual(authorization.status_code, 302)
        request_token = parse_qs(urlparse(authorization.headers["location"]).query)[
            "request_id"
        ][0]

        app_token = "legacy-app-session-for-test"
        with db.get_db() as session:
            session.add(
                db.Token(
                    user_id=self.user_ids[user_email],
                    token_hash=hash_secret(app_token),
                    expiration=int(time.time()) + 60,
                )
            )
            session.commit()
        headers = {"Authorization": f"Bearer {app_token}"}
        consent = http.get(
            f"/oauth/authorization-requests/{request_token}", headers=headers
        )
        self.assertEqual(consent.status_code, 200)
        decision = http.post(
            f"/oauth/authorization-requests/{request_token}",
            headers=headers,
            json={"decision": "approve"},
        )
        self.assertEqual(decision.status_code, 200)
        callback = parse_qs(urlparse(decision.json()["redirect_uri"]).query)
        self.assertEqual(callback["state"], ["http-state"])

        exchanged = http.post(
            "/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": client["client_id"],
                "resource": oauth_settings.resource_url,
                "code": callback["code"][0],
                "redirect_uri": REDIRECT_URI,
                "code_verifier": VERIFIER,
            },
        )
        self.assertEqual(exchanged.status_code, 200)
        return client, exchanged.json()


class OAuthServiceTests(DatabaseTestMixin, unittest.TestCase):
    def test_dynamic_registration_accepts_public_local_client(self):
        client = self.register()
        self.assertTrue(client["client_id"].startswith("anlok_"))
        self.assertEqual(client["token_endpoint_auth_method"], "none")
        self.assertNotIn("client_secret", client)

    def test_dynamic_registration_rejects_unsafe_redirect(self):
        with self.assertRaises(OAuthError) as raised:
            register_client(
                {"client_name": "Unsafe", "redirect_uris": ["http://example.com/cb"]}
            )
        self.assertEqual(raised.exception.error, "invalid_redirect_uri")

    def test_authorization_requires_exact_redirect_and_resource(self):
        client = self.register()
        with self.assertRaises(OAuthError):
            begin_authorization(
                response_type="code",
                client_id=client["client_id"],
                redirect_uri="http://127.0.0.1:8765/different",
                state="state",
                code_challenge=CHALLENGE,
                code_challenge_method="S256",
                resource=oauth_settings.resource_url,
                scope=oauth_settings.scope,
            )
        with self.assertRaises(OAuthError) as raised:
            begin_authorization(
                response_type="code",
                client_id=client["client_id"],
                redirect_uri=REDIRECT_URI,
                state="state",
                code_challenge=CHALLENGE,
                code_challenge_method="S256",
                resource="http://localhost:8000/not-mcp",
                scope=oauth_settings.scope,
            )
        self.assertEqual(raised.exception.error, "invalid_target")

    def test_consent_preserves_state_and_is_one_time(self):
        client = self.register()
        url = begin_authorization(
            response_type="code",
            client_id=client["client_id"],
            redirect_uri=REDIRECT_URI,
            state="opaque-state",
            code_challenge=CHALLENGE,
            code_challenge_method="S256",
            resource=oauth_settings.resource_url,
            scope=oauth_settings.scope,
        )
        request_token = parse_qs(urlparse(url).query)["request_id"][0]
        self.assertEqual(
            get_authorization_request(request_token)["client_name"], "Test MCP Client"
        )
        callback = decide_authorization(
            request_token, db.get_user(self.user_ids["resident1@example.com"]), True
        )
        self.assertEqual(parse_qs(urlparse(callback).query)["state"], ["opaque-state"])
        with self.assertRaises(OAuthError):
            get_authorization_request(request_token)

    def test_authorization_request_expires(self):
        client = self.register()
        url = begin_authorization(
            response_type="code",
            client_id=client["client_id"],
            redirect_uri=REDIRECT_URI,
            state="state",
            code_challenge=CHALLENGE,
            code_challenge_method="S256",
            resource=oauth_settings.resource_url,
            scope=oauth_settings.scope,
        )
        request_token = parse_qs(urlparse(url).query)["request_id"][0]
        with db.get_db() as session:
            request = session.query(OAuthAuthorizationRequest).one()
            request.expires_at = int(time.time()) - 1
            session.commit()
        with self.assertRaises(OAuthError) as raised:
            get_authorization_request(request_token)
        self.assertEqual(raised.exception.status_code, 410)

    def test_pkce_failure_success_and_code_one_time_use(self):
        client, code, _ = self.authorization_code()
        with self.assertRaises(OAuthError) as raised:
            exchange_authorization_code(
                code=code,
                client_id=client["client_id"],
                redirect_uri=REDIRECT_URI,
                code_verifier="x" * 43,
                resource=oauth_settings.resource_url,
            )
        self.assertIn("PKCE", raised.exception.description)

        tokens = exchange_authorization_code(
            code=code,
            client_id=client["client_id"],
            redirect_uri=REDIRECT_URI,
            code_verifier=VERIFIER,
            resource=oauth_settings.resource_url,
        )
        self.assertEqual(tokens["expires_in"], oauth_settings.access_token_ttl)
        with self.assertRaises(OAuthError):
            exchange_authorization_code(
                code=code,
                client_id=client["client_id"],
                redirect_uri=REDIRECT_URI,
                code_verifier=VERIFIER,
                resource=oauth_settings.resource_url,
            )

    def test_expired_code_and_access_token_are_rejected(self):
        client, code, _ = self.authorization_code()
        with db.get_db() as session:
            item = session.query(OAuthAuthorizationCode).one()
            item.expires_at = int(time.time()) - 1
            session.commit()
        with self.assertRaises(OAuthError):
            exchange_authorization_code(
                code=code,
                client_id=client["client_id"],
                redirect_uri=REDIRECT_URI,
                code_verifier=VERIFIER,
                resource=oauth_settings.resource_url,
            )

        _, tokens = self.access_token()
        with db.get_db() as session:
            item = session.query(OAuthAccessToken).one()
            item.expires_at = int(time.time()) - 1
            session.commit()
        self.assertIsNone(verify_access_token(tokens["access_token"]))

    def test_access_token_audience_is_enforced(self):
        _, tokens = self.access_token()
        with db.get_db() as session:
            item = session.query(OAuthAccessToken).one()
            item.resource = "https://other.example/mcp"
            session.commit()
        self.assertIsNone(verify_access_token(tokens["access_token"]))

    def test_refresh_rotation_rejects_replay_and_revokes_family(self):
        client, tokens = self.access_token()
        rotated = rotate_refresh_token(
            refresh_token=tokens["refresh_token"],
            client_id=client["client_id"],
            resource=oauth_settings.resource_url,
            scope=None,
        )
        self.assertIsNotNone(verify_access_token(rotated["access_token"]))
        with self.assertRaises(OAuthError) as raised:
            rotate_refresh_token(
                refresh_token=tokens["refresh_token"],
                client_id=client["client_id"],
                resource=oauth_settings.resource_url,
                scope=None,
            )
        self.assertIn("reuse", raised.exception.description.lower())
        self.assertIsNone(verify_access_token(rotated["access_token"]))

    def test_inactive_user_cannot_authorize_or_use_existing_token(self):
        client = self.register()
        url = begin_authorization(
            response_type="code",
            client_id=client["client_id"],
            redirect_uri=REDIRECT_URI,
            state="state",
            code_challenge=CHALLENGE,
            code_challenge_method="S256",
            resource=oauth_settings.resource_url,
            scope=oauth_settings.scope,
        )
        request_token = parse_qs(urlparse(url).query)["request_id"][0]
        with self.assertRaises(OAuthError) as raised:
            decide_authorization(
                request_token,
                db.get_user(self.user_ids["inactive@example.com"]),
                approved=True,
            )
        self.assertEqual(raised.exception.status_code, 403)

        _, tokens = self.access_token("resident1@example.com")
        with db.get_db() as session:
            resident = (
                session.query(db.User)
                .filter_by(id=self.user_ids["resident1@example.com"])
                .one()
            )
            resident.is_active = False
            session.commit()
        self.assertIsNone(verify_access_token(tokens["access_token"]))

    def test_deleted_user_grants_cannot_attach_to_reused_user_id(self):
        client, tokens = self.access_token("resident1@example.com")
        code_client, pending_code, _ = self.authorization_code(
            "resident1@example.com"
        )
        deleted_user_id = self.user_ids["resident1@example.com"]

        with db.get_db() as session:
            session.query(db.User).filter(db.User.id != deleted_user_id).delete(
                synchronize_session=False
            )
            session.commit()

        self.assertTrue(db.remove_user(deleted_user_id))
        replacement = db.add_user(
            {
                "name": "Replacement Admin",
                "email": "replacement@example.com",
                "role": "admin",
                "apartment_id": 1,
                "is_active": True,
            }
        )
        self.assertEqual(replacement.id, deleted_user_id)

        self.assertIsNone(verify_access_token(tokens["access_token"]))
        with self.assertRaises(OAuthError):
            rotate_refresh_token(
                refresh_token=tokens["refresh_token"],
                client_id=client["client_id"],
                resource=oauth_settings.resource_url,
                scope=None,
            )
        with self.assertRaises(OAuthError):
            exchange_authorization_code(
                code=pending_code,
                client_id=code_client["client_id"],
                redirect_uri=REDIRECT_URI,
                code_verifier=VERIFIER,
                resource=oauth_settings.resource_url,
            )

        with db.get_db() as session:
            self.assertEqual(
                session.query(OAuthAuthorizationCode)
                .filter_by(user_id=deleted_user_id)
                .count(),
                0,
            )
            self.assertEqual(
                session.query(OAuthAccessToken)
                .filter_by(user_id=deleted_user_id)
                .count(),
                0,
            )
            self.assertEqual(
                session.query(OAuthRefreshToken)
                .filter_by(user_id=deleted_user_id)
                .count(),
                0,
            )


class OAuthHttpTests(unittest.TestCase):
    def test_discovery_documents_and_mcp_challenge(self):
        client = TestClient(api.app)
        metadata = client.get("/.well-known/oauth-authorization-server")
        self.assertEqual(metadata.status_code, 200)
        self.assertEqual(metadata.json()["code_challenge_methods_supported"], ["S256"])
        self.assertIn("registration_endpoint", metadata.json())

        protected = client.get("/.well-known/oauth-protected-resource/mcp")
        self.assertEqual(protected.status_code, 200)
        self.assertEqual(protected.json()["resource"], oauth_settings.resource_url)
        self.assertEqual(protected.json()["bearer_methods_supported"], ["header"])
        self.assertEqual(
            metadata.json()["issuer"],
            protected.json()["authorization_servers"][0],
        )
        self.assertEqual(
            metadata.json()["authorization_endpoint"],
            f"{metadata.json()['issuer'].rstrip('/')}/oauth/authorize",
        )

        unauthorized = client.post("/mcp", json={})
        self.assertEqual(unauthorized.status_code, 401)
        challenge = unauthorized.headers["www-authenticate"]
        self.assertIn("resource_metadata=", challenge)
        self.assertIn(f'scope="{oauth_settings.scope}"', challenge)

    def test_existing_route_trailing_slash_redirect_is_preserved(self):
        response = TestClient(api.app).post(
            "/auth/tokens/", json={}, follow_redirects=False
        )

        self.assertEqual(response.status_code, 307)
        self.assertEqual(response.headers["location"], "http://testserver/auth/tokens")


class OAuthConsentSessionTests(DatabaseTestMixin, unittest.TestCase):
    def test_expired_app_token_cannot_approve_oauth(self):
        client = self.register()
        url = begin_authorization(
            response_type="code",
            client_id=client["client_id"],
            redirect_uri=REDIRECT_URI,
            state="state",
            code_challenge=CHALLENGE,
            code_challenge_method="S256",
            resource=oauth_settings.resource_url,
            scope=oauth_settings.scope,
        )
        request_token = parse_qs(urlparse(url).query)["request_id"][0]
        expired_token = "expired-app-session"
        with db.get_db() as session:
            session.add(
                db.Token(
                    user_id=self.user_ids["resident1@example.com"],
                    token_hash=hash_secret(expired_token),
                    expiration=int(time.time()) - 1,
                )
            )
            session.commit()

        response = TestClient(api.app).post(
            f"/oauth/authorization-requests/{request_token}",
            headers={"Authorization": f"Bearer {expired_token}"},
            json={"decision": "approve"},
        )
        self.assertEqual(response.status_code, 401)


class McpProtocolTests(DatabaseTestMixin, unittest.IsolatedAsyncioTestCase):
    async def test_official_client_initialize_discovery_scope_and_confirmation(self):
        _, tokens = self.http_access_token()
        _, manager_tokens = self.access_token("manager@example.com")
        _, admin_tokens = self.access_token("admin@example.com")
        transport = httpx.ASGITransport(app=api.app)
        async with api.mcp.session_manager.run():
            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://testserver",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            ) as http_client:
                async with streamable_http_client(
                    "http://testserver/mcp", http_client=http_client
                ) as (read_stream, write_stream, _):
                    async with ClientSession(read_stream, write_stream) as session:
                        initialized = await session.initialize()
                        self.assertEqual(initialized.serverInfo.name, "Anlok")
                        tools = await session.list_tools()
                        tool_map = {tool.name: tool for tool in tools.tools}
                        self.assertIn("get_profile", tool_map)
                        self.assertNotIn("list_users", tool_map)
                        self.assertTrue(
                            tool_map["get_profile"].annotations.readOnlyHint
                        )
                        self.assertTrue(
                            tool_map["delete_pin"].annotations.destructiveHint
                        )
                        self.assertTrue(
                            tool_map["unlock_door"].annotations.destructiveHint
                        )

                        profile = await session.call_tool("get_profile", {})
                        self.assertFalse(profile.isError)
                        cross_scope = await session.call_tool(
                            "get_user",
                            {"user_id": self.user_ids["resident2@example.com"]},
                        )
                        self.assertTrue(cross_scope.isError)
                        self.assertIn(
                            "Cannot access this user", cross_scope.content[0].text
                        )
                        confirmation = await session.call_tool(
                            "unlock_door", {"confirm": False}
                        )
                        self.assertTrue(confirmation.isError)
                        delete_confirmation = await session.call_tool(
                            "delete_pin", {"pin_id": 999, "confirm": False}
                        )
                        self.assertTrue(delete_confirmation.isError)

            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://testserver",
                headers={"Authorization": f"Bearer {manager_tokens['access_token']}"},
            ) as http_client:
                async with streamable_http_client(
                    "http://testserver/mcp", http_client=http_client
                ) as streams:
                    async with ClientSession(streams[0], streams[1]) as session:
                        await session.initialize()
                        same_apartment = await session.call_tool(
                            "get_user",
                            {"user_id": self.user_ids["resident1@example.com"]},
                        )
                        other_apartment = await session.call_tool(
                            "get_user",
                            {"user_id": self.user_ids["resident2@example.com"]},
                        )
                        self.assertFalse(same_apartment.isError)
                        self.assertTrue(other_apartment.isError)

            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://testserver",
                headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
            ) as http_client:
                async with streamable_http_client(
                    "http://testserver/mcp", http_client=http_client
                ) as streams:
                    async with ClientSession(streams[0], streams[1]) as session:
                        await session.initialize()
                        tools = await session.list_tools()
                        self.assertIn("list_users", {tool.name for tool in tools.tools})
                        cross_apartment = await session.call_tool(
                            "get_user",
                            {"user_id": self.user_ids["resident2@example.com"]},
                        )
                        self.assertFalse(cross_apartment.isError)
