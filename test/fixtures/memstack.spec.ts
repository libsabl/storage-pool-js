// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

// Note: These tests are intentionally note included
// in the main pnpm test run. They are present for
// debugging and edification to explore the MemStack*
// implementation included here, which is entirely
// for example purposes. To run these test,
// use `pnpx jest --projects ./text/fixtures/jest.config.js`

import { Context } from '@sabl/context';
import { openStackPool } from '.';

describe('MemStackPool', () => {
  it('uses stack', async () => {
    const stack: unknown[] = [];
    const pool = openStackPool(stack);
    await pool.push(Context.background, 'a');
    expect(stack).toEqual(['a']);
  });
});
