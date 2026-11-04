import hashlib
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import api
import src.db as db
from tests.test_oauth_mcp import DatabaseTestMixin


def store_key(raw_key: str, user_id, scope: str):
    db.add_api_key(
        suffix=raw_key[-4:],
        key_hash=hashlib.sha256(raw_key.encode()).hexdigest(),
        description=f"{scope} key",
        user_id=user_id,
        scope=scope,
    )


class APIKeyScopeTests(DatabaseTestMixin, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.resident_id = self.user_ids["resident1@example.com"]
        self.full_key = "full-key-for-tests-aaaa"
        self.unlock_key = "unlock-key-for-tests-bbbb"
        store_key(self.full_key, self.resident_id, "full")
        store_key(self.unlock_key, self.resident_id, "unlock")
        self.client = TestClient(api.app)

    def unlock(self, **kwargs):
        with patch(
            "src.api.routes.doors.unlock_for_user",
            AsyncMock(return_value={"message": "Door unlocked"}),
        ) as unlock_mock:
            response = self.client.post("/doors/unlock", **kwargs)
        return response, unlock_mock

    def test_unlock_only_key_can_unlock_door(self):
        response, unlock_mock = self.unlock(headers={"X-API-Key": self.unlock_key})

        self.assertEqual(response.status_code, 200)
        unlock_mock.assert_awaited_once()
        self.assertEqual(unlock_mock.await_args.args[0].id, self.resident_id)

    def test_unlock_only_key_works_as_query_parameter(self):
        response, _ = self.unlock(params={"api_key": self.unlock_key})

        self.assertEqual(response.status_code, 200)

    def test_unlock_only_key_cannot_call_other_endpoints(self):
        for method, path in [
            ("GET", "/api-keys"),
            ("POST", "/api-keys"),
            ("GET", "/users/me"),
            ("GET", "/pins"),
        ]:
            with self.subTest(method=method, path=path):
                response = self.client.request(
                    method,
                    path,
                    headers={"X-API-Key": self.unlock_key},
                    json={"description": "escalate", "scope": "full"},
                )
                self.assertEqual(response.status_code, 403, response.text)

    def test_full_key_keeps_owner_permissions(self):
        response = self.client.get("/api-keys", headers={"X-API-Key": self.full_key})

        self.assertEqual(response.status_code, 200)
        scopes = {key["key_suffix"]: key["scope"] for key in response.json()}
        self.assertEqual(scopes[self.full_key[-4:]], "full")
        self.assertEqual(scopes[self.unlock_key[-4:]], "unlock")

    def test_created_key_defaults_to_full_and_accepts_unlock_scope(self):
        headers = {"X-API-Key": self.full_key}

        default_key = self.client.post(
            "/api-keys", headers=headers, json={"description": "default"}
        )
        unlock_key = self.client.post(
            "/api-keys",
            headers=headers,
            json={"description": "iPhone", "scope": "unlock"},
        )
        invalid = self.client.post(
            "/api-keys",
            headers=headers,
            json={"description": "bad", "scope": "admin"},
        )

        self.assertEqual(default_key.status_code, 200)
        self.assertEqual(default_key.json()["scope"], "full")
        self.assertEqual(unlock_key.status_code, 200)
        self.assertEqual(unlock_key.json()["scope"], "unlock")
        self.assertEqual(invalid.status_code, 422)

        response, _ = self.unlock(headers={"X-API-Key": unlock_key.json()["api_key"]})
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
