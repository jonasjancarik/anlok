import { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  AccessEvent,
  Apartment,
  ApiKey,
  OneTimeAccess,
  PIN,
  RecurringSchedule,
  RFID,
  User,
} from '../../types/entities';

// An in-memory stand-in for the Anlok server. It answers the same requests the real server
// does, so every screen works unchanged. Nothing leaves the device and no door is involved.

export const DEMO_API_URL = 'demo://anlok';
export const DEMO_TOKEN = 'demo-token';

type DemoState = {
  nextId: number;
  apartments: Apartment[];
  users: User[];
  pins: Record<number, PIN[]>;
  rfids: Record<number, RFID[]>;
  apiKeys: ApiKey[];
  events: AccessEvent[];
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const buildState = (): DemoState => {
  const apartments: Apartment[] = [
    { id: 1, number: '1', description: 'Ground floor' },
    { id: 2, number: '2', description: 'First floor, left' },
    { id: 3, number: '3', description: 'First floor, right' },
    { id: 4, number: '4', description: 'Attic' },
  ];
  const apartmentFor = (number: string) => apartments.find((item) => item.number === number)!;

  const users: User[] = [
    { id: 1, name: 'Alex Novak', email: 'admin@example.com', role: 'admin', creator_id: 1, apartment_id: 1, is_active: true, apartment: apartmentFor('1') },
    { id: 2, name: 'Petra Svobodova', email: 'petra@example.com', role: 'apartment_admin', creator_id: 1, apartment_id: 2, is_active: true, apartment: apartmentFor('2') },
    { id: 3, name: 'Tomas Svoboda', email: 'tomas@example.com', role: 'user', creator_id: 2, apartment_id: 2, is_active: true, apartment: apartmentFor('2') },
    {
      id: 4,
      name: 'Eva Dvorakova',
      email: 'eva@example.com',
      role: 'guest',
      creator_id: 2,
      apartment_id: 2,
      is_active: true,
      apartment: apartmentFor('2'),
    },
    { id: 5, name: 'Jan Prochazka', email: 'jan@example.com', role: 'user', creator_id: 1, apartment_id: 3, is_active: true, apartment: apartmentFor('3') },
    { id: 6, name: 'Lucie Mala', email: 'lucie@example.com', role: 'user', creator_id: 1, apartment_id: 4, is_active: true, apartment: apartmentFor('4') },
  ];

  const createdAt = minutesAgo(60 * 24 * 12);
  const pins: Record<number, PIN[]> = {
    1: [{ id: 1, label: 'Home', created_at: createdAt }],
    2: [{ id: 2, label: 'Home', created_at: createdAt }],
    3: [{ id: 3, label: 'Front door', created_at: createdAt }],
    5: [{ id: 4, label: 'Home', created_at: createdAt }],
  };
  const rfids: Record<number, RFID[]> = {
    3: [{ id: 1, user_id: 3, hashed_uuid: 'demo', last_four_digits: '4D21', label: 'Keychain', creator_email: 'petra@example.com', created_at: createdAt }],
    5: [{ id: 2, user_id: 5, hashed_uuid: 'demo', last_four_digits: '9F08', label: 'Card', creator_email: 'admin@example.com', created_at: createdAt }],
  };

  const event = (
    id: number,
    minutes: number,
    method: AccessEvent['method'],
    outcome: AccessEvent['outcome'],
    userId: number,
    extra: Partial<AccessEvent> = {}
  ): AccessEvent => {
    const person = users.find((item) => item.id === userId)!;
    return {
      id,
      created_at: minutesAgo(minutes),
      method,
      outcome,
      user_id: person.id,
      user_name: person.name,
      user_email: person.email,
      actor_user_id: person.id,
      actor_user_name: person.name,
      apartment_id: person.apartment_id,
      apartment_number: person.apartment?.number,
      source: method === 'remote_unlock' ? 'app' : 'reader',
      metadata: {},
      ...extra,
    };
  };

  const events: AccessEvent[] = [
    event(8, 12, 'remote_unlock', 'granted', 2),
    event(7, 47, 'pin', 'granted', 3, { credential_label: 'Front door' }),
    event(6, 95, 'rfid', 'granted', 5, { credential_label: 'Card' }),
    event(5, 180, 'pin', 'denied', 4, { reason: 'outside_allowed_schedule' }),
    event(4, 60 * 5, 'remote_unlock', 'granted', 6),
    event(3, 60 * 26, 'rfid', 'granted', 3, { credential_label: 'Keychain' }),
    event(2, 60 * 29, 'pin', 'granted', 5, { credential_label: 'Home' }),
    event(1, 60 * 31, 'pin', 'denied', 6, { reason: 'unknown_credential' }),
  ];

  users[3].recurring_schedules = [
    { id: 1, user_id: 4, day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00' },
    { id: 2, user_id: 4, day_of_week: 3, start_time: '09:00:00', end_time: '12:00:00' },
  ];
  users[3].one_time_access = [];

  return {
    nextId: 100,
    apartments,
    users,
    pins,
    rfids,
    apiKeys: [
      { key_suffix: 'a1b2', description: 'Home automation', created_at: createdAt, is_active: true, user_id: 1 },
    ],
    events,
  };
};

let state = buildState();

export const resetDemoState = () => {
  state = buildState();
};

const nextId = () => {
  state.nextId += 1;
  return state.nextId;
};

class DemoHttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const findUser = (id: number) => {
  const user = state.users.find((item) => item.id === id);
  if (!user) throw new DemoHttpError(404, 'Person not found.');
  return user;
};

const apartmentByNumber = (number: string) => {
  const found = state.apartments.find((item) => item.number === number);
  if (!found) throw new DemoHttpError(404, `Apartment ${number} doesn’t exist.`);
  return found;
};

const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));

const recordUnlock = () => {
  const admin = state.users[0];
  state.events.unshift({
    id: nextId(),
    created_at: new Date().toISOString(),
    method: 'remote_unlock',
    outcome: 'granted',
    user_id: admin.id,
    user_name: admin.name,
    user_email: admin.email,
    actor_user_id: admin.id,
    actor_user_name: admin.name,
    apartment_id: admin.apartment_id,
    apartment_number: admin.apartment?.number,
    source: 'app',
    metadata: {},
  });
};

type Body = Record<string, any>;
type Handler = (match: RegExpMatchArray, body: Body, params: Body) => { status?: number; data?: unknown };

const ok = (data: unknown, status = 200) => ({ status, data });

const routes: Array<[string, RegExp, Handler]> = [
  ['post', /^\/auth\/verify$/, () => ok({ status: 'authenticated', user: state.users[0] })],
  ['post', /^\/auth\/magic-links$/, () => ok({}, 202)],
  ['post', /^\/auth\/tokens$/, (_m, body) => {
    // Any code works in the demo. An email that matches a sample person signs in as them.
    const email = String(body.email ?? '').trim().toLowerCase();
    const user = state.users.find((item) => item.email === email) ?? state.users[0];
    return ok({ access_token: DEMO_TOKEN, user }, 201);
  }],
  ['post', /^\/doors\/unlock$/, () => {
    recordUnlock();
    return ok({ message: 'Door unlock initiated' });
  }],
  ['get', /^\/access-events$/, (_m, _b, params) => ok(state.events.slice(0, Number(params.limit) || 100))],

  ['get', /^\/users$/, () => ok(state.users)],
  ['post', /^\/users$/, (_m, body) => {
    const apartment = apartmentByNumber(String(body.apartment?.number ?? ''));
    const user: User = {
      id: nextId(),
      name: String(body.name),
      email: String(body.email),
      role: body.role ?? 'user',
      creator_id: 1,
      apartment_id: apartment.id,
      is_active: true,
      apartment,
    };
    state.users.push(user);
    return ok(user, 201);
  }],
  ['put', /^\/users\/(\d+)$/, (m, body) => {
    const user = findUser(Number(m[1]));
    if (typeof body.name === 'string') user.name = body.name;
    if (typeof body.email === 'string') user.email = body.email;
    if (body.role) user.role = body.role;
    if (typeof body.is_active === 'boolean') user.is_active = body.is_active;
    if (body.apartment?.number) {
      user.apartment = apartmentByNumber(String(body.apartment.number));
      user.apartment_id = user.apartment.id;
    }
    return ok(user);
  }],
  ['delete', /^\/users\/(\d+)$/, (m) => {
    const id = Number(m[1]);
    if (id === 1) throw new DemoHttpError(400, 'You can’t remove your own account in the demo.');
    state.users = state.users.filter((item) => item.id !== id);
    return ok(null, 204);
  }],
  ['get', /^\/users\/(\d+)\/pins$/, (m) => ok(state.pins[Number(m[1])] ?? [])],
  ['get', /^\/users\/(\d+)\/rfids$/, (m) => ok(state.rfids[Number(m[1])] ?? [])],

  ['post', /^\/pins$/, (_m, body) => {
    const user = findUser(Number(body.user_id));
    const pin: PIN = {
      id: nextId(),
      label: body.label ?? '',
      created_at: new Date().toISOString(),
      pin: body.pin || randomPin(),
    };
    state.pins[user.id] = [...(state.pins[user.id] ?? []), { ...pin, pin: undefined }];
    return ok(pin, 201);
  }],
  ['delete', /^\/pins\/(\d+)$/, (m) => {
    const id = Number(m[1]);
    Object.keys(state.pins).forEach((key) => {
      state.pins[Number(key)] = state.pins[Number(key)].filter((item) => item.id !== id);
    });
    return ok(null, 204);
  }],

  ['get', /^\/rfids\/read$/, () => ok({ uuid: '04A1B2C3D4E5F6' })],
  ['post', /^\/rfids$/, (_m, body) => {
    const user = findUser(Number(body.user_id));
    const uuid = String(body.uuid);
    const rfid: RFID = {
      id: nextId(),
      user_id: user.id,
      hashed_uuid: 'demo',
      last_four_digits: uuid.slice(-4).toUpperCase(),
      label: body.label ?? '',
      creator_email: state.users[0].email ?? '',
      created_at: new Date().toISOString(),
    };
    state.rfids[user.id] = [...(state.rfids[user.id] ?? []), rfid];
    return ok({ status: 'RFID created', rfid }, 201);
  }],
  ['delete', /^\/rfids\/(\d+)$/, (m) => {
    const id = Number(m[1]);
    Object.keys(state.rfids).forEach((key) => {
      state.rfids[Number(key)] = state.rfids[Number(key)].filter((item) => item.id !== id);
    });
    return ok(null, 204);
  }],

  ['get', /^\/apartments$/, () => ok(state.apartments)],
  ['post', /^\/apartments$/, (_m, body) => {
    const apartment: Apartment = { id: nextId(), number: String(body.number), description: String(body.description ?? '') };
    state.apartments.push(apartment);
    return ok(apartment, 201);
  }],
  ['put', /^\/apartments\/(\d+)$/, (m, body) => {
    const apartment = state.apartments.find((item) => item.id === Number(m[1]));
    if (!apartment) throw new DemoHttpError(404, 'Apartment not found.');
    apartment.number = String(body.number);
    apartment.description = String(body.description ?? '');
    return ok(apartment);
  }],
  ['delete', /^\/apartments\/(\d+)$/, (m) => {
    const id = Number(m[1]);
    if (state.users.some((item) => item.apartment_id === id)) {
      throw new DemoHttpError(400, 'Move the people out of this apartment first.');
    }
    state.apartments = state.apartments.filter((item) => item.id !== id);
    return ok(null, 204);
  }],

  ['get', /^\/guests\/(\d+)\/schedules$/, (m) => {
    const user = findUser(Number(m[1]));
    return ok({ recurring_schedules: user.recurring_schedules ?? [], one_time_access: user.one_time_access ?? [] });
  }],
  ['post', /^\/guests\/(\d+)\/recurring-schedules$/, (m, body) => {
    const user = findUser(Number(m[1]));
    const schedule: RecurringSchedule = {
      id: nextId(),
      user_id: user.id,
      day_of_week: Number(body.day_of_week),
      start_time: String(body.start_time),
      end_time: String(body.end_time),
    };
    user.recurring_schedules = [...(user.recurring_schedules ?? []), schedule];
    return ok({ status: 'Recurring schedule created', schedule_id: schedule.id, pin: randomPin() }, 201);
  }],
  ['post', /^\/guests\/(\d+)\/one-time-accesses$/, (m, body) => {
    const user = findUser(Number(m[1]));
    const access: OneTimeAccess = {
      id: nextId(),
      user_id: user.id,
      start_date: String(body.start_date),
      end_date: String(body.end_date),
      start_time: String(body.start_time),
      end_time: String(body.end_time),
    };
    user.one_time_access = [...(user.one_time_access ?? []), access];
    return ok({ status: 'One-time access created', access_id: access.id, pin: randomPin() }, 201);
  }],
  ['delete', /^\/guests\/recurring-schedules\/(\d+)$/, (m) => {
    state.users.forEach((user) => {
      user.recurring_schedules = (user.recurring_schedules ?? []).filter((item) => item.id !== Number(m[1]));
    });
    return ok(null, 204);
  }],
  ['delete', /^\/guests\/one-time-accesses\/(\d+)$/, (m) => {
    state.users.forEach((user) => {
      user.one_time_access = (user.one_time_access ?? []).filter((item) => item.id !== Number(m[1]));
    });
    return ok(null, 204);
  }],

  ['get', /^\/api-keys$/, () => ok(state.apiKeys)],
  ['post', /^\/api-keys$/, (_m, body) => {
    const key = `demo_${Math.random().toString(36).slice(2, 14)}`;
    const apiKey: ApiKey = {
      key_suffix: key.slice(-4),
      description: String(body.description ?? ''),
      created_at: new Date().toISOString(),
      is_active: true,
      user_id: Number(body.user_id),
      api_key: key,
    };
    state.apiKeys.push({ ...apiKey, api_key: undefined });
    return ok(apiKey, 201);
  }],
  ['delete', /^\/api-keys\/([^/]+)$/, (m) => {
    state.apiKeys = state.apiKeys.filter((item) => item.key_suffix !== m[1]);
    return ok(null, 204);
  }],

  ['post', /^\/notification-devices$/, () => ok({}, 201)],
  ['post', /^\/notification-devices\/test$/, () => ok({ sent: false, results: [] })],
];

const parseBody = (data: unknown): Body => {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Body;
    } catch {
      return {};
    }
  }
  return data as Body;
};

const pathOf = (config: InternalAxiosRequestConfig) => {
  const url = (config.url ?? '').replace(config.baseURL ?? '', '');
  return url.split('?')[0];
};

const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
  data,
  status,
  statusText: String(status),
  headers: {},
  config,
  request: {},
});

export const demoAdapter: AxiosAdapter = async (config) => {
  // A short pause makes the demo behave like a real network round trip.
  await new Promise((resolve) => setTimeout(resolve, 120));

  const method = (config.method ?? 'get').toLowerCase();
  const path = pathOf(config);
  const body = parseBody(config.data);

  for (const [routeMethod, pattern, handler] of routes) {
    const match = path.match(pattern);
    if (routeMethod !== method || !match) continue;

    try {
      const result = handler(match, body, (config.params ?? {}) as Body);
      return respond(config, result.status ?? 200, JSON.parse(JSON.stringify(result.data ?? null)));
    } catch (error) {
      if (error instanceof DemoHttpError) {
        const response = respond(config, error.status, { error: { detail: error.message } });
        throw new AxiosError(error.message, String(error.status), config, response.request, response);
      }
      throw error;
    }
  }

  const response = respond(config, 404, { error: { detail: 'Not available in the demo.' } });
  throw new AxiosError('Not available in the demo.', '404', config, response.request, response);
};
