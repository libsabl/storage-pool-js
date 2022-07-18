// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { StorageKind, StorageMode } from '$';

describe('enums', () => {
  it('retrieves defined values', () => {
    expect('graph' in StorageKind).toBe(true);
    expect('txn' in StorageMode).toBe(true);
  });
});
