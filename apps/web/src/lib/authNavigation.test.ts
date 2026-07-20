import assert from 'node:assert/strict';
import { test } from 'node:test';

import { authenticationRedirect, isPublicAuthRoute } from './authNavigation.ts';

test('signed-out users stay on OAuth consent to use its embedded sign-in form', () => {
    assert.equal(isPublicAuthRoute('/oauth/authorize'), true);
    assert.equal(authenticationRedirect('/oauth/authorize'), null);
    assert.equal(authenticationRedirect('/settings'), '/login');
});

test('an expired session does not redirect away from OAuth consent', () => {
    assert.equal(authenticationRedirect('/oauth/authorize'), null);
    assert.equal(authenticationRedirect('/'), '/login');
});
