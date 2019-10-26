function createDriver(originalSchema) {
    let schema = JSON.parse(JSON.stringify(originalSchema))
    let s = ''
    return {
        getSQL() {
            return s
        },
        getSchema() {
            return schema
        },
        createTable(tableName, table) {
            console.log('add table', tableName)
            s += `CREATE TABLE ${tableName} (\n`
            let parts = []
            for (let colName in table) {
                let col = table[colName]
                if (col.kind === 'atom') {
                    parts.push(
                        `${colName} ${(col as AtomType).sqlType} ${
                            (col as AtomType).constraints
                        }`.trim()
                    )
                }
            }
            s += '\t' + parts.join(',\n\t') + '\n'
            s += ');\n\n'
        },
        addColumn(tableName, colName, col) {
            console.log('added column', tableName, colName)
            if (col.kind === 'atom') {
                s += `ALTER TABLE ${tableName} ADD ${colName} ${(col as AtomType).sqlType} ${
                    (col as AtomType).constraints
                }`.trim()
                s += ';\n\n'
            }
        },
        renameColumn(tableName, oldName, colName) {
            console.log('renamed column', tableName, oldName, '->', colName)
            s += `ALTER TABLE ${tableName} RENAME COLUMN ${oldName} TO ${colName};\n\n`
        },
        dropColumn(tableName, colName) {
            console.log('removed column', tableName, colName)
            s += `ALTER TABLE ${tableName} DROP ${colName};\n\n`
        },
        renameTable(oldName, newName) {
            console.log('rename table', oldName, '->', newName)
            s += `ALTER TABLE ${oldName} RENAME TO ${newName};\n\n`
        },
        dropTable(tableName) {
            console.log('drop table', tableName)
            s += 'DROP TABLE ${tableName};\n\n'
        },
    }
}

export function createMigration(prev: SCHEMA, next: SCHEMA) {
    let renamedTables: { [key: string]: string } = {}
    let driver = createDriver(prev)

    const changeTable = (tableName, prevTable, nextTable) => {
        let renamedColumns: { [key: string]: string } = {}
        for (let colName of diff_keys(nextTable, prevTable)) {
            let col = nextTable[colName]
            if ((col as any)[renameSymbol]) {
                let oldName = (col as any)[renameSymbol]
                renamedColumns[oldName] = colName
                driver.renameColumn(tableName, oldName, colName)
            } else {
                driver.addColumn(tableName, colName, col)
            }
        }
        for (let colName of diff_keys(prevTable, nextTable)) {
            // TODO: make sure that columns must start with "DEPRECATED_"
            // before you can remove them
            driver.dropColumn(tableName, colName)
        }

        for (let colName of diff_keys(nextTable, prevTable, 'same')) {
            console.log('updated column', tableName, colName)
        }
    }

    // tables which have been added
    for (let tableName of diff_keys(next, prev)) {
        let table = next[tableName]

        if ((table as any)[renameSymbol]) {
            let oldName = (table as any)[renameSymbol]
            renamedTables[oldName] = tableName
            assert(oldName in prev, `${tableName} is renamed from non-existent table`)
            assert(!(oldName in next), `${oldName} is to be renamed but still exists`)
            driver.renameTable(oldName, tableName)
            changeTable(tableName, prev[oldName], table)
        } else {
            driver.createTable(tableName, table)
        }
    }

    // tables which have been removed
    for (let tableName of diff_keys(prev, next)) {
        if (tableName in renamedTables) continue
        // TODO: make sure that tables have to start with "DEPRECATED_"
        // before you can remove them
        driver.dropTable(tableName)
    }

    // tables which may have been modified
    for (let tableName of diff_keys(next, prev, 'same')) {
        let prevTable = prev[tableName]
        let nextTable = next[tableName]
        changeTable(tableName, prevTable, nextTable)
    }

    console.log(driver.getSQL())
}

interface Field {
    type: any
}

interface StringField extends Field {
    type: string
}

type PostHandle = {
    name: StringField
}

function Post<
    T extends {
        [key: string]: Field
    }
>(
    fn: (handle: PostHandle) => T
): {
    [key in keyof T]: T[key]
} {
    return null as any
}

async function SELECT<T>(query: T): Promise<{}> {
    return null as any
}

SELECT(
    Post(p => ({
        my_name: p.name,
    }))
)

interface Field {
    __internal: any
}

interface StringField extends Field {
    __internal: string
}

type PostHandle = {
    name: StringField
    title: StringField
}

type PostResult<
    T extends {
        [key: string]: Field
    }
> = {
    __internal: {
        [key in keyof T]: T[key]['__internal']
    }
}

function Post<
    T extends {
        [key: string]: Field
    }
>(fn: (handle: PostHandle) => T): PostResult<T> {
    return null as any
}

async function SELECT<
    K extends {
        [key: string]: Field
    },
    T extends PostResult<K>
>(query: T): Promise<T['__internal']> {
    return null as any
}

async function merp() {
    let blah = await SELECT(
        Post(p => ({
            my_name: p.name,
            subpost: Post(k => ({
                rawr: k.title,
            })),
        }))
    )
}

interface Field {
    __internal: any
}

const where = Symbol.for('where')

type Fielder = {
    [where]?: string
    [key: string]: Field
}

interface StringField extends Field {
    __internal: string
}

interface NumberField extends Field {
    __internal: number
}

type PostHandle = {
    name: StringField
    title: StringField
    age: NumberField
    comments<T extends Fielder>(fn: (handle: PostHandle) => T): PostResult<T>
}

type PostResult<T extends Fielder> = {
    __internal: {
        [key in keyof T]: T[key]['__internal']
    }
}

function Post<T extends Fielder>(fn: (handle: PostHandle) => T): PostResult<T> {
    return null as any
}

async function SELECT<K extends Fielder, T extends PostResult<K>>(
    query: T
): Promise<T['__internal']> {
    return null as any
}

async function merp() {
    let blah = await SELECT(
        Post(p => ({
            [where]: 'asdf',
            my_name: p.name,
            comments: p.comments(j => ({
                hallu: j.age,
            })),
            subpost: Post(k => ({
                rawr: k.title,
            })),
        }))
    )
}
