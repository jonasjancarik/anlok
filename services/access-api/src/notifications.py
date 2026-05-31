import json
import os
import urllib.error
import urllib.request

import src.access_event_store as access_event_store
from src.logger import logger

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


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

    if event["method"] == "remote_unlock":
        return "The door was unlocked from the app."

    subject = credential_label or f"Your {method}"
    if outcome == "granted":
        return f"{subject} unlocked the door."
    if reason:
        return f"{subject} was used but access was denied: {reason.replace('_', ' ')}."
    return f"{subject} was used but access was denied."


def _send_expo_messages(messages):
    headers = {"Content-Type": "application/json"}
    access_token = os.getenv("EXPO_PUSH_ACCESS_TOKEN")
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def send_access_event_notifications(access_event_id):
    event = access_event_store.get_access_event_summary(access_event_id)
    if not event or not event.get("user_id"):
        return

    devices = access_event_store.get_active_notification_devices(event["user_id"])
    if not devices:
        return

    messages = []
    delivery_ids = []
    for device in devices:
        delivery_id = access_event_store.create_notification_delivery(
            access_event_id=access_event_id,
            user_id=event["user_id"],
            notification_device_id=device["id"],
        )
        delivery_ids.append((delivery_id, device["expo_push_token"]))
        messages.append(
            {
                "to": device["expo_push_token"],
                "sound": "default",
                "title": _event_title(event),
                "body": _event_body(event),
                "data": {
                    "type": "access_event",
                    "access_event_id": access_event_id,
                    "method": event["method"],
                    "outcome": event["outcome"],
                },
            }
        )

    try:
        response = _send_expo_messages(messages)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        logger.error("Failed to send access event notifications: %s", error)
        for delivery_id, _token in delivery_ids:
            access_event_store.update_notification_delivery(
                delivery_id, "error", error=str(error)
            )
        return

    tickets = response.get("data", [])
    if isinstance(tickets, dict):
        tickets = [tickets]

    for index, (delivery_id, token) in enumerate(delivery_ids):
        ticket = tickets[index] if index < len(tickets) else {}
        status = ticket.get("status")
        ticket_id = ticket.get("id")
        details = ticket.get("details") or {}
        error = details.get("error") or ticket.get("message")

        if status == "ok":
            access_event_store.update_notification_delivery(
                delivery_id, "sent", ticket_id, None
            )
        else:
            access_event_store.update_notification_delivery(
                delivery_id, "error", ticket_id, error
            )
            if error == "DeviceNotRegistered":
                access_event_store.deactivate_notification_device(token)
