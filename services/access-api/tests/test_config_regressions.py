import importlib
import os
import unittest
from unittest.mock import patch

from src import utils
from src.api.routes import auth as auth_routes
from src.reader import input_handler


class ConfigRegressionTests(unittest.TestCase):
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

    def test_login_link_uses_web_app_url_with_email_and_code(self):
        with patch.dict(
            os.environ, {"WEB_APP_URL": "https://anlok.example.com"}, clear=True
        ):
            self.assertEqual(
                auth_routes.build_login_link("AB CD", "jonas+test@example.com"),
                "https://anlok.example.com/login?login_code=AB+CD&email=jonas%2Btest%40example.com",
            )


if __name__ == "__main__":
    unittest.main()
