interface ColumnType {
    type: string
    [x: string]: any
    validate(schema, tableName, colName)
    make(schema, tableName, colName, varName)
}

const STRING: ColumnType = {
    type: 'STRING',
    validate(schema, tableName, colName) {},
    make(schema, tableName, colName, varName) {
        return varName + '.' + colName
    },
}

const INTEGER: ColumnType = {
    type: 'INTEGER',
    validate(schema, tableName, colName) {},
    make(schema, tableName, colName, varName) {
        return varName + '.' + colName
    },
}

function validateRelation(source, destination) {
    return function(schema, tableName, colName) {
        let [srcTable, srcCol] = source.split('.')
        console.assert(
            srcTable === tableName,
            `In ${tableName}.${colName}, source table ${srcTable} does not match current table ${tableName}`
        )
        console.assert(
            schema[srcTable],
            `In ${tableName}.${colName}, source table ${srcTable} was not found`
        )
        console.assert(
            schema[srcTable][srcCol],
            `In ${tableName}.${colName}, source column ${srcTable}.${srcCol} was not found`
        )
        let [destTable, destCol] = destination.split('.')
        console.assert(
            schema[destTable],
            `In ${tableName}.${colName}, destination table ${destTable} was not found`
        )
        console.assert(
            schema[destTable][destCol],
            `In ${tableName}.${colName}, source column ${destTable}.${destCol} was not found`
        )
        console.assert(
            schema[srcTable][srcCol].type === schema[destTable][destCol].type,
            'Source and destination columns must have same type'
        )
    }
}

function RELATION_ONE(source, destination): ColumnType {
    return {
        type: 'relation_one',
        source: source,
        destination: destination,
        validate: validateRelation(source, destination),
        make(schema, tableName, colName, varName) {
            return function(fn) {
                let [destTable, destCol] = destination.split('.')
                let [srcTable, srcCol] = source.split('.')
                return {
                    ...makeTable(schema, destTable)(fn),
                    where: `${varName}.${srcCol} = @.${destCol}`,
                    relation: 'one',
                }
            }
        },
    }
}

function RELATION_MANY(source, destination): ColumnType {
    return {
        type: 'relation_many',
        validate: validateRelation(source, destination),
        source: source,
        destination: destination,
        make(schema, tableName, colName, varName) {
            return function(fn) {
                let [destTable, destCol] = destination.split('.')
                let [srcTable, srcCol] = source.split('.')
                return {
                    ...makeTable(schema, destTable)(fn),
                    where: `${varName}.${srcCol} = @.${destCol}`,
                    relation: 'many',
                }
            }
        },
    }
}

type SCHEMA = {
    [key: string]: {
        [key: string]: ColumnType
    }
}

const Schema: SCHEMA = {
    Post: {
        text: STRING,
        id: INTEGER,
        authorId: INTEGER,
        author: RELATION_ONE('Post.authorId', 'User.id'),
        comments: RELATION_MANY('Post.id', 'PostComment.postId'),
    },
    User: {
        id: INTEGER,
        name: STRING,
        age: INTEGER,
        comments: RELATION_MANY('User.id', 'PostComment.authorId'),
        posts: RELATION_MANY('User.id', 'Post.authorId'),
    },
    PostComment: {
        authorId: INTEGER,
        postId: INTEGER,
        text: STRING,
        id: INTEGER,
        post: RELATION_ONE('PostComment.postId', 'Post.id'),
        author: RELATION_ONE('PostComment.authorId', 'User.id'),
    },
}

function validateName(name: string) {}

function validateSchema(schema: SCHEMA) {
    for (let tableName in schema) {
        validateName(tableName)
        let table = schema[tableName]
        for (let columnName in table) {
            validateName(columnName)
            let column = table[columnName]
            column.validate(schema, tableName, columnName)
        }
    }
}

validateSchema(Schema)

let varCounter = 0

function makeTable(schema: SCHEMA, tableName: string) {
    console.assert(tableName in schema, 'Table not found')
    return function(fn) {
        varCounter++
        let id = 'X' + varCounter

        let inputObject = {}
        let table = schema[tableName]
        for (let colName in table) {
            let colType = table[colName]
            inputObject[colName] = colType.make(schema, tableName, colName, id)
        }
        return {
            id: id,
            table: tableName,
            fields: fn(inputObject),
        }
    }
}

const User = makeTable(Schema, 'User')
const Post = makeTable(Schema, 'Post')
const PostComment = makeTable(Schema, 'PostComment')

let ast = Post(p => ({
    text: p.text,
    // wumbo: 77,
    comments: p.comments(c => ({
        text: c.text,
        author: c.author(a => ({
            name: a.name,
        })),
    })),
}))

console.log(ast)

function indent(s) {
    return s
        .split('\n')
        .map(k => '\t' + k)
        .join('\n')
}
function toSQL(ast) {
    if (typeof ast === 'string') {
        return ast
    }

    let s = ''

    if (ast.relation === 'many') {
        s += 'SELECT json_group_array(json_object(\n'
    } else if (ast.relation === 'one') {
        s += 'SELECT json_object(\n'
    } else {
        s += 'SELECT \n'
    }

    let chunks = []
    for (let field in ast.fields) {
        let subsql = toSQL(ast.fields[field])
        if (subsql.indexOf('\n') != -1) {
            subsql = '(' + indent(subsql).trim() + ')'
        }

        if (ast.relation) {
            chunks.push(`'${field}', ${subsql}`)
        } else {
            chunks.push(`${subsql} as ${field}`)
        }
    }

    s += '\t' + chunks.join(',\n\t') + '\n'
    if (ast.relation === 'many') {
        s += ')) '
    } else if (ast.relation === 'one') {
        s += ') '
    } else {
        s += ''
    }

    s += `FROM ${ast.table} ${ast.id}\n`

    if (ast.where) {
        s += 'WHERE ' + ast.where.replace(/@/g, ast.id) + '\n'
    }
    if (ast.relation === 'one') {
        s += 'LIMIT 1\n'
    }
    return s
}

console.log(toSQL(ast))
