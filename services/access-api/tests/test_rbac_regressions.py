import asyncio
import datetime
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

import src.utils as utils
from src import access_control
from src.api.exceptions import APIException
from src.api.models import ApartmentResponse, PINCreate, RFIDCreate, User, UserUpdate
from src.api.permissions import Permission, require_permission
from src.api import pin_policy
from src.api.routes import doors as doors_routes
from src.api.routes import guests as guests_routes
from src.api.routes import pins as pins_routes
from src.api.routes import rfids as rfids_routes
from src.api.routes import users as users_routes
from src.reader import reader as reader_module


def make_user(user_id: int, role: str, apartment_id: int = 1) -> User:
    return User(
        id=user_id,
        name=f"user-{user_id}",
        email=f"user-{user_id}@example.com",
        role=role,
        apartment_id=apartment_id,
        apartment=ApartmentResponse(
            id=apartment_id, number=str(apartment_id), description=None
        ),
    )


class RBACRegressionTests(unittest.TestCase):
    def test_require_permission_supports_async_functions(self):
        @require_permission(Permission.LOGS_VIEW)
        async def protected_endpoint(current_user: User):
            return "ok"

        result = asyncio.run(protected_endpoint(current_user=make_user(1, "admin")))
        self.assertEqual(result, "ok")

    def test_require_permission_denies_async_without_permission(self):
        @require_permission(Permission.LOGS_VIEW)
        async def protected_endpoint(current_user: User):
            return "ok"

        with self.assertRaises(HTTPException) as exc:
            asyncio.run(protected_endpoint(current_user=make_user(2, "user")))

        self.assertEqual(exc.exception.status_code, 403)

    def test_user_cannot_escalate_own_role_via_update_user(self):
        current_user = make_user(7, "user")
        target_user = SimpleNamespace(
            id=7,
            role="user",
            apartment=SimpleNamespace(number="1"),
            apartment_id=1,
            is_active=True,
        )

        with patch("src.api.routes.users.db.get_user", return_value=target_user):
            with self.assertRaises(APIException) as exc:
                users_routes.update_user(
                    user_id=7,
                    updated_user=UserUpdate(role="admin"),
                    current_user=current_user,
                )

        self.assertEqual(exc.exception.status_code, 403)
        self.assertIn("cannot change their role", exc.exception.detail.lower())

    def test_list_user_pins_and_rfids_are_sanitized(self):
        current_user = make_user(1, "admin")
        target_user = SimpleNamespace(id=2, apartment_id=1)
        created_at = datetime.datetime(2025, 6, 2, 12, 0, 0)
        pin = SimpleNamespace(
            id=11,
            label="front-door",
            created_at=created_at,
            hashed_pin="secret-hash",
            salt="secret-salt",
        )
        rfid = SimpleNamespace(
            id=22,
            label="tag-1",
            created_at=created_at,
            last_four_digits="1234",
            hashed_uuid="secret-hash",
            salt="secret-salt",
        )

        with patch("src.api.routes.users.db.get_user", return_value=target_user):
            with patch("src.api.routes.users.db.get_user_pins", return_value=[pin]):
                with patch(
                    "src.api.routes.users.db.get_user_rfids", return_value=[rfid]
                ):
                    pin_result = users_routes.list_user_pins(
                        current_user=current_user, user_id=2
                    )
                    rfid_result = users_routes.list_user_rfids(
                        current_user=current_user, user_id=2
                    )

        self.assertEqual(
            set(pin_result[0].keys()),
            {"id", "label", "created_at"},
        )
        self.assertEqual(
            set(rfid_result[0].keys()),
            {"id", "label", "created_at", "last_four_digits"},
        )

    def test_user_can_create_own_pin_with_explicit_user_id(self):
        current_user = make_user(5, "user")
        saved_pin = SimpleNamespace(
            id=33,
            label="my-pin",
            created_at=datetime.datetime(2025, 6, 2, 12, 0, 0),
        )

        with patch("src.api.routes.pins.db.get_user", return_value=current_user):
            with patch("src.api.routes.pins.db.get_all_pins", return_value=[]):
                with patch("src.api.routes.pins.db.save_pin", return_value=saved_pin):
                    result = pins_routes.create_pin(
                        pin_request=PINCreate(pin="1234", label="my-pin", user_id=5),
                        current_user=current_user,
                    )

        self.assertEqual(result.user_id, 5)
        self.assertEqual(result.label, "my-pin")

    def test_global_uniqueness_mode_rejects_duplicate_custom_pin(self):
        current_user = make_user(5, "user")
        existing_pin = SimpleNamespace(
            id=77,
            user_id=8,
            salt="existing-salt",
            hashed_pin=utils.hash_secret("1234", "existing-salt"),
        )

        with patch.dict("os.environ", {"PIN_UNIQUENESS_MODE": "global"}):
            with patch("src.api.routes.pins.db.get_user", return_value=current_user):
                with patch(
                    "src.api.routes.pins.db.get_all_pins", return_value=[existing_pin]
                ):
                    with self.assertRaises(APIException) as exc:
                        pins_routes.create_pin(
                            pin_request=PINCreate(
                                pin="1234", label="my-pin", user_id=5
                            ),
                            current_user=current_user,
                        )

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, pin_policy.DUPLICATE_PIN_DETAIL)

    def test_scheduled_mode_allows_duplicate_for_unscheduled_users(self):
        current_user = make_user(5, "user")
        saved_pin = SimpleNamespace(
            id=33,
            label="my-pin",
            created_at=datetime.datetime(2025, 6, 2, 12, 0, 0),
        )
        existing_pin = SimpleNamespace(
            id=77,
            user_id=8,
            salt="existing-salt",
            hashed_pin=utils.hash_secret("1234", "existing-salt"),
        )

        with patch.dict("os.environ", {"PIN_UNIQUENESS_MODE": "scheduled"}):
            with patch("src.api.routes.pins.db.get_user", return_value=current_user):
                with patch(
                    "src.api.routes.pins.db.get_all_pins", return_value=[existing_pin]
                ), patch(
                    "src.api.routes.pins.db.user_has_schedules", return_value=False
                ), patch(
                    "src.api.routes.pins.db.save_pin", return_value=saved_pin
                ):
                    result = pins_routes.create_pin(
                        pin_request=PINCreate(pin="1234", label="my-pin", user_id=5),
                        current_user=current_user,
                    )

        self.assertEqual(result.user_id, 5)

    def test_scheduled_mode_rejects_duplicate_of_scheduled_user_pin(self):
        current_user = make_user(5, "user")
        existing_pin = SimpleNamespace(
            id=77,
            user_id=8,
            salt="existing-salt",
            hashed_pin=utils.hash_secret("1234", "existing-salt"),
        )

        def user_has_schedules(user_id):
            return user_id == 8

        with patch.dict("os.environ", {"PIN_UNIQUENESS_MODE": "scheduled"}):
            with patch("src.api.routes.pins.db.get_user", return_value=current_user):
                with patch(
                    "src.api.routes.pins.db.get_all_pins", return_value=[existing_pin]
                ), patch(
                    "src.api.routes.pins.db.user_has_schedules",
                    side_effect=user_has_schedules,
                ):
                    with self.assertRaises(APIException) as exc:
                        pins_routes.create_pin(
                            pin_request=PINCreate(
                                pin="1234", label="my-pin", user_id=5
                            ),
                            current_user=current_user,
                        )

        self.assertEqual(exc.exception.status_code, 400)

    def test_first_guest_schedule_resets_pins_and_returns_generated_pin(self):
        current_user = make_user(1, "admin")
        guest_user = SimpleNamespace(id=9, role="guest", apartment_id=1)
        saved_pin = SimpleNamespace(id=44)
        saved_schedule = SimpleNamespace(id=55)

        with patch("src.api.routes.guests.db.get_user", return_value=guest_user):
            with patch(
                "src.api.routes.guests.db.user_has_schedules", return_value=False
            ):
                with patch(
                    "src.api.routes.guests.pin_policy.reset_user_pins_for_scheduled_access",
                    return_value=(saved_pin, "2468"),
                ) as reset_pins:
                    with patch(
                        "src.api.routes.guests.db.add_recurring_schedule",
                        return_value=saved_schedule,
                    ):
                        result = guests_routes.create_recurring_schedule(
                            user_id=9,
                            schedule=guests_routes.RecurringScheduleCreate(
                                day_of_week=0,
                                start_time=datetime.time(9, 0),
                                end_time=datetime.time(17, 0),
                            ),
                            current_user=current_user,
                        )

        reset_pins.assert_called_once_with(9)
        self.assertEqual(result["schedule_id"], 55)
        self.assertEqual(result["pin"], "2468")

    def test_additional_guest_schedule_keeps_existing_generated_pin(self):
        current_user = make_user(1, "admin")
        guest_user = SimpleNamespace(id=9, role="guest", apartment_id=1)
        saved_schedule = SimpleNamespace(id=55)

        with patch("src.api.routes.guests.db.get_user", return_value=guest_user):
            with patch(
                "src.api.routes.guests.db.user_has_schedules", return_value=True
            ):
                with patch(
                    "src.api.routes.guests.pin_policy.reset_user_pins_for_scheduled_access"
                ) as reset_pins:
                    with patch(
                        "src.api.routes.guests.db.add_recurring_schedule",
                        return_value=saved_schedule,
                    ):
                        result = guests_routes.create_recurring_schedule(
                            user_id=9,
                            schedule=guests_routes.RecurringScheduleCreate(
                                day_of_week=0,
                                start_time=datetime.time(9, 0),
                                end_time=datetime.time(17, 0),
                            ),
                            current_user=current_user,
                        )

        reset_pins.assert_not_called()
        self.assertNotIn("pin", result)

    def test_reset_user_pins_for_scheduled_access_deletes_and_generates_pin(self):
        saved_pin = SimpleNamespace(id=44)

        with patch("src.api.pin_policy.random.choices", return_value=list("2468")):
            with patch("src.api.pin_policy.db.get_all_pins", return_value=[]):
                with patch("src.api.pin_policy.db.delete_pins_by_user") as delete_pins:
                    with patch(
                        "src.api.pin_policy.db.save_pin", return_value=saved_pin
                    ) as save_pin:
                        result = pin_policy.reset_user_pins_for_scheduled_access(9)

        delete_pins.assert_called_once_with(9)
        save_pin.assert_called_once()
        self.assertEqual(result, (saved_pin, "2468"))

    def test_guest_can_create_own_pin(self):
        current_user = make_user(9, "guest")
        saved_pin = SimpleNamespace(
            id=44,
            label="guest-pin",
            created_at=datetime.datetime(2025, 6, 2, 12, 0, 0),
        )

        with patch(
            "src.api.pin_policy.random.choices", return_value=list("1234")
        ), patch("src.api.routes.pins.db.get_all_pins", return_value=[]), patch(
            "src.api.routes.pins.db.save_pin", return_value=saved_pin
        ):
            result = pins_routes.create_pin(
                pin_request=PINCreate(label="guest-pin"),
                current_user=current_user,
            )

        self.assertEqual(result.user_id, 9)
        self.assertEqual(result.pin, "1234")

    def test_default_guest_pin_mode_rejects_custom_guest_pin(self):
        current_user = make_user(9, "guest")

        with patch.dict("os.environ", {"GUEST_PIN_MODE": "generated"}):
            with self.assertRaises(APIException) as exc:
                pins_routes.create_pin(
                    pin_request=PINCreate(pin="2468", label="guest-pin"),
                    current_user=current_user,
                )

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, pin_policy.GUEST_CUSTOM_PIN_DETAIL)

    def test_guest_custom_pin_mode_allows_unscheduled_guest_pin(self):
        current_user = make_user(9, "guest")
        saved_pin = SimpleNamespace(
            id=44,
            label="guest-pin",
            created_at=datetime.datetime(2025, 6, 2, 12, 0, 0),
        )

        with patch.dict("os.environ", {"GUEST_PIN_MODE": "custom_until_scheduled"}):
            with patch("src.api.routes.pins.db.user_has_schedules", return_value=False):
                with patch("src.api.routes.pins.db.get_all_pins", return_value=[]):
                    with patch(
                        "src.api.routes.pins.db.save_pin", return_value=saved_pin
                    ):
                        result = pins_routes.create_pin(
                            pin_request=PINCreate(pin="2468", label="guest-pin"),
                            current_user=current_user,
                        )

        self.assertEqual(result.user_id, 9)
        self.assertEqual(result.pin, "2468")

    def test_guest_custom_pin_mode_rejects_scheduled_guest_pin(self):
        current_user = make_user(9, "guest")

        with patch.dict("os.environ", {"GUEST_PIN_MODE": "custom_until_scheduled"}):
            with patch("src.api.routes.pins.db.user_has_schedules", return_value=True):
                with self.assertRaises(APIException) as exc:
                    pins_routes.create_pin(
                        pin_request=PINCreate(pin="2468", label="guest-pin"),
                        current_user=current_user,
                    )

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, pin_policy.GUEST_CUSTOM_PIN_DETAIL)

    def test_guest_can_create_own_rfid(self):
        current_user = SimpleNamespace(
            id=10,
            name="user-10",
            email="user-10@example.com",
            role="guest",
            apartment_id=1,
            apartment=SimpleNamespace(id=1, number="1", description=None),
            is_active=True,
        )
        saved_rfid = SimpleNamespace(
            id=55,
            label="guest-tag",
            created_at=datetime.datetime(2025, 6, 2, 12, 0, 0),
        )

        with patch("src.api.routes.rfids.db.save_rfid", return_value=saved_rfid):
            result = rfids_routes.create_rfid(
                rfid_request=RFIDCreate(uuid="a1b2c3d41234", label="guest-tag"),
                current_user=current_user,
            )

        self.assertEqual(result["rfid"].user_id, 10)
        self.assertEqual(result["rfid"].last_four_digits, "1234")

    def test_remote_unlock_records_actor_access_event(self):
        current_user = SimpleNamespace(
            id=12,
            role="user",
            apartment_id=4,
            is_active=True,
        )

        with patch(
            "src.access_control.record_access_event"
        ) as record_access_event, patch.object(
            access_control.door_manager,
            "unlock",
            new=AsyncMock(return_value={"message": "Door unlock initiated"}),
        ):
            result = asyncio.run(doors_routes.unlock_door(current_user=current_user))

        self.assertEqual(result["message"], "Door unlock initiated")
        record_access_event.assert_called_once_with(
            method="remote_unlock",
            outcome="granted",
            user_id=12,
            actor_user_id=12,
            apartment_id=4,
            source="app",
        )

    def test_inactive_remote_unlock_records_denied_event(self):
        current_user = SimpleNamespace(
            id=12,
            role="user",
            apartment_id=4,
            is_active=False,
        )

        with patch(
            "src.access_control.record_access_event"
        ) as record_access_event, patch.object(
            access_control.door_manager,
            "unlock",
            new=AsyncMock(),
        ) as unlock:
            with self.assertRaises(APIException) as exc:
                asyncio.run(doors_routes.unlock_door(current_user=current_user))

        self.assertEqual(exc.exception.status_code, 403)
        unlock.assert_not_called()
        record_access_event.assert_called_once_with(
            method="remote_unlock",
            outcome="denied",
            user_id=12,
            actor_user_id=12,
            apartment_id=4,
            reason="inactive_user",
            source="app",
        )

    def test_pin_reader_returns_structured_access_decision(self):
        pin = SimpleNamespace(
            id=23,
            salt="pin-salt",
            hashed_pin=utils.hash_secret("1234", "pin-salt"),
            label="Front door",
            user=SimpleNamespace(
                id=99,
                name="Resident",
                role="user",
                is_active=True,
                apartment_id=8,
            ),
        )

        with patch("src.reader.reader.get_all_pins", return_value=[pin]):
            with patch("src.reader.reader.get_all_rfids", return_value=[]):
                decision = reader_module.check_input("1234")

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.method, "pin")
        self.assertEqual(decision.outcome, "granted")
        self.assertEqual(decision.user_id, 99)
        self.assertEqual(decision.credential_id, 23)
        self.assertEqual(decision.apartment_id, 8)

    def test_pin_reader_records_shared_unscheduled_pin_matches(self):
        pins = [
            SimpleNamespace(
                id=23,
                salt="pin-salt-1",
                hashed_pin=utils.hash_secret("1234", "pin-salt-1"),
                label="Front door",
                user=SimpleNamespace(
                    id=99,
                    name="Resident 1",
                    role="user",
                    is_active=True,
                    apartment_id=8,
                ),
            ),
            SimpleNamespace(
                id=24,
                salt="pin-salt-2",
                hashed_pin=utils.hash_secret("1234", "pin-salt-2"),
                label="Side door",
                user=SimpleNamespace(
                    id=100,
                    name="Resident 2",
                    role="user",
                    is_active=True,
                    apartment_id=8,
                ),
            ),
        ]

        with patch("src.reader.reader.get_all_pins", return_value=pins):
            with patch("src.reader.reader.user_has_schedules", return_value=False):
                decision = reader_module.check_input("1234")

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.user_id, 99)
        self.assertTrue(decision.metadata["shared_pin_match"])
        self.assertEqual(decision.metadata["matched_user_ids"], [99, 100])
        self.assertEqual(len(decision.metadata["matched_credentials"]), 2)

    def test_pin_reader_denies_shared_pin_when_scheduled_access_matches(self):
        pins = [
            SimpleNamespace(
                id=23,
                salt="pin-salt-1",
                hashed_pin=utils.hash_secret("1234", "pin-salt-1"),
                label="Guest PIN",
                user=SimpleNamespace(
                    id=99,
                    name="Guest",
                    role="guest",
                    is_active=True,
                    apartment_id=8,
                ),
            ),
            SimpleNamespace(
                id=24,
                salt="pin-salt-2",
                hashed_pin=utils.hash_secret("1234", "pin-salt-2"),
                label="Resident PIN",
                user=SimpleNamespace(
                    id=100,
                    name="Resident",
                    role="user",
                    is_active=True,
                    apartment_id=8,
                ),
            ),
        ]

        def user_has_schedules(user_id):
            return user_id == 99

        with patch("src.reader.reader.get_all_pins", return_value=pins):
            with patch("src.reader.reader.is_user_allowed_access", return_value=True):
                with patch(
                    "src.reader.reader.user_has_schedules",
                    side_effect=user_has_schedules,
                ):
                    decision = reader_module.check_input("1234")

        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "ambiguous_scheduled_pin")
        self.assertTrue(decision.metadata["shared_pin_match"])
        self.assertEqual(decision.metadata["matched_user_ids"], [99, 100])


if __name__ == "__main__":
    unittest.main()
