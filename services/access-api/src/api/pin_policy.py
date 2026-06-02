import os
import random

from .exceptions import APIException
import src.db as db
import src.utils as utils

PIN_UNIQUENESS_MODES = {"global", "scheduled", "off"}
GUEST_PIN_MODES = {"generated", "custom_until_scheduled"}
DEFAULT_PIN_UNIQUENESS_MODE = "scheduled"
DEFAULT_GUEST_PIN_MODE = "generated"
DUPLICATE_PIN_DETAIL = "PIN cannot be saved. Choose a different PIN."
GUEST_CUSTOM_PIN_DETAIL = "Guest PINs must be automatically generated"
SCHEDULED_PIN_LABEL = "Scheduled access PIN"


def get_pin_uniqueness_mode():
    mode = os.getenv("PIN_UNIQUENESS_MODE", DEFAULT_PIN_UNIQUENESS_MODE)
    normalized = mode.strip().lower()
    if normalized not in PIN_UNIQUENESS_MODES:
        choices = ", ".join(sorted(PIN_UNIQUENESS_MODES))
        raise ValueError(f"PIN_UNIQUENESS_MODE must be one of: {choices}")
    return normalized


def get_guest_pin_mode():
    mode = os.getenv("GUEST_PIN_MODE", DEFAULT_GUEST_PIN_MODE)
    normalized = mode.strip().lower()
    if normalized not in GUEST_PIN_MODES:
        choices = ", ".join(sorted(GUEST_PIN_MODES))
        raise ValueError(f"GUEST_PIN_MODE must be one of: {choices}")
    return normalized


def get_pin_length():
    value = os.getenv("PIN_LENGTH", "4")
    try:
        pin_length = int(value)
    except (TypeError, ValueError):
        raise ValueError("PIN_LENGTH must be an integer")
    if pin_length <= 0:
        raise ValueError("PIN_LENGTH must be greater than zero")
    return pin_length


def pin_matches(candidate_pin, stored_pin):
    return utils.hash_secret(candidate_pin, stored_pin.salt) == stored_pin.hashed_pin


def find_matching_pins(candidate_pin, exclude_pin_id=None):
    matches = []
    for existing_pin in db.get_all_pins():
        if exclude_pin_id is not None and existing_pin.id == exclude_pin_id:
            continue
        if pin_matches(candidate_pin, existing_pin):
            matches.append(existing_pin)
    return matches


def _pin_user_id(pin):
    return getattr(pin, "user_id", None) or getattr(
        getattr(pin, "user", None), "id", None
    )


def pin_conflicts_with_policy(candidate_pin, target_user_id, exclude_pin_id=None):
    matches = find_matching_pins(candidate_pin, exclude_pin_id=exclude_pin_id)
    if not matches:
        return False

    mode = get_pin_uniqueness_mode()
    if mode == "global":
        return True

    if db.user_has_schedules(target_user_id):
        return True

    return any(db.user_has_schedules(_pin_user_id(match)) for match in matches)


def enforce_pin_uniqueness(candidate_pin, target_user_id, exclude_pin_id=None):
    if pin_conflicts_with_policy(
        candidate_pin, target_user_id, exclude_pin_id=exclude_pin_id
    ):
        raise APIException(status_code=400, detail=DUPLICATE_PIN_DETAIL)


def guest_can_use_custom_pin(user_id):
    return (
        get_guest_pin_mode() == "custom_until_scheduled"
        and not db.user_has_schedules(user_id)
    )


def enforce_guest_custom_pin_allowed(user_id):
    if not guest_can_use_custom_pin(user_id):
        raise APIException(status_code=400, detail=GUEST_CUSTOM_PIN_DETAIL)


def generate_unique_pin():
    pin_length = get_pin_length()
    max_attempts = 10 ** pin_length

    for _ in range(max_attempts):
        pin = "".join(random.choices("0123456789", k=pin_length))
        if not find_matching_pins(pin):
            return pin

    raise APIException(
        status_code=500,
        detail="Could not generate a unique PIN. Increase PIN_LENGTH or remove old PINs.",
    )


def save_generated_pin(user_id, label=SCHEDULED_PIN_LABEL):
    pin = generate_unique_pin()
    salt = utils.generate_salt()
    saved_pin = db.save_pin(user_id, utils.hash_secret(pin, salt), label, salt)
    return saved_pin, pin


def reset_user_pins_for_scheduled_access(user_id):
    db.delete_pins_by_user(user_id)
    return save_generated_pin(user_id)
