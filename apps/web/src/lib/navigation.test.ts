import assert from 'node:assert/strict';
import { test } from 'node:test';

import { safeInternalPath } from './navigation.ts';

test('preserves local paths and query strings', () => {
    assert.equal(
        safeInternalPath('/oauth/authorize?request_id=request'),
        '/oauth/authorize?request_id=request',
    );
});

test('rejects browser-normalized external return paths', () => {
    for (const unsafePath of [
        '//evil.example/phish',
        '///evil.example/phish',
        '/\n//evil.example/phish',
        '/\r//evil.example/phish',
        '/\t//evil.example/phish',
        '/\\evil.example/phish',
        '/safe#fragment',
        'https://evil.example/phish',
    ]) {
        assert.equal(safeInternalPath(unsafePath), '/', unsafePath);
    }
});
