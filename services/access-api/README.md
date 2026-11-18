# access-api

Simple door lock system with PIN codes, RFID tags and remote unlocking using Raspberry PI.

The API records structured access events for PIN, RFID and remote unlock attempts.
Clients can read those events through `/access-events`, scoped by role. The Expo app
can also register native APNs or FCM push tokens through `/notification-devices` so
the backend can send access-event notifications directly through Apple and Google
without exposing notification credentials to clients.

RFID enrollment through `/rfids/read` requires the `READER_CONTROL` permission,
accepts a timeout from 1 to 30 seconds, and restores the shared reader after a
successful scan, timeout, or scanner failure when the request stopped it. The API
returns `409 Conflict` if another enrollment scan is already using the reader.

Guest schedule windows must end after they start; overnight access should be
represented by two schedules. Invalid weekdays or time windows are rejected
before the API replaces a guest's PIN for scheduled access.

Client apps in this monorepo:

- web: `../../apps/web`
- app: `../../apps/app`

## Hardware

Tested on Raspberry Pi 3, 4 and 5 with 64-bit Raspberry Pi OS Bookworm, which includes Python 3.11. Older releases such as Bullseye have Python 3.9 and an older glibc, and the `lgpio` package won't run there (`GLIBC_2.34 not found`). On a Pi 3, use the system Python or let uv download a prebuilt one; building Python with pyenv takes a long time on the Pi 3's CPU.

This will work with any relay operated lock that you can control from the GPIO pins of a Raspberry PI. You have to set up wiring so that the PI sends a door unlocking signal by activating a relay on a 12-24 V circuit connected to the I/O module. Tested with the I/O Module from SÜDMETALL (https://www.suedmetall.com/products/locking-systems/stand-alone-solutions/i-o-modul/?lang=en).

By default, the code expects the relay to be connected to GPIO pin 18, but this can be changed by setting the `RELAY_PIN` environment variable.

As for the PIN/RFID reader, the code is prepared to take normal "keyboard" input (evdev) - some USB-connected readers work like that. In development, you'll probably want to use terminal input, so set INPUT_SOURCE to terminal.

There is also a special mode called T9EM - I need to add more details on that but it's basically for a specific combination of the Asia-Teco "T9" Wiegand reader (http://www.asia-teco.com/en/h-por-j-262-5_262.html) which I got from Aliexpress (https://www.aliexpress.com/item/1005006244356261.html?spm=a2g0o.order_detail.order_detail_item.3.21fef19cNaLXvx) and a specific Wiegand to USB converter. You can select it by setting the INPUT_SOURCE environment variable to T9 (or T9EM - need to check.)

### Wiring

The wiring below uses a Wiegand reader and a Wiegand to USB converter. Power the PIN/card reader straight from the 12V source, not from the RPi through the converter, so that the reader cannot cause undervoltage on the RPi. Connect the reader's ground to the converter's ground as well, so that the data lines have a shared reference.

Red lines carry power, grey lines are ground and blue lines are signals. IN 2 on the lock I/O module is wired to the intercom's door-open button, so the door can still be opened from the intercom. The 40-pin header is the same on the Raspberry Pi 3, 4 and 5, so the pin numbers apply to all three. IN 1 is a potential-free contact input: the relay unlocks the door by bridging IN 1 + and IN 1 -, and no supply voltage is wired to the relay contacts.

```mermaid
flowchart TD
  src12V["12V source"]
  intercom["Intercom"]
  subgraph dcDc5V["Step-down to 5V"]
        sdOutPos["OUT+"]
        sdOutNeg["OUT-"]
  end
  subgraph rpi["Raspberry Pi"]
        rpi5vPin2["5V (pin 2)"]
        rpiGndPin9["GND (pin 9)"]
        rpi5vPin4["5V (pin 4)"]
        rpiGndPin6["GND (pin 6)"]
        rpiGPIO18["GPIO 18 (pin 12)"]
        rpiUSB["USB port"]
  end
  subgraph relay["Relay"]
        relayVcc["VCC"]
        relayGnd["GND"]
        relayIn["IN"]
        relayCom["COM"]
        relayNo["NO"]
  end
  subgraph pinRfid["PIN/RFID reader"]
        readerPos["12V +"]
        readerGnd["GND"]
        readerData0["Data 0"]
        readerData1["Data 1"]
  end
  subgraph usbWiegand["Wiegand to USB converter"]
        convGnd["GND"]
        convData0["Data 0"]
        convData1["Data 1"]
        convUsb["USB"]
  end
  subgraph ioModule["Lock I/O module"]
        ioPower["12V DC +/-"]
        ioIn1Pos["IN 1 +"]
        ioIn1Neg["IN 1 -"]
        ioIn2["IN 2"]
  end

    src12V ---|"+12V and GND"| dcDc5V
    src12V ---|"+12V and GND"| ioPower
    src12V ---|"+12V"| readerPos
    sdOutPos ---|"+5V"| rpi5vPin2
    rpi5vPin4 ---|"+5V"| relayVcc
    src12V ---|"GND"| readerGnd
    sdOutNeg ---|"GND"| rpiGndPin9
    rpiGndPin6 ---|"GND"| relayGnd
    readerGnd ---|"GND"| convGnd
    rpiGPIO18 ---|"unlock signal"| relayIn
    readerData0 --- convData0
    readerData1 --- convData1
    convUsb ---|"USB"| rpiUSB
    relayCom --- ioIn1Pos
    relayNo --- ioIn1Neg
    intercom ---|"door-open button"| ioIn2

    linkStyle 0,1,2,3,4 stroke:#d62728,stroke-width:2px
    linkStyle 5,6,7,8 stroke:#7f7f7f,stroke-width:2px
    linkStyle 9,10,11,12,13,14,15 stroke:#1f77b4,stroke-width:2px

    style src12V fill:#ff9999,color:#000
    style dcDc5V fill:#ccccff,color:#000
    style rpi fill:#99ccff,color:#000
    style pinRfid fill:#ffcc99,color:#000
    style usbWiegand fill:#e0e0e0,color:#000
    style ioModule fill:#99ff99,color:#000
    style relay fill:#ffff99,color:#000
```

#### Detailed wiring with protection

This version adds a fuse and buffer capacitors, and shows which parts sit at the supply and which at the door. They help when the 12V reaches the door over a long cable:

- **Fuse (slow-blow, T 2A):** in the +12V wire right at the supply, so it protects the whole cable run. Use a fuse no larger than the supply's rated current.
- **2200 µF capacitor at the door:** across the 12V terminals where the cable arrives, before it splits to the other parts. It covers short current surges locally, so they don't cause a voltage drop along the long cable.
- **1000 µF and 100 nF capacitors at the reader:** across the reader's 12V and GND terminals. The electrolytic covers the reader's switch-on surge; the ceramic filters fast noise that could disturb the Wiegand data.

Use electrolytic capacitors rated 25V or more and keep their leads short. Electrolytics are polarised: the leg marked with a stripe goes to GND.

```mermaid
flowchart TD
  subgraph supply["12V supply"]
        supplyPos["+12V"]
        supplyGnd["GND"]
  end
  fuse["Fuse T 2A, at the supply"]
  subgraph doorTerminals["12V terminals at the door"]
        doorPos["+12V"]
        doorGnd["GND"]
  end
  capDoor["2200 µF 25V, fitted at the door terminals"]
  intercom["Intercom"]
  subgraph dcDc5V["Step-down to 5V"]
        sdInPos["IN+"]
        sdInNeg["IN-"]
        sdOutPos["OUT+"]
        sdOutNeg["OUT-"]
  end
  subgraph rpi["Raspberry Pi"]
        rpi5vPin2["5V (pin 2)"]
        rpiGndPin9["GND (pin 9)"]
        rpi5vPin4["5V (pin 4)"]
        rpiGndPin6["GND (pin 6)"]
        rpiGPIO18["GPIO 18 (pin 12)"]
        rpiUSB["USB port"]
  end
  subgraph relay["Relay"]
        relayVcc["VCC"]
        relayGnd["GND"]
        relayIn["IN"]
        relayCom["COM"]
        relayNo["NO"]
  end
  subgraph pinRfid["PIN/RFID reader"]
        readerPos["12V +"]
        readerGnd["GND"]
        readerData0["Data 0"]
        readerData1["Data 1"]
  end
  capReader["1000 µF 25V and 100 nF, fitted at the reader's terminals"]
  subgraph usbWiegand["Wiegand to USB converter"]
        convGnd["GND"]
        convData0["Data 0"]
        convData1["Data 1"]
        convUsb["USB"]
  end
  subgraph ioModule["Lock I/O module"]
        ioPos["12V +"]
        ioGnd["GND"]
        ioIn1Pos["IN 1 +"]
        ioIn1Neg["IN 1 -"]
        ioIn2["IN 2"]
  end

    supplyPos ---|"+12V"| fuse
    fuse ---|"+12V, long cable"| doorPos
    doorPos ---|"+12V"| sdInPos
    doorPos ---|"+12V"| ioPos
    doorPos ---|"+12V"| readerPos
    doorPos ---|"+"| capDoor
    readerPos ---|"+"| capReader
    sdOutPos ---|"+5V"| rpi5vPin2
    rpi5vPin4 ---|"+5V"| relayVcc
    supplyGnd ---|"GND, long cable"| doorGnd
    doorGnd ---|"GND"| sdInNeg
    doorGnd ---|"GND"| ioGnd
    doorGnd ---|"GND"| readerGnd
    doorGnd ---|"- (stripe)"| capDoor
    readerGnd ---|"- (stripe)"| capReader
    sdOutNeg ---|"GND"| rpiGndPin9
    rpiGndPin6 ---|"GND"| relayGnd
    readerGnd ---|"GND"| convGnd
    rpiGPIO18 ---|"unlock signal"| relayIn
    readerData0 --- convData0
    readerData1 --- convData1
    convUsb ---|"USB"| rpiUSB
    relayCom --- ioIn1Pos
    relayNo --- ioIn1Neg
    intercom ---|"door-open button"| ioIn2

    linkStyle 0,1,2,3,4,5,6,7,8 stroke:#d62728,stroke-width:2px
    linkStyle 9,10,11,12,13,14,15,16,17 stroke:#7f7f7f,stroke-width:2px
    linkStyle 18,19,20,21,22,23,24 stroke:#1f77b4,stroke-width:2px

    style supply fill:#ff9999,color:#000
    style doorTerminals fill:#ff9999,color:#000
    style fuse fill:#ffd6d6,color:#000
    style capDoor fill:#ffd6d6,color:#000
    style capReader fill:#ffd6d6,color:#000
    style dcDc5V fill:#ccccff,color:#000
    style rpi fill:#99ccff,color:#000
    style pinRfid fill:#ffcc99,color:#000
    style usbWiegand fill:#e0e0e0,color:#000
    style ioModule fill:#99ff99,color:#000
    style relay fill:#ffff99,color:#000
```

## Install

```bash
uv sync --locked
```

The project requires uv 0.11.31 or newer and Python 3.11. `uv sync` installs
`evdev` on Linux and the GPIO dependencies on ARM Linux, while excluding those
hardware-specific packages on macOS.

Run the API with the locked environment:

```bash
uv run --locked python api.py
```

### Development

On a machine without Raspberry Pi GPIO hardware, create the existing dummy
`RPi.GPIO` module after syncing:

```bash
uv sync --locked
./setup_mock_rpi_gpio.sh
```

## Push Notifications

The backend sends access-event notifications directly to the platform providers:

- iOS devices register APNs tokens and are sent through APNs.
- Android devices register FCM tokens and are sent through FCM HTTP v1.

The `/notification-devices` registration payload is:

```json
{
  "push_token": "native-device-token",
  "provider": "apns",
  "platform": "ios",
  "environment": "production"
}
```

Use `provider: "fcm"` and `platform: "android"` for Android. APNs
`environment` can be `sandbox` or `production`; if omitted, the backend uses
`APNS_DEFAULT_ENVIRONMENT`.

Required backend config for APNs:

- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_TOPIC` (the iOS app bundle identifier)
- `APNS_KEY_FILE` or `APNS_PRIVATE_KEY`

Required backend config for FCM:

- `FCM_PROJECT_ID`
- `FCM_SERVICE_ACCOUNT_FILE` or `FCM_SERVICE_ACCOUNT_JSON`

Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` and `FCM_USE_ADC=1` to use
Google Application Default Credentials.

The service account needs permission to send Firebase Cloud Messaging HTTP v1
messages. Keep APNs `.p8` keys and FCM service account JSON files off the client
and out of git.

To verify delivery after a native app has registered a device token, call:

```bash
curl -X POST "$API_URL/notification-devices/test" \
  -H "Authorization: Bearer $TOKEN"
```

The endpoint sends a test notification to the current user's active APNs/FCM
devices and returns one result per registered device. It uses the same direct
provider clients as access-event notifications.

## Networking

Because this will be running on a Raspberry PI - likely without a static public IP address or port forwarding, you will need a way of opening it up to recieve HTTP requests. There are multiple ways: traditionally you'd use port forwarding to another server exposed to the Internet, or you can use a service like Cloudflare Tunnels instead.

### Option 1: Cloudflare tunnel

Cloudflare Tunnels provide a secure way to expose your Raspberry PI to the internet without opening ports on your router or having a static IP address. This is the recommended approach as it's more secure and easier to set up than traditional port forwarding.

#### Prerequisites

1. A Cloudflare account (free tier works fine)
2. A domain name managed by Cloudflare
3. Your Raspberry PI connected to the internet

#### Setup Steps

1. **Install cloudflared on your Raspberry PI:**

   ```bash
   # Download the latest cloudflared for ARM64 (RPi 4/5) or ARM (RPi 3)
   # For RPi 4/5 (ARM64):
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
   sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared
   sudo chmod +x /usr/local/bin/cloudflared
   
   # For RPi 3 (ARM):
   # wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm
   # sudo mv cloudflared-linux-arm /usr/local/bin/cloudflared
   # sudo chmod +x /usr/local/bin/cloudflared
   ```

2. **Authenticate cloudflared with your Cloudflare account:**

   ```bash
   cloudflared tunnel login
   ```

   This will open a browser window where you need to select your domain and authorize the tunnel.

3. **Create a tunnel:**

   ```bash
   cloudflared tunnel create access-api
   ```

   This creates a tunnel and generates a tunnel ID. Note down the tunnel ID for later use.

4. **Create a configuration file:**

   Create `/home/pi/.cloudflared/config.yml` (replace `<TUNNEL_ID>` with your actual tunnel ID):

   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /home/pi/.cloudflared/<TUNNEL_ID>.json
   
   ingress:
     - hostname: door.yourdomain.com
       service: http://localhost:8000
     - service: http_status:404
   ```

5. **Create a DNS record:**

   ```bash
   cloudflared tunnel route dns access-api door.yourdomain.com
   ```

   Replace `door.yourdomain.com` with your desired subdomain.

6. **Test the tunnel:**

   Start your access API server:
   ```bash
   uvicorn api:app --host 0.0.0.0 --port 8000
   ```

   In another terminal, start the tunnel:
   ```bash
   cloudflared tunnel run access-api
   ```

   Your API should now be accessible at `https://door.yourdomain.com`

7. **Set up as a system service (optional but recommended):**

   Create a systemd service file at `/etc/systemd/system/cloudflared.service`:

   ```ini
   [Unit]
   Description=Cloudflare Tunnel
   After=network.target
   
   [Service]
   Type=simple
   User=pi
   ExecStart=/usr/local/bin/cloudflared tunnel run access-api
   Restart=always
   RestartSec=5
   KillMode=mixed
   
   [Install]
   WantedBy=multi-user.target
   ```

   Enable and start the service:
   ```bash
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

#### Security Considerations

- Your tunnel is automatically secured with TLS
- Consider adding Cloudflare Access rules to restrict who can access your door control system
- You can add additional authentication layers through Cloudflare's security features
- Monitor access logs through the Cloudflare dashboard

### Option 2: Use another server as a proxy to forward requests to the Raspberry PI.

On the Raspberry PI, set up reverse port forwarding like this:

```bash
ssh -R 8000:localhost:8000 <server>
```

Or use autossh to keep the connection alive, for example:

```bash
autossh -M 20000 -N -R 8000:localhost:8000 username@proxy-server -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3"
```

You can even set it up as a systemd service to run in the background like this:

```bash
[Unit]
Description=AutoSSH tunnel service for port 4444
After=network.target

[Service]
User=pi
Group=pi
ExecStart=/usr/bin/autossh -M 20000 -N -R 8000:localhost:8000 username@proxy-server -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3"
Restart=always
RestartSec=3
StartLimitIntervalSec=60
StartLimitBurst=10

[Install]
WantedBy=multi-user.target
```

## Usage

### Remote MCP server

The API also serves a standards-compliant Streamable HTTP MCP endpoint at `/mcp`
with browser OAuth 2.1. It uses the existing Anlok roles, permissions, apartment
scope, and credential rules rather than a separate authorization matrix.

Deployment configuration, client commands, OAuth endpoint routing, tool scope,
and security behavior are documented in [`../../docs/mcp.md`](../../docs/mcp.md).
Set `MCP_PUBLIC_URL`, `OAUTH_ISSUER_URL`, and `WEB_APP_URL` to their exact public
URLs. Production startup rejects non-HTTPS values; documented localhost HTTP is
allowed for development.

### API keys, phone shortcuts and Home Assistant

Users create API keys in the app's settings. Each key has a scope:

- `unlock`: the key can only call `POST /doors/unlock`. Every other endpoint
  answers `403`. Use this for iPhone Shortcuts, Android home-screen shortcuts
  and widgets, and Home Assistant.
- `full` (the API default, kept for older clients): the key acts as its owner
  with all of the owner's permissions.

`POST /api-keys` takes an optional `scope` (`"full"` or `"unlock"`); the app
and web client default to `unlock`. Existing keys are migrated to `full` on
startup. Send the key in the `X-API-Key` header. The `api_key` query parameter
still works, but URLs tend to end up in logs and browser history.

```bash
curl -X POST "$API_URL/doors/unlock" -H "X-API-Key: $UNLOCK_KEY"
```

Home Assistant example (`configuration.yaml`, with the key in `secrets.yaml`):

```yaml
rest_command:
  anlok_unlock:
    url: "https://door.example.com/doors/unlock"
    method: post
    headers:
      X-API-Key: !secret anlok_api_key
```

The app's API key screen shows step-by-step guides for iPhone, Android and
Home Assistant with the server URL and the new key filled in.

### First-time setup

Set environment variables to configure the app. First copy the example file with `cp .env.example .env` and then edit as needed.

Login emails include both a code and a clickable link. The link is built from `WEB_APP_URL` with `/login` appended.

Run `uv run --locked python setup.py` to create the database and set up the
first user. You can also use a CSV file with usernames and PIN codes to create
multiple users at once; use `users.csv.example` as a template.

### Launching the API server

Launch the API server with `uv run --locked uvicorn api:app` (or add the
`--reload` flag for development).

You need to obtain credentials first to use the API directly. You can either sign in through one of the clients and use the bearer token from the `Authorization` header, or create an API key from the admin profile settings in the web or Expo app. API keys are accepted through the `X-API-Key` header or the `api_key` query parameter.

#### User Roles

The system supports four user roles with different permission levels:

##### 1. **Admin** 
- Full system access
- Can manage all users across all apartments
- Can create/update/delete any user, PIN, RFID, or API key
- Can access all system endpoints and administrative functions

##### 2. **Apartment Admin**
- Can manage users within their own apartment only
- Can create/update/delete users, PINs, RFIDs for users in their apartment
- Can view apartment-specific data and manage guest schedules
- Cannot access other apartments or system-wide settings

##### 3. **User** 
- Regular apartment resident with self-management capabilities
- Can create/update/delete their own PINs (with custom PIN values)
- Can create/update/delete their own RFIDs and API keys
- Can view their own profile information
- Has 24/7 access (no schedule restrictions)
- **Cannot** create other users or access apartment-wide data
- **Cannot** be put on guest schedules

##### 4. **Guest**
- Very limited access for temporary users
- PINs are automatically generated (cannot set custom PINs)
- Can be put on time-based access schedules
- Subject to schedule restrictions (access only during allowed times)
- Can only manage their own credentials
- Cannot create other users or access apartment data

##### Key Role Differences

| Feature | Admin | Apartment Admin | User | Guest |
|---------|-------|----------------|------|--------|
| User Management | ✅ All apartments | ✅ Own apartment | ❌ None | ❌ None |
| Custom PINs | ✅ Any user | ✅ Apartment users | ✅ Self only | ❌ Auto-generated |
| Access Schedules | ✅ Manage all | ✅ Apartment guests | ❌ Not scheduled | ⏰ Subject to schedules |
| System Access | 🕐 24/7 | 🕐 24/7 | 🕐 24/7 | ⏰ Scheduled only |
| Data Visibility | 👁️ System-wide | 👁️ Apartment-wide | 👁️ Self only | 👁️ Self only |

##### PIN Privacy and Duplicate PIN Trade-offs

PINs are short access credentials, not strong private secrets. Because the default
PIN length is small, an administrator with database access can brute-force salted
PIN hashes by trying every possible PIN value. Salting still prevents simple hash
comparison and precomputed lookup, but it does not make short PINs private from
trusted operators.

By default, the system always auto-generates guest PINs. `GUEST_PIN_MODE` can
change this:

- `generated` (default): guest PINs are always generated by the backend.
- `custom_until_scheduled`: guests may choose custom PINs while they have no
  schedules. If all schedules are deleted later, custom guest PINs are allowed
  again.

When scheduled access is first added for a guest, all of that guest's existing
PINs are deleted and a new unique PIN is generated. This avoids telling the guest
or admin which old PINs, if any, were duplicates. Scheduled access needs a unique
PIN so time limits can be enforced.

`PIN_UNIQUENESS_MODE` controls duplicate checks for custom PINs:

- `global`: all PINs must be unique.
- `scheduled` (default): scheduled-access PINs must be unique; ordinary resident
  duplicates are allowed.
- `off`: ordinary duplicate checks are disabled, but scheduled-access PINs are
  still protected because schedules cannot be enforced safely with shared PINs.

If two unscheduled people share the same PIN, the keypad input cannot prove which
person physically opened the door. Access logs mark the PIN match as shared, and
both users may get notifications when the PIN is used.

Disallowing duplicate PINs improves auditability, but it also leaks information:
when a user is told that a PIN is already in use, they learn that the PIN is a
valid door credential. Since knowing the PIN is enough to use it, duplicate-PIN
validation is not privacy preserving for low-trust users.

For operational clarity, admins should treat personal PINs as unique per-user
credentials. If a PIN is intentionally shared, users should be told: "A PIN is a
door code, not a private password. If two people use the same PIN, they both may
get notifications when the PIN is used."
