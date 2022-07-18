// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { IContext } from '@sabl/context';
import { StorageKind, StorageMode } from './enums';

export { StorageKind, StorageMode };

/**
 * An abstract representation of a storage API, which
 * could be an entire pool, a single connection, or
 * an open transaction.
 */
export interface StorageApi {
  readonly mode: StorageMode;
  readonly kind: StorageKind | string;
}

/**
 * An abstract representation of a transaction
 * in the context of some storage service.
 */
export interface StorageTxn extends StorageApi {
  /** Commit all pending operations */
  commit(ctx: IContext): Promise<void>;

  /** Rollback all pending operations. */
  rollback(ctx: IContext): Promise<void>;
}

/**
 * An abstract representation of a storage pool or
 * connection that can begin a transaction.
 */
export interface Transactable extends StorageApi {
  /** Begin a transaction on the connection or pool */
  beginTxn(ctx: IContext, opts?: unknown): Promise<StorageTxn>;
}

/**
 * An abstract representation of a storage connection,
 * regardless of the underlying storage type or protocol. It
 * supports the concept of transactions. A connection
 * should call close() to return it to its source pool.
 */
export interface StorageConn extends Transactable {
  /**
   * Return the connection to its source pool. `close` is safe
   * to call concurrently with other operations and will not
   * resolved until all other operations finish.
   */
  close(): Promise<void>;
}

/**
 * An abstract representation of a pool of storage connections,
 * regardless of the underlying storage type or protocol. It
 * supports the concept of transactions.
 */
export interface StoragePool extends Transactable {
  /**
   * Returns a single connection by either opening a new connection
   * or returning an existing connection from the connection pool. conn
   * will not resolve until either a connection is returned or ctx is canceled.
   * Queries run on the same Conn will be run in the same storage session.
   */
  conn(ctx: IContext): Promise<StorageConn>;

  /**
   * Close the entire pool. Pools are meant to be long-lived and concurrent-safe,
   * so this is generally only used on graceful program termination. `close`
   * will wait until all running operations are completed.
   */
  close(): Promise<void>;
}
