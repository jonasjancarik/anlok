import RPi.GPIO as GPIO
from dotenv import load_dotenv
import os
import sys
from src.logger import logger
import hashlib
import secrets
import asyncio

load_dotenv()


def read_env(name, default=None, legacy_name=None):
    value = os.getenv(name)
    if value is not None:
        return value

    if legacy_name:
        legacy_value = os.getenv(legacy_name)
        if legacy_value is not None:
            logger.warning("%s is deprecated; use %s instead.", legacy_name, name)
            return legacy_value

    return default


def read_int_env(name, default, legacy_name=None):
    value = read_env(name, default, legacy_name)
    try:
        return int(value)
    except (TypeError, ValueError):
        legacy_hint = f" or {legacy_name}" if legacy_name else ""
        raise ValueError(f"{name}{legacy_hint} must be an integer")


def read_choice_env(name, default, choices, legacy_name=None):
    value = str(read_env(name, default, legacy_name)).strip().upper()
    if value not in choices:
        legacy_hint = f" or {legacy_name}" if legacy_name else ""
        raise ValueError(f"{name}{legacy_hint} must be one of: {', '.join(choices)}")
    return value


# config
try:
    RELAY_PIN = read_int_env("RELAY_PIN", 18, legacy_name="RELAY_GPIO")
except ValueError as e:
    sys.exit(str(e))

RELAY_ACTIVATION_TIME = read_int_env("RELAY_ACTIVATION_TIME", 5)  # seconds

RELAY_ACTIVE_STATE_NAME = read_choice_env(
    "RELAY_ACTIVE_STATE",
    "HIGH",
    {"HIGH", "LOW"},
    legacy_name="GPIO_ACTIVE",
)

RELAY_ACTIVE_STATE = GPIO.HIGH if RELAY_ACTIVE_STATE_NAME == "HIGH" else GPIO.LOW

# GPIO setup
try:
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(RELAY_PIN, GPIO.OUT)
    GPIO.output(RELAY_PIN, not RELAY_ACTIVE_STATE)  # deactivate first
    GPIO.cleanup()  # cleanup to avoid issues with previous runs
except Exception as e:
    print(f"Error setting up GPIO: {e}")
    if "Cannot determine SOC peripheral base address" in str(e):
        sys.exit(
            "rpi-gpio is not supported on this hardware. If you are on a Raspberry PI 5, run pip uninstall rpi-gpio; pip install rpi-lgpio"
        )


async def unlock_door(duration=RELAY_ACTIVATION_TIME):
    try:
        logger.info(f"Activating relay. (PID: {os.getpid()})")
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(RELAY_PIN, GPIO.OUT)
        GPIO.output(RELAY_PIN, RELAY_ACTIVE_STATE)

        # Create a task for the timer
        await asyncio.sleep(duration)

        # Deactivate after duration
        GPIO.output(RELAY_PIN, not RELAY_ACTIVE_STATE)
        GPIO.cleanup()
        logger.info(f"Relay deactivated. (PID: {os.getpid()})")
    except Exception as e:
        logger.error(f"Error in unlock_door: {e}")
        # Ensure we cleanup GPIO even if there's an error
        try:
            GPIO.output(RELAY_PIN, not RELAY_ACTIVE_STATE)
            GPIO.cleanup()
        except:  # noqa: E722
            pass
        raise


def generate_salt(length=16):
    return secrets.token_hex(length)


def hash_secret(payload, salt=None):
    """
    Hashes the given payload using SHA-512.

    Args:
        payload (str): The payload to be hashed.
        salt (bytes or str, optional): The salt to be used. If not provided, no salt will be used.

    Returns:
        str: The SHA-512 hash of the payload as a hexadecimal string.
            If a salt was used, it's prepended to the hash.

    Raises:
        ValueError: If payload is not provided.
    """
    if not payload:
        raise ValueError("Payload must be provided.")

    # Convert salt to bytes if it's a string
    if isinstance(salt, str):
        salt = salt.encode("utf-8")

    # Create SHA-512 hash
    sha512 = hashlib.sha512()

    if salt:
        sha512.update(salt)
        sha512.update(payload.encode("utf-8"))
        return salt.hex() + sha512.hexdigest()
    else:
        sha512.update(payload.encode("utf-8"))
        return sha512.hexdigest()
