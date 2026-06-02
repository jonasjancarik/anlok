import unittest
from types import SimpleNamespace
from unittest.mock import call, patch

from pydantic import ValidationError

from src.api.models import NotificationDeviceRegister
from src.notifications import (
    ProviderResult,
    _send_apns,
    _send_fcm,
    send_access_event_notifications,
    send_test_notification,
)


class NotificationRegressionTests(unittest.TestCase):
    def test_notification_registration_accepts_native_provider_tokens(self):
        registration = NotificationDeviceRegister(
            push_token="  native-token  ",
            provider="FCM",
            platform="ANDROID",
        )

        self.assertEqual(registration.push_token, "native-token")
        self.assertEqual(registration.provider, "fcm")
        self.assertEqual(registration.platform, "android")

    def test_notification_registration_rejects_empty_token(self):
        with self.assertRaises(ValidationError):
            NotificationDeviceRegister(push_token=" ", provider="fcm")

    def test_notification_registration_rejects_unsupported_provider(self):
        with self.assertRaises(ValidationError):
            NotificationDeviceRegister(push_token="native-token", provider="expo")

    def test_access_event_notifications_use_direct_device_providers(self):
        event = {
            "method": "pin",
            "outcome": "granted",
            "user_id": 42,
            "credential_label": "Front door PIN",
        }
        devices = [
            {
                "id": 1,
                "push_token": "apns-token",
                "provider": "apns",
                "environment": "sandbox",
            },
            {
                "id": 2,
                "push_token": "fcm-token",
                "provider": "fcm",
                "environment": None,
            },
        ]

        with patch(
            "src.notifications.access_event_store.get_access_event_summary",
            return_value=event,
        ), patch(
            "src.notifications.access_event_store.get_active_notification_devices",
            return_value=devices,
        ), patch(
            "src.notifications.access_event_store.create_notification_delivery",
            side_effect=[101, 102],
        ), patch(
            "src.notifications._send_device_notification",
            side_effect=[
                ProviderResult(status="sent", provider_message_id="apns-id"),
                ProviderResult(
                    status="error",
                    error="FCM 404: UNREGISTERED",
                    deactivate_device=True,
                ),
            ],
        ) as send_device, patch(
            "src.notifications.access_event_store.update_notification_delivery"
        ) as update_delivery, patch(
            "src.notifications.access_event_store.deactivate_notification_device"
        ) as deactivate_device:
            send_access_event_notifications(55)

        self.assertEqual(send_device.call_count, 2)
        update_delivery.assert_has_calls(
            [
                call(101, "sent", "apns-id", None),
                call(102, "error", None, "FCM 404: UNREGISTERED"),
            ]
        )
        deactivate_device.assert_called_once_with("fcm-token")

    def test_shared_pin_event_notifies_all_matched_users(self):
        event = {
            "method": "pin",
            "outcome": "granted",
            "user_id": 42,
            "credential_label": "Front door PIN",
            "metadata": {
                "shared_pin_match": True,
                "matched_user_ids": [42, 43],
            },
        }
        devices_by_user = {
            42: [
                {
                    "id": 1,
                    "push_token": "user-42-token",
                    "provider": "apns",
                    "environment": "sandbox",
                }
            ],
            43: [
                {
                    "id": 2,
                    "push_token": "user-43-token",
                    "provider": "fcm",
                    "environment": None,
                }
            ],
        }

        with patch(
            "src.notifications.access_event_store.get_access_event_summary",
            return_value=event,
        ), patch(
            "src.notifications.access_event_store.get_active_notification_devices",
            side_effect=lambda user_id: devices_by_user[user_id],
        ) as get_devices, patch(
            "src.notifications.access_event_store.create_notification_delivery",
            side_effect=[101, 102],
        ) as create_delivery, patch(
            "src.notifications._send_device_notification",
            return_value=ProviderResult(status="sent"),
        ), patch(
            "src.notifications.access_event_store.update_notification_delivery"
        ):
            send_access_event_notifications(55)

        get_devices.assert_has_calls([call(42), call(43)])
        create_delivery.assert_has_calls(
            [
                call(access_event_id=55, user_id=42, notification_device_id=1),
                call(access_event_id=55, user_id=43, notification_device_id=2),
            ]
        )

    def test_test_notification_reports_provider_results(self):
        devices = [
            {
                "id": 1,
                "push_token": "apns-token",
                "provider": "apns",
                "platform": "ios",
                "environment": "sandbox",
            },
            {
                "id": 2,
                "push_token": "fcm-token",
                "provider": "fcm",
                "platform": "android",
                "environment": None,
            },
        ]

        with patch(
            "src.notifications.access_event_store.get_active_notification_devices",
            return_value=devices,
        ), patch(
            "src.notifications._send_device_notification",
            side_effect=[
                ProviderResult(status="sent", provider_message_id="apns-id"),
                ProviderResult(
                    status="error",
                    error="FCM 404: UNREGISTERED",
                    deactivate_device=True,
                ),
            ],
        ) as send_device, patch(
            "src.notifications.access_event_store.deactivate_notification_device"
        ) as deactivate_device:
            result = send_test_notification(42)

        self.assertTrue(result["sent"])
        self.assertEqual(send_device.call_count, 2)
        self.assertEqual(result["results"][0]["status"], "sent")
        self.assertEqual(result["results"][0]["provider_message_id"], "apns-id")
        self.assertEqual(result["results"][1]["status"], "error")
        self.assertEqual(result["results"][1]["error"], "FCM 404: UNREGISTERED")
        deactivate_device.assert_called_once_with("fcm-token")

    def test_apns_sender_posts_directly_to_apple(self):
        posted = {}

        class FakeHttpClient:
            def __init__(self, http2, timeout):
                posted["http2"] = http2
                posted["timeout"] = timeout

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return None

            def post(self, url, headers, json):
                posted["url"] = url
                posted["headers"] = headers
                posted["json"] = json
                return SimpleNamespace(
                    status_code=200,
                    headers={"apns-id": "apple-message-id"},
                )

        with patch.dict(
            "os.environ",
            {
                "APNS_TEAM_ID": "TEAM123",
                "APNS_KEY_ID": "KEY123",
                "APNS_TOPIC": "com.example.anlok",
                "APNS_PRIVATE_KEY": "private-key",
            },
            clear=True,
        ), patch("jwt.encode", return_value="signed-jwt"), patch(
            "httpx.Client", FakeHttpClient
        ):
            result = _send_apns(
                {
                    "push_token": "apns-device-token",
                    "provider": "apns",
                    "environment": "sandbox",
                },
                "Door access event",
                "The door opened.",
                {"type": "access_event", "access_event_id": "7"},
            )

        self.assertEqual(result.status, "sent")
        self.assertEqual(result.provider_message_id, "apple-message-id")
        self.assertTrue(posted["http2"])
        self.assertEqual(
            posted["url"],
            "https://api.sandbox.push.apple.com/3/device/apns-device-token",
        )
        self.assertEqual(posted["headers"]["authorization"], "bearer signed-jwt")
        self.assertEqual(posted["headers"]["apns-topic"], "com.example.anlok")
        self.assertEqual(posted["headers"]["apns-push-type"], "alert")
        self.assertEqual(posted["json"]["aps"]["alert"]["title"], "Door access event")

    def test_fcm_sender_posts_directly_to_fcm_http_v1(self):
        posted = {}
        credentials = SimpleNamespace(token="google-oauth-token")

        def fake_post(url, headers, json, timeout):
            posted["url"] = url
            posted["headers"] = headers
            posted["json"] = json
            posted["timeout"] = timeout
            return SimpleNamespace(
                status_code=200,
                json=lambda: {"name": "projects/anlok/messages/123"},
            )

        with patch(
            "src.notifications._fcm_credentials",
            return_value=(credentials, "firebase-project"),
        ), patch("httpx.post", side_effect=fake_post):
            result = _send_fcm(
                {"push_token": "fcm-device-token", "provider": "fcm"},
                "Door access event",
                "The door opened.",
                {"type": "access_event", "access_event_id": "7"},
            )

        self.assertEqual(result.status, "sent")
        self.assertEqual(result.provider_message_id, "projects/anlok/messages/123")
        self.assertEqual(
            posted["url"],
            "https://fcm.googleapis.com/v1/projects/firebase-project/messages:send",
        )
        self.assertEqual(
            posted["headers"]["Authorization"], "Bearer google-oauth-token"
        )
        self.assertEqual(posted["json"]["message"]["token"], "fcm-device-token")
        self.assertEqual(
            posted["json"]["message"]["android"]["notification"]["channel_id"],
            "door-activity",
        )


if __name__ == "__main__":
    unittest.main()
