<!-- BEGIN:REMOVE_FOR_NPM -->
[![codecov](https://codecov.io/gh/libsabl/storage-pool-js/branch/main/graph/badge.svg?token=TVL1XYSJHA)](https://app.codecov.io/gh/libsabl/storage-pool-js/branch/main)
<span class="badge-npmversion"><a href="https://npmjs.org/package/@sabl/storage-pool" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@sabl/storage-pool.svg" alt="NPM version" /></a></span>

<!-- END:REMOVE_FOR_NPM -->

# @sabl/storage-pool

**storage-pool** is a simple, [context](https://github.com/libsabl/patterns/blob/main/patterns/context.md)-aware pattern for describing connection pooling and storage transactions agnostic of the underlying storage type.

The interfaces defined in this package set consistent expectations for how storage services should expose basic pool and connection types. They are based on the connection lifecycle APIs in the go standard library [`database/sql` package](https://pkg.go.dev/database/sql).  One minor difference is the that `commit` and `rollback` methods of the `Txn` interface accept a [context](./context.md).
  
For more detail on the storage-pool pattern, see sabl / [patterns](https://github.com/libsabl/patterns#patterns) / [storage-pool](https://github.com/libsabl/patterns/blob/main/patterns/storage-pool.md).

<!-- BEGIN:REMOVE_FOR_NPM -->
> [**sabl**](https://github.com/libsabl/patterns) is an open-source project to identify, describe, and implement effective software patterns which solve small problems clearly, can be composed to solve big problems, and which work consistently across many programming languages.

## Developer orientation

See [SETUP.md](./docs/SETUP.md), [CONFIG.md](./docs/CONFIG.md).
<!-- END:REMOVE_FOR_NPM -->

### Compatibility with `@sabl/txn`

This package does **not** depend on [`@sabl/txn`](https://www.npmjs.com/package/@sabl/txn), but the `StorageTxn` type defined here is compatible with the [`Txn` interface](https://github.com/libsabl/txn-js#txn-interface) in `@sabl/txn`, and `StoragePool` and `StorageConn` are compatible with the [`Transactable` interface](https://github.com/libsabl/txn-js#transactable-interface) in `@sabl/txn`.

## API

### StorageAPI

An abstraction of all storage API types, exposing two enumeration properties that provide some clues about the type of the API instance.

```ts
export interface StorageApi {
  readonly mode: StorageMode;
  readonly kind: StorageKind | string;
}
```

#### StorageMode

Represents the basic type of the API instance: pool, connection, or transaction.

```ts
export enum StorageMode {
  pool = 1,
  conn = 2,
  txn = 3,
}
```

#### StorageKind

Extensible string enumeration describing the basic underlying storage type, such as relational, document, graph, etc. Authors may use their own values not defined here.

```ts
export enum StorageKind {
  unknown = 'unknown',
  rdb = 'relational',
  doc = 'document',
  graph = 'graph',
  keyval = 'key-value',
  widecol = 'wide-column',
}
```

### StoragePool

```ts
interface StoragePool extends StorageApi { 
  conn(ctx: IContext): Promise<StorageConn>; 
  beginTxn(ctx: IContext, opts?: TxnOptions): Promise<StorageTxn>;
  close(): Promise<void>;
}
```

A pool of storage connections.

Implementations of `StoragePool` should return `StorageMode.pool` for their `mode` property.

#### `conn`
Retrieves a connection from the pool. The context provided may be cancelable, and if the context is canceled before a connection becomes available then `conn` should throw an exception. The resolved connection should already be open.

**If ctx is canceled**: Any ongoing operations on the connection returned from `conn` are immediately aborted, and the connection is closed and returned to the pool.

#### `beginTxn`
Begins a transaction on a transient connection that will be returned to the pool when the transaction completes. Implementers should respect a cancelable context and rollback the transaction if the context is canceled before the transaction is committed.|

**If ctx is canceled**: Any ongoing operations on the transaction returned from `beginTxn` are immediately aborted, the transaction is rolled back, and the underlying connection is closed and returned to the pool 

#### `close`
Closes the entire pool. Pools are meant to be long-lived and concurrent-safe, so this is generally only used on graceful program termination. Should resolve when all connections have been gracefully terminated. 

### StorageConn

```ts
export interface StorageConn extends StorageApi {
  beginTxn(ctx: IContext, opts?: unknown): Promise<StorageTxn>;
  close(): Promise<void>;
}
```

An open connection to a storage provided. Maintains session state such as variables, temporary tables, and transactions. Users of a connection are expected to ensure the connection is closed when they are done with it.

Implementations of `StorageConn` should return `StorageMode.conn` for their `mode` property.

#### `beginTxn`
Begins a transaction on the connection. Implementers should respect a cancelable context and rollback the transaction if the context is canceled before the transaction is committed.

**If ctx is canceled**: Any ongoing operations on the transaction returned from `beginTxn` are immediately aborted and the transaction is rolled back, but the connection itself remains open. 

#### `close`
Closes the connection, waiting for all ongoing operations and transactions to complete. If the connection was obtained from a pool, this should release the connection back to the pool rather than terminating the underlying connection.


### StorageTxn

```ts
interface StorageTxn extends StorageApi {
  commit(ctx: IContext): Promise<void>;
  rollback(ctx: IContext): Promise<void>;
}
```

An active storage transaction. 

Implementations of `StorageTxn` should return `StorageMode.txn` for their `mode` property.

#### `commit`
Commits and closes the transaction. 

**If ctx is canceled**: The commit is immediately aborted, if possible, and instead the transaction is rolled back. 

#### `rollback`
Rolls back and closes the transaction.

**If ctx is canceled**: Nothing happens, as the transaction is already rolling back. ctx is still provided for state and dependency injection.

## Concepts
 
Many storage clients are able to pool connections to a remote data store. Consuming code should retrieve a connection from the pool when it needs one, and promptly return the connection when the work is done, whether or not the work was successful.

These concepts are represented by the `StoragePool` and `StorageConn` interfaces.

Some storage services also support transactions. A transaction represents a series of actions whose effects either all succeed or all fail together. A transaction is represented by the `StorageTxn` interface.

### Type-Specific CRUD APIs

Many storage client libraries will expose the same type-specific CRUD APIs on all three basic types - pool, connection, and transaction.

For example, a document store would support APIs such as `insertOne`, `updateMany`, and `find`:

```ts
/** Example: Common Doc store API */
interface DocStoreAPI {
  insertOne(ctx: IContext, collection: string, doc:Doc, opts): Promise<void>;
  insertMany(ctx: IContext, collection: string, docs: Doc[], opts): Promise<void>;
  find(ctx: IContext, collection: string, filter: any): Promise<Cursor>;
  ... etc ...
}
```

All of these APIs are inherited by a `DocStorePool`, `DocStoreConn`, and `DocStoreTxn`. 
- If invoked directly on a pool, a connection is automatically acquired, used, and then released as soon as the operation is complete. 
- If invoked on a connection, the connection is left open for subsequent operations
- If invoked on a transaction, the transaction is left uncommitted for subsequent operations

The actual makeup of the common storage API differs by storage type. However, this library still defines a very simple base `StorageAPI` that exposes two read-only properties that allow consuming code to make basic decisions about an implementing instance without having to use fickle reflection methods such as `instanceof`.

#### Example: StackAPI

The tests of this library include a minimal but accurate example of both the interfaces and an implementation for a type-specific api, using a simple stack as the underlying 'data store'. See [source](https://github.com/libsabl/storage-pool-js/blob/main/test/fixtures/index.ts) for details.

```ts
// EXAMPLE, included in test/fixtures of this repo:

// StackApi is the basic stack ops: push, peek, pop
export interface StackApi extends StorageApi {
  push(ctx: IContext, val: unknown): Promise<number>;
  peek(ctx: IContext): Promise<unknown>;
  pop(ctx: IContext): Promise<unknown>;
}

// StackTxn is a composition of the basic StorageTxn
// (commit, rollback) with the StackApi
export interface StackTxn extends StorageTxn, StackApi {}

// Overrides basic Transactable so that the return
// value is a StackTxn
export interface StackTransactable extends Transactable {
  beginTxn(ctx: IContext, opts?: TxnOptions): Promise<StackTxn>;
}

// Composition that is structurally compatible with StorageConn
export interface StackConn extends StackApi, StackTransactable {
  close(): Promise<void>;
}

// Composition that is structurally compatible with StoragePool
export interface StackPool extends StackApi, StackTransactable {
  conn(ctx: IContext): Promise<StackConn>;
  close(): Promise<void>;
}
```
