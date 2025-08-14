import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

let sqlPromise: Promise<SqlJsStatic> | undefined;

export function getSql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

export async function openDbFromArrayBuffer(buf: ArrayBuffer): Promise<Database> {
  const SQL = await getSql();
  return new SQL.Database(new Uint8Array(buf));
}