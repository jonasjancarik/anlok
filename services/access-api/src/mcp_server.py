"""Role-aware MCP tool server backed by Anlok's existing REST authorization logic."""

from datetime import date, time
from urllib.parse import urlparse

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import AnyHttpUrl, BaseModel

import src.access_event_store as access_event_store
import src.db as db
from src.access_control import unlock_for_user
from src.api.exceptions import APIException
from src.api.models import (
    ApartmentCreate,
    ApartmentNumberUpdate,
    ApartmentUpdate,
    OneTimeAccessCreate,
    PINCreate,
    PINUpdate,
    RFIDCreate,
    RecurringScheduleCreate,
    UserCreate,
    UserUpdate,
)
from src.api.permissions import Permission, PermissionChecker
from src.api.routes.apartments import (
    create_apartment as rest_create_apartment,
    delete_apartment as rest_delete_apartment,
    list_apartments as rest_list_apartments,
    update_apartment as rest_update_apartment,
)
from src.api.routes.guests import (
    create_one_time_access as rest_create_one_time_access,
    create_recurring_schedule as rest_create_recurring_schedule,
    delete_one_time_access as rest_delete_one_time_access,
    delete_recurring_schedule as rest_delete_recurring_schedule,
    list_guest_schedules as rest_list_guest_schedules,
)
from src.api.routes.pins import (
    create_pin as rest_create_pin,
    delete_pin as rest_delete_pin,
    update_pin as rest_update_pin,
)
from src.api.routes.reader import (
    get_reader_status_endpoint as rest_reader_status,
    start_reader_endpoint as rest_start_reader,
    stop_reader_endpoint as rest_stop_reader,
)
from src.api.routes.rfids import (
    create_rfid as rest_create_rfid,
    delete_rfid as rest_delete_rfid,
)
from src.api.routes.users import (
    create_user as rest_create_user,
    delete_user as rest_delete_user,
    list_user_pins as rest_list_user_pins,
    list_user_rfids as rest_list_user_rfids,
    list_users as rest_list_users,
    update_user as rest_update_user,
)
from src.api.utils import build_user_response
from src.oauth_config import oauth_settings
from src.oauth_service import verify_access_token


READ_ONLY = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
)
CREATE = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=False,
)
UPDATE = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=True,
    idempotentHint=False,
    openWorldHint=False,
)
DELETE = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=True,
    idempotentHint=False,
    openWorldHint=False,
)
PHYSICAL_ACTION = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=True,
    idempotentHint=False,
    openWorldHint=False,
)


class AnlokTokenVerifier:
    async def verify_token(self, token: str) -> AccessToken | None:
        verified = verify_access_token(token)
        if not verified:
            return None
        return AccessToken(
            token=token,
            client_id=verified["client_id"],
            scopes=verified["scopes"],
            expires_at=verified["expires_at"],
            resource=verified["resource"],
            subject=str(verified["user_id"]),
            claims={"role": verified["role"]},
        )


ROLE_TOOLS = {
    "admin": None,
    "apartment_admin": {
        "get_profile",
        "get_user",
        "list_users",
        "create_user",
        "update_user",
        "delete_user",
        "list_apartments",
        "list_access_events",
        "unlock_door",
        "list_pins",
        "create_pin",
        "update_pin",
        "delete_pin",
        "list_rfids",
        "create_rfid",
        "delete_rfid",
        "list_guest_schedules",
        "create_recurring_schedule",
        "create_one_time_access",
        "delete_recurring_schedule",
        "delete_one_time_access",
    },
    "user": {
        "get_profile",
        "get_user",
        "list_apartments",
        "list_access_events",
        "unlock_door",
        "list_pins",
        "create_pin",
        "update_pin",
        "delete_pin",
        "list_rfids",
        "create_rfid",
        "delete_rfid",
    },
    "guest": {
        "get_profile",
        "get_user",
        "list_apartments",
        "list_access_events",
        "unlock_door",
        "list_pins",
        "create_pin",
        "delete_pin",
        "list_rfids",
        "create_rfid",
        "delete_rfid",
        "list_guest_schedules",
    },
}


class RoleAwareFastMCP(FastMCP):
    async def list_tools(self):
        tools = await super().list_tools()
        access_token = get_access_token()
        role = (
            access_token.claims.get("role")
            if access_token and access_token.claims
            else None
        )
        allowed = ROLE_TOOLS.get(role, set())
        if allowed is None:
            return tools
        return [tool for tool in tools if tool.name in allowed]


def _transport_security() -> TransportSecuritySettings:
    parsed_resource = urlparse(oauth_settings.resource_url)
    parsed_web = urlparse(oauth_settings.web_url)
    hosts = [parsed_resource.netloc]
    origins = [f"{parsed_web.scheme}://{parsed_web.netloc}"]
    if parsed_resource.hostname in {"localhost", "127.0.0.1", "::1"}:
        hosts.extend(["testserver", "localhost:*", "127.0.0.1:*", "[::1]:*"])
        origins.extend(["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"])
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=hosts,
        allowed_origins=origins,
    )


mcp = RoleAwareFastMCP(
    "Anlok",
    instructions=(
        "Manage only the building access data permitted to the signed-in Anlok user. "
        "Before any physical action or data change, explain the effect and obtain the "
        "user's confirmation; then pass confirm=true."
    ),
    website_url=oauth_settings.web_url,
    token_verifier=AnlokTokenVerifier(),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(oauth_settings.issuer_url),
        resource_server_url=AnyHttpUrl(oauth_settings.resource_url),
        required_scopes=[oauth_settings.scope],
    ),
    streamable_http_path="/mcp",
    json_response=True,
    stateless_http=True,
    transport_security=_transport_security(),
)


def _current_user():
    token = get_access_token()
    if not token or not token.subject:
        raise APIException(status_code=401, detail="MCP authentication is required")
    user = db.get_user(int(token.subject))
    if not user or not user.is_active:
        raise APIException(
            status_code=401, detail="MCP authentication is no longer valid"
        )
    return user


def _require_confirmation(confirm: bool, action: str) -> None:
    if confirm is not True:
        raise ValueError(
            f"Confirmation required. Explain that this will {action}, obtain the user's "
            "approval, then call again with confirm=true."
        )


def _jsonable(value):
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, (date, time)):
        return value.isoformat()
    return value


@mcp.tool(
    description="Show the signed-in resident's identity, role, apartment, and active status.",
    annotations=READ_ONLY,
)
def get_profile() -> dict:
    return build_user_response(_current_user())


@mcp.tool(
    description="Show a user when the signed-in resident is allowed to see that user.",
    annotations=READ_ONLY,
)
def get_user(user_id: int) -> dict:
    current_user = _current_user()
    user = db.get_user(user_id)
    if not user:
        raise APIException(status_code=404, detail="User not found")
    if not PermissionChecker.can_access_user_resource(current_user, user_id, user):
        raise APIException(status_code=403, detail="Cannot access this user")
    return build_user_response(user)


@mcp.tool(
    description="List users in the signed-in administrator's permitted building scope.",
    annotations=READ_ONLY,
)
def list_users() -> list[dict]:
    return [_jsonable(item) for item in rest_list_users(current_user=_current_user())]


@mcp.tool(
    description="Create a user in an apartment the signed-in administrator manages.",
    annotations=CREATE,
)
def create_user(
    name: str,
    role: str,
    apartment_number: str,
    email: str | None = None,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, f"create the {role} user {name}")
    result = rest_create_user(
        new_user=UserCreate(
            name=name,
            email=email,
            role=role,
            apartment=ApartmentCreate(number=apartment_number),
        ),
        current_user=_current_user(),
    )
    return _jsonable(result)


@mcp.tool(
    description="Update a user's profile, role, apartment, or active status within existing access rules.",
    annotations=UPDATE,
)
def update_user(
    user_id: int,
    name: str | None = None,
    email: str | None = None,
    role: str | None = None,
    apartment_number: str | None = None,
    is_active: bool | None = None,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, f"change user {user_id}")
    update_values = {
        key: value
        for key, value in {
            "name": name,
            "email": email,
            "role": role,
            "is_active": is_active,
        }.items()
        if value is not None
    }
    if apartment_number is not None:
        update_values["apartment"] = ApartmentNumberUpdate(number=apartment_number)
    result = rest_update_user(
        user_id=user_id,
        updated_user=UserUpdate(**update_values),
        current_user=_current_user(),
    )
    return _jsonable(result)


@mcp.tool(
    description="Permanently delete a user the signed-in administrator manages.",
    annotations=DELETE,
)
def delete_user(user_id: int, confirm: bool = False) -> dict:
    _require_confirmation(confirm, f"permanently delete user {user_id}")
    rest_delete_user(user_id=user_id, current_user=_current_user())
    return {"deleted": True, "user_id": user_id}


@mcp.tool(
    description="List apartments visible to the signed-in resident.",
    annotations=READ_ONLY,
)
def list_apartments() -> list[dict]:
    return _jsonable(rest_list_apartments(current_user=_current_user()))


@mcp.tool(description="Create a building apartment.", annotations=CREATE)
def create_apartment(
    number: str, description: str | None = None, confirm: bool = False
) -> dict:
    _require_confirmation(confirm, f"create apartment {number}")
    return _jsonable(
        rest_create_apartment(
            apartment=ApartmentCreate(number=number, description=description),
            current_user=_current_user(),
        )
    )


@mcp.tool(description="Change an apartment's name or description.", annotations=UPDATE)
def update_apartment(
    apartment_id: int,
    number: str | None = None,
    description: str | None = None,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, f"change apartment {apartment_id}")
    update_values = {
        key: value
        for key, value in {"number": number, "description": description}.items()
        if value is not None
    }
    return _jsonable(
        rest_update_apartment(
            apartment_id=apartment_id,
            updated_apartment=ApartmentUpdate(**update_values),
            current_user=_current_user(),
        )
    )


@mcp.tool(description="Permanently delete an empty apartment.", annotations=DELETE)
def delete_apartment(apartment_id: int, confirm: bool = False) -> dict:
    _require_confirmation(confirm, f"permanently delete apartment {apartment_id}")
    rest_delete_apartment(apartment_id=apartment_id, current_user=_current_user())
    return {"deleted": True, "apartment_id": apartment_id}


@mcp.tool(
    description="List recent door-access activity within the signed-in resident's existing scope.",
    annotations=READ_ONLY,
)
def list_access_events(limit: int = 50, user_id: int | None = None) -> list[dict]:
    return access_event_store.list_access_events(
        _current_user(), limit=limit, user_id=user_id
    )


@mcp.tool(
    description="Physically unlock the building door for the signed-in active resident.",
    annotations=PHYSICAL_ACTION,
)
async def unlock_door(confirm: bool = False) -> dict:
    _require_confirmation(confirm, "physically unlock the building door now")
    return await unlock_for_user(_current_user(), source="mcp")


@mcp.tool(
    description="List PIN records for a user within the signed-in resident's existing scope. PIN values are never returned.",
    annotations=READ_ONLY,
)
def list_pins(user_id: int | None = None) -> list[dict]:
    current_user = _current_user()
    return _jsonable(
        rest_list_user_pins(
            user_id=user_id if user_id is not None else current_user.id,
            current_user=current_user,
        )
    )


@mcp.tool(
    description="Create a PIN credential for an allowed user.", annotations=CREATE
)
def create_pin(
    pin: str | None = None,
    label: str | None = None,
    user_id: int | None = None,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, "create a door PIN credential")
    return _jsonable(
        rest_create_pin(
            pin_request=PINCreate(pin=pin, label=label, user_id=user_id),
            current_user=_current_user(),
        )
    )


@mcp.tool(
    description="Change an allowed PIN credential or its label.", annotations=UPDATE
)
def update_pin(
    pin_id: int,
    pin: str | None = None,
    label: str | None = None,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, f"change PIN credential {pin_id}")
    update_values = {
        key: value
        for key, value in {"pin": pin, "label": label}.items()
        if value is not None
    }
    return _jsonable(
        rest_update_pin(
            pin_id=pin_id,
            pin_request=PINUpdate(**update_values),
            current_user=_current_user(),
        )
    )


@mcp.tool(
    description="Permanently delete an allowed PIN credential.", annotations=DELETE
)
def delete_pin(pin_id: int, confirm: bool = False) -> dict:
    _require_confirmation(confirm, f"permanently delete PIN credential {pin_id}")
    rest_delete_pin(pin_id=pin_id, current_user=_current_user())
    return {"deleted": True, "pin_id": pin_id}


@mcp.tool(
    description="List RFID credentials for a user within the signed-in resident's existing scope.",
    annotations=READ_ONLY,
)
def list_rfids(user_id: int | None = None) -> list[dict]:
    current_user = _current_user()
    return _jsonable(
        rest_list_user_rfids(
            user_id=user_id if user_id is not None else current_user.id,
            current_user=current_user,
        )
    )


@mcp.tool(
    description="Create an RFID credential for an allowed user.", annotations=CREATE
)
def create_rfid(
    uuid: str,
    label: str | None = None,
    user_id: int | None = None,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, "create an RFID door credential")
    return _jsonable(
        rest_create_rfid(
            rfid_request=RFIDCreate(uuid=uuid, label=label, user_id=user_id),
            current_user=_current_user(),
        )
    )


@mcp.tool(
    description="Permanently delete an allowed RFID credential.", annotations=DELETE
)
def delete_rfid(rfid_id: int, confirm: bool = False) -> dict:
    _require_confirmation(confirm, f"permanently delete RFID credential {rfid_id}")
    rest_delete_rfid(rfid_id=rfid_id, current_user=_current_user())
    return {"deleted": True, "rfid_id": rfid_id}


@mcp.tool(
    description="List recurring and one-time door schedules for an allowed guest.",
    annotations=READ_ONLY,
)
def list_guest_schedules(user_id: int | None = None) -> dict:
    current_user = _current_user()
    result = rest_list_guest_schedules(
        user_id=user_id if user_id is not None else current_user.id,
        current_user=current_user,
    )
    return _jsonable(result)


@mcp.tool(
    description="Create a weekly door-access window for a guest.", annotations=CREATE
)
def create_recurring_schedule(
    user_id: int,
    day_of_week: int,
    start_time: time,
    end_time: time,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, f"grant recurring door access to guest {user_id}")
    return _jsonable(
        rest_create_recurring_schedule(
            user_id=user_id,
            schedule=RecurringScheduleCreate(
                day_of_week=day_of_week, start_time=start_time, end_time=end_time
            ),
            current_user=_current_user(),
        )
    )


@mcp.tool(
    description="Create a dated door-access window for a guest.", annotations=CREATE
)
def create_one_time_access(
    user_id: int,
    start_date: date,
    end_date: date,
    start_time: time,
    end_time: time,
    confirm: bool = False,
) -> dict:
    _require_confirmation(confirm, f"grant one-time door access to guest {user_id}")
    return _jsonable(
        rest_create_one_time_access(
            user_id=user_id,
            access=OneTimeAccessCreate(
                start_date=start_date,
                end_date=end_date,
                start_time=start_time,
                end_time=end_time,
            ),
            current_user=_current_user(),
        )
    )


@mcp.tool(
    description="Permanently delete a recurring guest schedule.", annotations=DELETE
)
def delete_recurring_schedule(schedule_id: int, confirm: bool = False) -> dict:
    _require_confirmation(confirm, f"delete recurring guest schedule {schedule_id}")
    rest_delete_recurring_schedule(
        schedule_id=schedule_id, current_user=_current_user()
    )
    return {"deleted": True, "schedule_id": schedule_id}


@mcp.tool(
    description="Permanently delete a one-time guest access window.", annotations=DELETE
)
def delete_one_time_access(access_id: int, confirm: bool = False) -> dict:
    _require_confirmation(confirm, f"delete one-time guest access {access_id}")
    rest_delete_one_time_access(access_id=access_id, current_user=_current_user())
    return {"deleted": True, "access_id": access_id}


@mcp.tool(
    description="Show whether the physical credential reader is running.",
    annotations=READ_ONLY,
)
async def get_reader_status() -> dict:
    return await rest_reader_status(current_user=_current_user())


@mcp.tool(description="Start the physical credential reader.", annotations=CREATE)
async def start_reader(confirm: bool = False) -> dict:
    _require_confirmation(confirm, "start the physical credential reader")
    return await rest_start_reader(current_user=_current_user())


@mcp.tool(
    description="Stop the physical credential reader until it is started again.",
    annotations=DELETE,
)
async def stop_reader(confirm: bool = False) -> dict:
    _require_confirmation(confirm, "stop the physical credential reader")
    return await rest_stop_reader(current_user=_current_user())


def create_mcp_asgi_app():
    return mcp.streamable_http_app()
