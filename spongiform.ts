type FieldType = AtomType | IndexType | AliasType | ConstraintType | RelationType
// these are the field kinds that don't actually affect the database
const VirtualFields = ['relation', 'alias']

interface AtomType {
    kind: 'atom'
    constraints: string
    sqlType: string
    jsType: string
}

interface IndexType {
    kind: 'index'
    definition: string
}

interface AliasType {
    kind: 'alias'
    name: string
}

interface ConstraintType {
    kind: 'constraint'
    definition: string
}

interface RelationType {
    kind: 'relation'
    cardinality: 'one' | 'many'
    source: string
    destination: string
}

export function makeAtomicType(sqlType, jsType) {
    return function(constraints = ''): AtomType {
        return {
            kind: 'atom',
            sqlType: sqlType,
            jsType: jsType,
            constraints: constraints,
        }
    }
}

function makeRelationType(cardinality: RelationType['cardinality']) {
    return function(source: string, destination: string): RelationType {
        return {
            kind: 'relation',
            cardinality: cardinality,
            source: source,
            destination: destination,
        }
    }
}

function validateRelation(schema: SCHEMA, tableName: string, colName: string, ast: RelationType) {
    let [srcTable, srcCol] = ast.source.split('.')
    let [destTable, destCol] = ast.destination.split('.')
    let ctx = `In relation ${tableName}.${colName}, `
    assert(
        srcTable === tableName,
        ctx + `source table ${srcTable} does not match current table ${tableName}`
    )
    for (let [table, col, type] of [
        [srcTable, srcCol, 'source'],
        [destTable, destCol, 'referenced'],
    ]) {
        assert(table in schema, ctx + `${type} table ${table} was not found`)
        assert(col in schema[table], ctx + `${type} column ${table}.${col} was not found`)
        assert(
            schema[table][col].kind === 'atom',
            ctx + `${type} column ${table}.${col} must not be relation`
        )
    }
    assert(
        schema[destTable][destCol].kind === 'atom',
        ctx + `source column ${srcTable}.${srcCol} must not be relation`
    )
    assert(
        (schema[srcTable][srcCol] as AtomType).sqlType ===
            (schema[destTable][destCol] as AtomType).sqlType,
        ctx +
            `Source column ${srcTable}.${srcCol} and referenced 
                        column ${destTable}.${destCol} must have same type`
    )
}

const renameSymbol = Symbol.for('RENAME')
export function RENAME<T>(oldName: string, object: T): T {
    object[renameSymbol] = oldName
    return object
}

type TableType = {
    [key: string]: FieldType
}

export type SCHEMA = {
    [key: string]: TableType
}

export const INTEGER = makeAtomicType('INTEGER', 'number')
export const REAL = makeAtomicType('REAL', 'number')
export const TEXT = makeAtomicType('TEXT', 'string')
export const BLOB = makeAtomicType('BLOB', 'buffer')

export const RELATION_ONE = makeRelationType('one')
export const RELATION_MANY = makeRelationType('many')

export function INDEX(definition: string): IndexType {
    return {
        kind: 'index',
        definition: definition,
    }
}

export function CONSTRAINT(definition: string): ConstraintType {
    return {
        kind: 'constraint',
        definition: definition,
    }
}

export function ALIAS(name: string): AliasType {
    return {
        kind: 'alias',
        name: name,
    }
}

function validateName(name: string) {
    assert(/^[a-z_]+$/i.test(name), `Invalid column name "${name}"`)
}

export function validateSchema(schema: SCHEMA) {
    for (let tableName in schema) {
        validateName(tableName)
        let table = schema[tableName]
        for (let columnName in table) {
            validateName(columnName)
            let column = table[columnName]
            if (column.kind === 'relation') {
                validateRelation(schema, tableName, columnName, column)
            } else if (column.kind === 'alias') {
                assert(
                    column.name in table,
                    `Alias ${columnName} refers to non-existent column ${column.name}`
                )
            }
        }
    }
}

function diff_keys(a, b, cmp = 'diff') {
    let fn = cmp === 'same' ? x => x >= 0 : x => x < 0
    return Object.keys(a).filter(k => fn(Object.keys(b).indexOf(k)))
}

function assert(cond, message) {
    if (!cond) throw new Error(message)
}

function applyChange(
    prev,
    next,
    driver: {
        rename?(oldName: string, newName: string)
        change?(name: string, prev: any, next: any)
        create?(name: string, def: any)
        drop?(name: string)
    }
) {
    let renamed: { [key: string]: string } = {}
    for (let name of diff_keys(next, prev)) {
        if (name.startsWith('__')) continue
        let def = next[name]
        if (driver.rename && (def as any)[renameSymbol]) {
            let oldName = (def as any)[renameSymbol]
            renamed[oldName] = name
            assert(
                oldName in prev,
                `${name} is renamed from non-existent ${oldName}.
                Has the rename already completed? If so, remove the RENAME clause from your
                schema definition.`
            )
            assert(!(oldName in next), `${oldName} is to be renamed but still exists`)
            driver.rename(oldName, name)
            driver.change(name, prev[oldName], next[name])
        } else {
            assert(!!driver.create, `Driver does not implement "create" method`)
            driver.create(name, def)
        }
    }
    for (let name of diff_keys(prev, next)) {
        if (name.startsWith('__')) continue
        if (name in renamed) continue
        assert(!!driver.drop, `Driver does not implement "drop" method`)
        driver.drop(name)
    }
    for (let name of diff_keys(next, prev, 'same')) {
        if (name.startsWith('__')) continue
        assert(!!driver.change, `Driver does not implement "change" method`)
        driver.change(name, prev[name], next[name])
    }
}

// https://gist.github.com/jonurry/d92265f98b0322a5e994894f076c2b2c
function deepEqual(a: any, b: any) {
    if (a === b) return true
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
        let keys = Object.keys(a).concat(Object.keys(b))
        keys = keys.filter((value, index, self) => self.indexOf(value) === index)
        for (let p of keys) {
            if (typeof a[p] === 'object' && typeof b[p] === 'object') {
                if (deepEqual(a[p], b[p]) === false) return false
            } else if (a[p] !== b[p]) return false
        }
        return true
    } else return false
}

export function createMigration(prev: SCHEMA, next: SCHEMA) {
    validateSchema(prev)
    validateSchema(next)

    let s = ''
    let schema = JSON.parse(JSON.stringify(prev))

    function createIndex(tableName: string, colName: string, col: IndexType) {
        let defn = col.definition
        if (!defn.includes('(')) defn = '(' + defn + ')'
        s += `CREATE INDEX ${tableName}_${colName} ON ${tableName} ${defn};\n`
        schema[tableName][colName] = INDEX(col.definition)
    }

    applyChange(prev, next, {
        create(tableName, table: TableType) {
            s += `CREATE TABLE ${tableName} (\n`
            let parts = []
            schema[tableName] = {}
            for (let colName in table) {
                let col = table[colName]
                if (col.kind === 'atom') {
                    parts.push(`${colName} ${col.sqlType} ${col.constraints}`.trim())
                    schema[tableName][colName] = makeAtomicType(col.sqlType, col.jsType)(
                        col.constraints
                    )
                } else if (VirtualFields.includes(col.kind)) {
                    // relations don't affect the database, so they always apply
                    schema[tableName][colName] = col
                }
            }
            s += '\t' + parts.join(',\n\t') + '\n'
            for (let colName in table) {
                let col = table[colName]
                if (col.kind === 'constraint') {
                    s += `\tCONSTRAINT ${colName} ${col.definition}\n`
                    schema[tableName][colName] = CONSTRAINT(col.definition)
                }
            }
            s += ');\n'
            for (let colName in table) {
                let col = table[colName]
                if (col.kind === 'index') {
                    createIndex(tableName, colName, col)
                }
            }
            s += '\n'
        },
        rename(oldName, newName) {
            s += `ALTER TABLE ${oldName} RENAME TO ${newName};\n`
            schema[newName] = schema[oldName]
            delete schema[oldName]
        },
        drop(tableName) {
            assert(
                /^depr/i.test(tableName),
                `${tableName} must be renamed to "deprecated_${tableName} before it can be deleted"`
            )
            s += `DROP TABLE ${tableName};\n\n`
            delete schema[tableName]
        },
        change(tableName: string, prevTable: TableType, nextTable: TableType) {
            applyChange(prevTable, nextTable, {
                create(colName, col: FieldType) {
                    if (col.kind == 'index') {
                        createIndex(tableName, colName, col as IndexType)
                    } else if (col.kind == 'atom') {
                        s +=
                            `ALTER TABLE ${tableName} ADD COLUMN ${colName} ${col.constraints}`.trim() +
                            ';\n'
                        schema[tableName][colName] = makeAtomicType(col.sqlType, col.jsType)(
                            col.constraints
                        )
                    } else if (VirtualFields.includes(col.kind)) {
                        schema[tableName][colName] = col
                    }
                },
                rename(oldName, newName) {
                    let col = prevTable[oldName]
                    if (col.kind === 'atom') {
                        s += `ALTER TABLE ${tableName} RENAME COLUMN ${oldName} TO ${newName};\n`
                        schema[tableName][newName] = schema[tableName][oldName]
                        delete schema[tableName][oldName]
                    } else if (VirtualFields.includes(col.kind)) {
                        schema[tableName][newName] = schema[tableName][oldName]
                        delete schema[tableName][oldName]
                    }
                },
                change(colName, prev, next) {
                    if (VirtualFields.includes(prev.kind)) {
                        schema[tableName][colName] = next
                    } else {
                        console.log(colName, prev, next)
                    }
                },
                drop(colName) {
                    let col = prevTable[colName]
                    if (col.kind == 'index') {
                        s += `DROP INDEX ${tableName}_${colName}`
                        delete schema[tableName][colName]
                    } else if (VirtualFields.includes(col.kind)) {
                        delete schema[tableName][colName]
                    }
                },
            })
        },
    })

    if (!deepEqual(schema, next)) {
        throw new Error('Unable to create migration')
    }

    return s
}

// function unindent(parts) {
//     let prefix = Math.min(
//         ...parts[0]
//             .split('\n')
//             .filter(k => k.trim() != '')
//             .map(k => k.match(/^(\s*)[^\s]/)[1].length)
//     )
//     return parts[0]
//         .split('\n')
//         .map(k => k.slice(prefix))
//         .join('\n')
//         .trim()
// }

export const WHERE = '__WHERE'
export const LIMIT = '__LIMIT'
export const ORDER = '__ORDER'
export const GROUP = '__GROUP'

type ExprAST = {
    __role: 'expr'
    __internal: any
    __meta: {}
}

export function EXPR(parts, ...splice): ExprAST {
    return {
        __internal: null,
        __role: 'expr',
        __meta: {},
    }
}

export interface Field<T> {
    __internal: T
    __role: 'leaf'
    __meta: {
        id: string
        column: string
    }
}

export type Relation<Z> = <T extends MapResult>(fn: (handle: Z) => T) => RelationAST<T>

type MapResult = {
    [key: string]: QueryAST
}

type RelationAST<T extends MapResult> = {
    __internal: {
        [key in keyof T]: T[key]['__internal']
    }
    __role: 'relation'
    __meta: {
        id: string
        table: string
        fields: { [key: string]: QueryAST }
        where: QueryAST[]
        limit: QueryAST
        order: QueryAST
        group: QueryAST
    }
}

type OneQuery = {
    __role: 'one'
    __internal: any
    __meta: {
        query: QueryAST
    }
}

type QueryAST = RelationAST<any> | Field<any> | OneQuery | ExprAST

let varCounter = 0

export function makeTable<T>(schema: SCHEMA, tableName: string) {
    let table = schema[tableName]
    assert(table, `Table ${tableName} not found in schema`)
    return function<V extends MapResult>(fn: (handle: T) => V): RelationAST<V> {
        varCounter++
        let id = 'X' + varCounter
        let inputObject: any = {}

        for (let colName in table) {
            let col = table[colName]
            let origColName = colName
            while (col.kind === 'alias') {
                col = table[(col as AliasType).name]
            }
            if (col.kind === 'atom') {
                inputObject[colName] = {
                    __internal: null,
                    __role: 'leaf',
                    __meta: {
                        id: id,
                        column: origColName,
                    },
                } as Field<any>
            } else if (col.kind === 'relation') {
                let [destTable, destCol] = col.destination.split('.')
                let [, srcCol] = col.source.split('.')
                let cardinality = col.cardinality
                inputObject[colName] = (fn): QueryAST => {
                    // let t = makeTable(schema, destTable)(fn)
                    let where
                    let t = makeTable(schema, destTable)((handle: any) => {
                        where = EXPR`${inputObject[srcCol]} = ${handle[destCol]}`
                        return fn(handle)
                    })
                    t.__meta.where.push(where)
                    // t.__meta.where.push(
                    //     EXPR`${id}.${srcCol} = @.${destCol}`)
                    // t.__meta.where.push(
                    //     EXPR`${inputObject[srcCol]} = @.${destCol}`)
                    return cardinality === 'one' ? ONE(t) : t
                }
            }
        }
        let res = fn(inputObject as any)
        return {
            __internal: null,
            __role: 'relation',
            __meta: {
                id: id,
                table: tableName,
                fields: res as any,
                where: res[WHERE] ? [res[WHERE]] : [],
                order: res[ORDER] ? res[ORDER] : null,
                limit: res[LIMIT] ? res[LIMIT] : null,
                group: res[GROUP] ? res[GROUP] : null,
            },
        }
        // return out as any
    }
}

export function ONE(query: QueryAST): OneQuery {
    return {
        __role: 'one',
        __internal: null,
        __meta: {
            query: query,
        },
    }
}

function indent(s) {
    return s
        .split('\n')
        .map(k => '\t' + k)
        .join('\n')
}

export function generateSQL(ast: QueryAST) {
    function helper(ast: QueryAST, agg: 'one' | 'many' | 'table' | 'one_table') {
        if (ast.__role === 'leaf') {
            return `${ast.__meta.id}.${ast.__meta.column}`
        }
        if (ast.__role === 'one') {
            agg = agg === 'table' ? 'one_table' : 'one'
            ast = ast.__meta.query
        }

        if (ast.__role === 'expr') {
            return '42'
        }

        if (ast.__role === 'relation') {
            let s = ''

            if (agg === 'many') {
                s += 'SELECT json_group_array(json_object(\n'
            } else if (agg === 'one') {
                s += 'SELECT json_object(\n'
            } else if (agg === 'one_table' || agg === 'table') {
                s += 'SELECT \n'
            }

            let chunks = []
            for (let field in ast.__meta.fields) {
                if (field.startsWith('__')) continue
                let subsql = helper(ast.__meta.fields[field], 'many')
                if (subsql.indexOf('\n') != -1) {
                    subsql = '(' + indent(subsql).trim() + ')'
                }
                if (agg === 'table' || agg === 'one_table') {
                    chunks.push(`${subsql} as ${field}`)
                } else {
                    chunks.push(`'${field}', ${subsql}`)
                }
            }

            s += '\t' + chunks.join(',\n\t') + '\n'
            if (agg === 'many') {
                s += ')) '
            } else if (agg === 'one') {
                s += ') '
            } else if (agg === 'one_table' || agg === 'table') {
                s += ''
            }

            s += `FROM ${ast.__meta.table} ${ast.__meta.id}\n`

            if (ast.__meta.where.length > 0) {
                s += 'WHERE ' + ast.__meta.where.join(' AND ') + '\n'
            }

            if (ast.__meta.limit) {
                s += `LIMIT ${ast.__meta.limit}\n`
            } else if (agg === 'one' || agg === 'one_table') {
                s += 'LIMIT 1\n'
            }

            return s
        }
    }

    return helper(ast, 'table')
}

export async function SELECT<K extends MapResult, T extends RelationAST<K>>(
    query: T
): Promise<T['__internal']> {
    return null as any
}

export function generateTypescript(schema: SCHEMA) {
    let s = `import { makeTable, Relation, Field, SCHEMA } from './spongiform'\n\n`

    s += 'const schema: SCHEMA = ' + JSON.stringify(schema) + '\n\n'

    for (let tableName in schema) {
        s += `export const ${tableName} = makeTable<${tableName}Handle>(schema, "${tableName}")\n`
        s += `type ${tableName}Handle = {\n`
        let table = schema[tableName]
        for (let colName in table) {
            let col = table[colName]
            while (col.kind === 'alias') {
                col = table[(col as AliasType).name]
            }
            if (col.kind === 'atom') {
                s += `\t${colName}: Field<${col.jsType}>\n`
            } else if (col.kind === 'relation') {
                let [destTable] = col.destination.split('.')
                s += `\t${colName}: Relation<${destTable}Handle>\n`
            }
        }
        s += '}\n\n'
    }
    return s
}
