import importlib
import os
import unittest
from unittest.mock import patch

from src import utils
from src.api import pin_policy
from src.api.routes import auth as auth_routes
from src.reader import input_handler


class ConfigRegressionTests(unittest.TestCase):
    def test_oauth_production_urls_require_https(self):
        from src.oauth_config import load_oauth_settings

        with patch.dict(
            "os.environ",
            {
                "ENVIRONMENT": "production",
                "MCP_PUBLIC_URL": "http://localhost:8000/mcp",
                "OAUTH_ISSUER_URL": "http://localhost:8000",
                "WEB_APP_URL": "http://localhost:3000",
            },
        ):
            with self.assertRaises(RuntimeError) as raised:
                load_oauth_settings()

        self.assertIn("HTTPS", str(raised.exception))

    def test_oauth_rejects_insecure_non_local_public_url(self):
        from src.oauth_config import load_oauth_settings

        with patch.dict(
            "os.environ",
            {
                "ENVIRONMENT": "development",
                "MCP_PUBLIC_URL": "http://door.example.com/mcp",
                "OAUTH_ISSUER_URL": "https://door.example.com",
                "WEB_APP_URL": "https://access.example.com",
            },
        ):
            with self.assertRaises(RuntimeError) as raised:
                load_oauth_settings()

        self.assertIn("HTTPS", str(raised.exception))

    def tearDown(self):
        importlib.reload(input_handler)

    def test_pin_length_env_is_loaded_as_integer(self):
        with patch.dict(os.environ, {"PIN_LENGTH": "6"}):
            reloaded = importlib.reload(input_handler)

        self.assertEqual(reloaded.PIN_LENGTH, 6)
        self.assertIsInstance(reloaded.PIN_LENGTH, int)

    def test_pin_length_rejects_invalid_values(self):
        with patch.dict(os.environ, {"PIN_LENGTH": "0"}):
            with self.assertRaisesRegex(ValueError, "PIN_LENGTH"):
                input_handler.read_positive_int_env("PIN_LENGTH", 4)

        with patch.dict(os.environ, {"PIN_LENGTH": "abc"}):
            with self.assertRaisesRegex(ValueError, "PIN_LENGTH"):
                input_handler.read_positive_int_env("PIN_LENGTH", 4)

    def test_relay_pin_accepts_legacy_env_name(self):
        with patch.dict(os.environ, {"RELAY_GPIO": "23"}, clear=True):
            self.assertEqual(
                utils.read_int_env("RELAY_PIN", 18, legacy_name="RELAY_GPIO"),
                23,
            )

    def test_relay_active_state_accepts_legacy_env_name(self):
        with patch.dict(os.environ, {"GPIO_ACTIVE": "low"}, clear=True):
            self.assertEqual(
                utils.read_choice_env(
                    "RELAY_ACTIVE_STATE",
                    "HIGH",
                    {"HIGH", "LOW"},
                    legacy_name="GPIO_ACTIVE",
                ),
                "LOW",
            )

    def test_pin_uniqueness_mode_rejects_invalid_values(self):
        with patch.dict(os.environ, {"PIN_UNIQUENESS_MODE": "sometimes"}):
            with self.assertRaisesRegex(ValueError, "PIN_UNIQUENESS_MODE"):
                pin_policy.get_pin_uniqueness_mode()

    def test_guest_pin_mode_rejects_invalid_values(self):
        with patch.dict(os.environ, {"GUEST_PIN_MODE": "sometimes"}):
            with self.assertRaisesRegex(ValueError, "GUEST_PIN_MODE"):
                pin_policy.get_guest_pin_mode()

    def test_login_link_uses_web_app_url_with_email_and_code(self):
        with patch.dict(
            os.environ, {"WEB_APP_URL": "https://anlok.example.com"}, clear=True
        ):
            self.assertEqual(
                auth_routes.build_login_link("AB CD", "jonas+test@example.com"),
                "https://anlok.example.com/login?login_code=AB+CD&email=jonas%2Btest%40example.com",
            )

    def test_login_link_preserves_only_safe_internal_return_path(self):
        valid_link = auth_routes.build_login_link(
            "CODE123", "user@example.com", "/oauth/authorize?request_id=request"
        )

        self.assertIn("return_to=%2Foauth%2Fauthorize", valid_link)
        for unsafe_path in (
            "//attacker.example/steal",
            "///attacker.example/steal",
            "/\n//attacker.example/steal",
            "/\r//attacker.example/steal",
            "/\t//attacker.example/steal",
            "/\\attacker.example/steal",
            "/safe#fragment",
            "https://attacker.example/steal",
        ):
            with self.subTest(unsafe_path=repr(unsafe_path)):
                unsafe_link = auth_routes.build_login_link(
                    "CODE123", "user@example.com", unsafe_path
                )
                self.assertNotIn("return_to", unsafe_link)


if __name__ == "__main__":
    unittest.main()
