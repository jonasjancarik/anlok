import asyncio
import datetime
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

import src.utils as utils
from src.api.exceptions import APIException
from src.api.models import ApartmentResponse, PINCreate, RFIDCreate, User, UserUpdate
from src.api.permissions import Permission, require_permission
from src.api.routes import doors as doors_routes
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
                with patch("src.api.routes.users.db.get_user_rfids", return_value=[rfid]):
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
            with patch("src.api.routes.pins.db.save_pin", return_value=saved_pin):
                result = pins_routes.create_pin(
                    pin_request=PINCreate(pin="1234", label="my-pin", user_id=5),
                    current_user=current_user,
                )

        self.assertEqual(result.user_id, 5)
        self.assertEqual(result.label, "my-pin")

    def test_guest_can_create_own_pin(self):
        current_user = make_user(9, "guest")
        saved_pin = SimpleNamespace(
            id=44,
            label="guest-pin",
            created_at=datetime.datetime(2025, 6, 2, 12, 0, 0),
        )

        with patch(
            "src.api.routes.pins.random.choices", return_value=list("1234")
        ), patch("src.api.routes.pins.db.get_all_pins", return_value=[]), patch(
            "src.api.routes.pins.db.save_pin", return_value=saved_pin
        ):
            result = pins_routes.create_pin(
                pin_request=PINCreate(label="guest-pin"),
                current_user=current_user,
            )

        self.assertEqual(result.user_id, 9)
        self.assertEqual(result.pin, "1234")

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
            "src.api.routes.doors.record_access_event"
        ) as record_access_event, patch.object(
            doors_routes.door_manager,
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
            "src.api.routes.doors.record_access_event"
        ) as record_access_event, patch.object(
            doors_routes.door_manager,
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


if __name__ == "__main__":
    unittest.main()
