const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const React = require('react');
const { act, create } = require('react-test-renderer');
const ts = require('typescript');

global.IS_REACT_ACT_ENVIRONMENT = true;
const Context = React.createContext(null);
const serverUrl = 'https://door-api.example.com';
const demoUrl = 'https://demo.anlok.invalid';
const demoUser = { id: 2 };
const normalize = (url) => url.trim().replace(/\/+$/, '');
const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/screens/ServerSetupScreen.tsx'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } },
).outputText;

async function setup({ initialUrl = '', initialUser = null, healthError = false } = {}) {
  const routes = [];
  const events = [];
  let observed;
  const router = {
    replace(route) {
      // A protected destination must already be available when navigation runs.
      assert.ok(observed.apiUrl);
      assert.equal(route, observed.user ? '/' : '/login');
      routes.push(route);
    },
    canGoBack: () => false,
    back: () => assert.fail('Must choose the destination from the saved session'),
  };
  const axios = {
    get: async () => {
      if (healthError) throw new Error('Offline');
      return { data: { status: 'ok' } };
    },
    isAxiosError: () => false,
  };
  const ui = Object.fromEntries(
    ['Banner', 'Button', 'FieldLabel', 'Input', 'PageScroll', 'Screen', 'SectionCard'].map(
      (name) => [name, name],
    ),
  );
  const mocks = {
    'react-native': { StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View' },
    axios,
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { useRouter: () => router },
    '../contexts/AuthContext': { useAuth: () => React.useContext(Context).auth },
    '../contexts/ServerConfigContext': { useServerConfig: () => React.useContext(Context).server },
    '../components/common/ui': { ...ui, styles: {}, palette: {} },
    '../lib/api': {
      api: { post: async () => ({ data: { user: demoUser } }) },
      authHeaders: () => ({}),
      normalizeApiUrl: normalize,
      isSupportedApiUrl: (url) => !!url,
    },
    '../lib/demo/demoServer': { DEMO_API_URL: demoUrl, DEMO_TOKEN: 'demo-token' },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports,
    module,
    require: (name) => (name in mocks ? mocks[name] : require(name)),
  });
  const Screen = module.exports.ServerSetupScreen;
  function Providers() {
    const [apiUrl, setApiUrl] = React.useState(initialUrl);
    const [user, setUser] = React.useState(initialUser);
    observed = { apiUrl, user };
    const value = {
      server: {
        apiUrl,
        suggestedApiUrl: serverUrl,
        saveApiUrl: async (next) => {
          events.push('save');
          setApiUrl(normalize(next));
        },
      },
      auth: {
        user,
        logout: async () => { events.push('logout'); setUser(null); },
        login: async (_token, next) => { events.push('login'); setUser(next); },
      },
    };
    return React.createElement(Context.Provider, { value }, React.createElement(Screen));
  }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Providers)); });
  return {
    routes,
    events,
    get observed() { return observed; },
    async changeUrl(url) {
      await act(async () => { renderer.root.findByType('Input').props.onChangeText(url); });
    },
    async press(title) {
      await act(async () => {
        await renderer.root.findAllByType('Button').find((button) => button.props.title === title).props.onPress();
        // The event handler intentionally starts its async action with void.
        await new Promise((resolve) => setImmediate(resolve));
      });
    },
    async close() { await act(async () => renderer.unmount()); },
  };
}

test('first server setup opens sign-in after the server is saved', async () => {
  const app = await setup();
  try {
    await app.press('Test and continue');
    assert.deepEqual(app.routes, ['/login']);
    assert.equal(app.observed.apiUrl, serverUrl);
  } finally { await app.close(); }
});

test('testing the same server keeps the current session', async () => {
  const app = await setup({ initialUrl: serverUrl, initialUser: { id: 1 } });
  try {
    await app.press('Test and continue');
    assert.deepEqual(app.routes, ['/']);
    assert.deepEqual(app.events, ['save']);
  } finally { await app.close(); }
});

test('switching servers signs out before saving and opens sign-in', async () => {
  const app = await setup({ initialUrl: serverUrl, initialUser: { id: 1 } });
  try {
    await app.changeUrl('https://another.example.com');
    await app.press('Test and continue');
    assert.deepEqual(app.events, ['logout', 'save']);
    assert.deepEqual(app.routes, ['/login']);
  } finally { await app.close(); }
});

test('failed connectivity keeps server setup open without saving', async () => {
  const app = await setup({ healthError: true });
  try {
    await app.press('Test and continue');
    assert.deepEqual(app.routes, []);
    assert.deepEqual(app.events, []);
  } finally { await app.close(); }
});

test('demo opens the main screen after the demo session is ready', async () => {
  const app = await setup();
  try {
    await app.press('Try the demo');
    assert.deepEqual(app.routes, ['/']);
    assert.equal(app.observed.apiUrl, demoUrl);
    assert.equal(app.observed.user, demoUser);
  } finally { await app.close(); }
});
