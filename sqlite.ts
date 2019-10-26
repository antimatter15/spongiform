import sqliteParser from 'sqlite-parser'
import { SCHEMA, makeAtomicType, createMigration } from './spongiform'

function assert(cond, message = 'Assertion failure') {
  if (!cond) throw new Error(message)
}

const sqlToJS = {
  text: 'string',
  blob: 'buffer',
  integer: 'number',
  real: 'number',
}

function astToSchema(schema) {
  const Schema: SCHEMA = {}
  for (let statement of schema.statement) {
    assert(statement.type == 'statement')
    assert(statement.variant == 'create')
    assert(statement.format == 'table')
    // statement.name

    let table = {}
    for (let def of statement.definition) {
      assert(def.type == 'definition')
      assert(def.variant === 'column')

      table[def.name] = makeAtomicType(def.datatype.variant, sqlToJS[def.datatype.variant])(
        def.definition.map(k => k.variant).join(' ')
      )
    }

    Schema[statement.name.name] = table
  }
  return Schema
}

console.log(
  createMigration(
    astToSchema(
      sqliteParser(`

CREATE TABLE Employees (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL,
  role      TEXT CHECK(role in ('analyst', 'scientist', 'attorney')) NOT NULL,
  team      TEXT CHECK(team in ('labs', 'healthcare')) NOT NULL
);

CREATE TABLE Deals (
  id            INTEGER PRIMARY KEY,
  title         TEXT    NOT NULL,
  ticker        TEXT    NOT NULL,

  thesis        TEXT,
  synthesis     TEXT,

  requested_date    INTEGER,
  started_date      INTEGER,
  completed_date    INTEGER,

  side          TEXT CHECK(side in ('long', 'short')),

  potential_position    INTEGER,
  potential_returns     INTEGER
);
`)
    ),
    astToSchema(
      sqliteParser(`

CREATE TABLE Employees (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL,
  role      TEXT CHECK(role in ('analyst', 'scientist', 'attorney')) NOT NULL,
  team      TEXT CHECK(team in ('labs', 'healthcare')) NOT NULL
);

CREATE TABLE Wumbo (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL,
  role      TEXT CHECK(role in ('analyst', 'scientist', 'attorney')) NOT NULL,
  team      TEXT CHECK(team in ('labs', 'healthcare')) NOT NULL
);

CREATE TABLE Deals (
  id            INTEGER PRIMARY KEY,
  title         TEXT    NOT NULL,
  ticker        TEXT    NOT NULL,

  thesis        TEXT,
  synthesis     TEXT,

  requested_date    INTEGER,
  started_date      INTEGER,
  completed_date    INTEGER,

  side          TEXT CHECK(side in ('long', 'short')),

  potential_position    INTEGER,
  potential_returns     INTEGER
);
`)
    )
  )
)

// var sqliteParser = require('sqlite-parser')
// var query = 'select pants from laundry;'
