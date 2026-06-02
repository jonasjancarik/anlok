import json
import os
import time
from dataclasses import dataclass
from typing import Optional

import src.access_event_store as access_event_store
from src.logger import logger

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"


@dataclass
class ProviderResult:
    status: str
    provider_message_id: Optional[str] = None
    error: Optional[str] = None
    deactivate_device: bool = False


def _event_title(event):
    if event["method"] == "pin":
        return "PIN used" if event["outcome"] == "granted" else "PIN access denied"
    if event["method"] == "rfid":
        return (
            "RFID tag used"
            if event["outcome"] == "granted"
            else "RFID access denied"
        )
    if event["method"] == "remote_unlock":
        return "Remote unlock used"
    return "Door access event"


def _event_body(event):
    credential_label = event.get("credential_label")
    method = event["method"].replace("_", " ")
    outcome = event["outcome"]
    reason = event.get("reason")
    metadata = event.get("metadata") or {}

    if event["method"] == "remote_unlock":
        return "The door was unlocked from the app."

    subject = (
        "A shared PIN"
        if metadata.get("shared_pin_match")
        else credential_label or f"Your {method}"
    )
    if outcome == "granted":
        return f"{subject} unlocked the door."
    if reason:
        return f"{subject} was used but access was denied: {reason.replace('_', ' ')}."
    return f"{subject} was used but access was denied."


def _notification_user_ids(event):
    user_ids = []
    if event.get("user_id"):
        user_ids.append(event["user_id"])

    metadata = event.get("metadata") or {}
    for user_id in metadata.get("matched_user_ids", []):
        if user_id:
            user_ids.append(user_id)

    return list(dict.fromkeys(user_ids))


def _notification_data(event, access_event_id):
    return {
        "type": "access_event",
        "access_event_id": str(access_event_id),
        "method": event["method"],
        "outcome": event["outcome"],
    }


def _read_env_file_or_value(file_key, value_key):
    value = os.getenv(value_key)
    if value:
        return value.replace("\\n", "\n")

    file_path = os.getenv(file_key)
    if not file_path:
        return None
    with open(file_path, "r", encoding="utf-8") as key_file:
        return key_file.read()


def _json_or_file(json_key, file_key):
    value = os.getenv(json_key)
    if value:
        return json.loads(value)

    file_path = os.getenv(file_key)
    if not file_path:
        return None
    with open(file_path, "r", encoding="utf-8") as json_file:
        return json.load(json_file)


def _send_apns(device, title, body, data):
    team_id = os.getenv("APNS_TEAM_ID")
    key_id = os.getenv("APNS_KEY_ID")
    topic = os.getenv("APNS_TOPIC")
    try:
        private_key = _read_env_file_or_value("APNS_KEY_FILE", "APNS_PRIVATE_KEY")
    except OSError as error:
        return ProviderResult(status="error", error=f"Failed to read APNs key: {error}")
    environment = device.get("environment") or os.getenv(
        "APNS_DEFAULT_ENVIRONMENT", "production"
    )

    missing = [
        key
        for key, value in {
            "APNS_TEAM_ID": team_id,
            "APNS_KEY_ID": key_id,
            "APNS_TOPIC": topic,
            "APNS_KEY_FILE or APNS_PRIVATE_KEY": private_key,
        }.items()
        if not value
    ]
    if missing:
        return ProviderResult(
            status="error",
            error=f"APNs is not configured; missing {', '.join(missing)}",
        )

    try:
        import httpx
        import jwt
    except ImportError as error:
        return ProviderResult(status="error", error=f"Missing APNs dependency: {error}")

    host = (
        "api.sandbox.push.apple.com"
        if environment == "sandbox"
        else "api.push.apple.com"
    )
    auth_token = jwt.encode(
        {"iss": team_id, "iat": int(time.time())},
        private_key,
        algorithm="ES256",
        headers={"kid": key_id},
    )
    payload = {
        "aps": {
            "alert": {"title": title, "body": body},
            "sound": "default",
        },
        "data": data,
    }
    headers = {
        "authorization": f"bearer {auth_token}",
        "apns-topic": topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
    }

    try:
        with httpx.Client(http2=True, timeout=10) as client:
            response = client.post(
                f"https://{host}/3/device/{device['push_token']}",
                headers=headers,
                json=payload,
            )
    except Exception as error:
        return ProviderResult(status="error", error=str(error))

    if response.status_code == 200:
        return ProviderResult(
            status="sent",
            provider_message_id=response.headers.get("apns-id"),
        )

    reason = None
    try:
        reason = response.json().get("reason")
    except json.JSONDecodeError:
        reason = response.text

    return ProviderResult(
        status="error",
        provider_message_id=response.headers.get("apns-id"),
        error=f"APNs {response.status_code}: {reason}",
        deactivate_device=reason == "Unregistered",
    )


def _fcm_credentials():
    try:
        import google.auth
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account
    except ImportError as error:
        raise RuntimeError(f"Missing FCM dependency: {error}") from error

    service_account_info = _json_or_file(
        "FCM_SERVICE_ACCOUNT_JSON", "FCM_SERVICE_ACCOUNT_FILE"
    )
    if service_account_info:
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info, scopes=[FCM_SCOPE]
        )
        project_id = os.getenv("FCM_PROJECT_ID") or service_account_info.get(
            "project_id"
        )
    elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("FCM_USE_ADC"):
        credentials, project_id = google.auth.default(scopes=[FCM_SCOPE])
        project_id = os.getenv("FCM_PROJECT_ID") or project_id
    else:
        raise RuntimeError(
            "FCM is not configured; missing FCM_SERVICE_ACCOUNT_FILE "
            "or FCM_SERVICE_ACCOUNT_JSON"
        )

    if not project_id:
        raise RuntimeError("FCM is not configured; missing FCM_PROJECT_ID")

    credentials.refresh(Request())
    return credentials, project_id


def _fcm_error_code(error_json):
    error = error_json.get("error") or {}
    for detail in error.get("details") or []:
        code = detail.get("errorCode")
        if code:
            return code
    return error.get("status") or error.get("message")


def _send_fcm(device, title, body, data):
    try:
        import httpx
    except ImportError as error:
        return ProviderResult(status="error", error=f"Missing FCM dependency: {error}")

    try:
        credentials, project_id = _fcm_credentials()
    except Exception as error:
        return ProviderResult(status="error", error=str(error))

    message_data = {key: str(value) for key, value in data.items()}
    payload = {
        "message": {
            "token": device["push_token"],
            "notification": {"title": title, "body": body},
            "data": message_data,
            "android": {
                "notification": {
                    "channel_id": "door-activity",
                    "sound": "default",
                }
            },
        }
    }
    headers = {"Authorization": f"Bearer {credentials.token}"}

    try:
        response = httpx.post(
            f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
            headers=headers,
            json=payload,
            timeout=10,
        )
    except Exception as error:
        return ProviderResult(status="error", error=str(error))

    if response.status_code == 200:
        response_data = response.json()
        return ProviderResult(
            status="sent", provider_message_id=response_data.get("name")
        )

    try:
        error_json = response.json()
    except json.JSONDecodeError:
        error_json = {"error": {"message": response.text}}
    error_code = _fcm_error_code(error_json)
    return ProviderResult(
        status="error",
        error=f"FCM {response.status_code}: {error_code}",
        deactivate_device=error_code == "UNREGISTERED",
    )


def _send_device_notification(device, title, body, data):
    provider = device.get("provider")
    if provider == "apns":
        return _send_apns(device, title, body, data)
    if provider == "fcm":
        return _send_fcm(device, title, body, data)
    return ProviderResult(status="error", error=f"Unsupported provider: {provider}")


def send_test_notification(user_id):
    devices = access_event_store.get_active_notification_devices(user_id)
    results = []

    for device in devices:
        result = _send_device_notification(
            device,
            "Anlok notification test",
            "Notifications are configured for this device.",
            {"type": "notification_test"},
        )
        if result.status != "sent":
            logger.error(
                "Failed to send %s test notification to user %s: %s",
                device.get("provider"),
                user_id,
                result.error,
            )
        if result.deactivate_device:
            access_event_store.deactivate_notification_device(device["push_token"])
        results.append(
            {
                "notification_device_id": device["id"],
                "provider": device["provider"],
                "platform": device.get("platform"),
                "environment": device.get("environment"),
                "status": result.status,
                "provider_message_id": result.provider_message_id,
                "error": result.error,
            }
        )

    return {
        "sent": any(result["status"] == "sent" for result in results),
        "results": results,
    }


def send_access_event_notifications(access_event_id):
    event = access_event_store.get_access_event_summary(access_event_id)
    if not event:
        return

    user_ids = _notification_user_ids(event)
    if not user_ids:
        return

    title = _event_title(event)
    body = _event_body(event)
    data = _notification_data(event, access_event_id)

    for user_id in user_ids:
        devices = access_event_store.get_active_notification_devices(user_id)
        for device in devices:
            delivery_id = access_event_store.create_notification_delivery(
                access_event_id=access_event_id,
                user_id=user_id,
                notification_device_id=device["id"],
            )
            result = _send_device_notification(device, title, body, data)
            if result.status != "sent":
                logger.error(
                    "Failed to send %s notification for access event %s: %s",
                    device.get("provider"),
                    access_event_id,
                    result.error,
                )
            access_event_store.update_notification_delivery(
                delivery_id,
                result.status,
                result.provider_message_id,
                result.error,
            )
            if result.deactivate_device:
                access_event_store.deactivate_notification_device(device["push_token"])
