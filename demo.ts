import {
    SCHEMA,
    TEXT,
    INTEGER,
    RELATION_ONE,
    RELATION_MANY,
    RENAME,
    validateSchema,
    // CONSTRAINT,
    // ALIAS,
    // INDEX,
    // createMigration,
    generateTypescript,
    generateSQL,
    // SELECT,
    // LIMIT,
    // ORDER,
    WHERE,
    // GROUP,
    EXPR,
} from './spongiform'

import { Post, User } from './schema'

// const Schema: SCHEMA = {
//     User: {
//         id: INTEGER(),
//         posts: RELATION_MANY('User.id', 'Post.userId')
//     },
//     Post: {
//         userId: INTEGER(),
//         id: INTEGER(),
//         user: RELATION_ONE('Post.userId', 'User.id'),
//         tags: RELATION_MANY('Post.id', 'PostTag.postId')
//     },
//     Tag: {
//         name: TEXT(),
//         id: INTEGER()
//     },
//     PostTag: {
//         postId: INTEGER(),
//         tagId: INTEGER(),
//         tag: RELATION_ONE('PostTag.tagId', 'Tag.id')
//     }
// }

// User(u => ({
//     [WHERE]: EXPR`${u.id} = 1`,
//     posts: u.posts(p => ({
//         tags: p.tags(t => ({
//             tag: t.tag(t => ({
//                 name: t.name
//             }))
//         }))
//     }))
// }))

// User(u => ({
//     [WHERE]: EXPR`${u.id} = 1`,
//     posts: u.posts(p => ({
//         tags: p.tags(t => t.tag(t => t.name))
//     }))
// }))

const Schema: SCHEMA = {
    Post: {
        text: TEXT('NOT NULL'),
        id: INTEGER('PRIMARY KEY'),
        authorId: INTEGER('NOT NULL'),
        author: RELATION_ONE('Post.authorId', 'User.id'),
        comments: RELATION_MANY('Post.id', 'PostComment.postId'),
    },
    User: {
        id: INTEGER('PRIMARY KEY'),
        name: TEXT(),
        age: INTEGER(),
        comments: RELATION_MANY('User.id', 'PostComment.authorId'),
        posts: RELATION_MANY('User.id', 'Post.authorId'),
    },
    PostComment: RENAME('Blah', {
        authorId: INTEGER(),
        postId: RENAME('moople', INTEGER()),
        text: TEXT(),
        id: INTEGER('PRIMARY KEY'),
        post: RELATION_ONE('PostComment.postId', 'Post.id'),
        author: RELATION_ONE('PostComment.authorId', 'User.id'),
    }),
}

validateSchema(Schema)

console.log(Schema)

// createMigration(
//     {
//         Blah: {
//             text: TEXT('NOT NULL'),
//             moople: INTEGER(),
//         },
//         Post: {
//             text: TEXT(),
//             poops: INTEGER(),
//             id: INTEGER('PRIMARY KEY'),
//             author: RELATION_ONE('Post.authorId', 'User.id'),
//         },
//     },
//     Schema
// )

// console.log(
//     createMigration(
//         {
//             Post: {
//                 bloop: TEXT(),
//             },
//             deprecated_Wumbo: {
//                 moople: INTEGER(),
//             },
//             MOOB: {
//                 id: INTEGER('PRIMARY KEY'),
//                 name: TEXT(),
//                 age: INTEGER(),
//                 comments: RELATION_MANY('User.id', 'PostComment.authorId'),
//                 posts: RELATION_MANY('User.id', 'Post.authorId'),
//             },
//         },
//         {
//             User: RENAME('MOOB', {
//                 id: INTEGER('PRIMARY KEY'),
//                 name: TEXT(),
//                 age: INTEGER(),
//                 comments: RELATION_MANY('User.id', 'PostComment.authorId'),
//                 posts: RELATION_MANY('User.id', 'Post.authorId'),
//             }),
//             Post: {
//                 text: RENAME('bloop', TEXT()),
//                 content: ALIAS('text'),
//                 poops: INTEGER(),
//                 id: INTEGER('PRIMARY KEY'),
//                 author: RELATION_ONE('Post.authorId', 'User.id'),
//             },
//             Blah: {
//                 text: TEXT('NOT NULL'),
//                 moople: INTEGER(),
//                 cns_1: CONSTRAINT('PRIMARY KEY (text, moople)'),
//                 idx_1: INDEX('text, moople'),
//             },
//         }
//     )
// )

console.log(generateTypescript(Schema))

console.log(
    generateSQL(
        Post(p => ({
            [WHERE]: EXPR`${p.id} < 4`,
            text: p.text,
            id: p.id,
            comments: p.comments(c => ({
                comment: c.text,
                author: c.author(a => ({
                    name: a.name,
                })),
            })),
        }))
    )
)

// User.insert({
//     name: 'Arthur',
//     comments: [{
//         text: 'what'
//     }, {
//         text: 'how'
//     }]
// })
