import { makeTable, Relation, Field, SCHEMA } from './spongiform'

const schema: SCHEMA = {
    Post: {
        text: { kind: 'atom', sqlType: 'TEXT', jsType: 'string', constraints: 'NOT NULL' },
        id: { kind: 'atom', sqlType: 'INTEGER', jsType: 'number', constraints: 'PRIMARY KEY' },
        authorId: { kind: 'atom', sqlType: 'INTEGER', jsType: 'number', constraints: 'NOT NULL' },
        author: {
            kind: 'relation',
            cardinality: 'one',
            source: 'Post.authorId',
            destination: 'User.id',
        },
        comments: {
            kind: 'relation',
            cardinality: 'many',
            source: 'Post.id',
            destination: 'PostComment.postId',
        },
    },
    User: {
        id: { kind: 'atom', sqlType: 'INTEGER', jsType: 'number', constraints: 'PRIMARY KEY' },
        name: { kind: 'atom', sqlType: 'TEXT', jsType: 'string', constraints: '' },
        age: { kind: 'atom', sqlType: 'INTEGER', jsType: 'number', constraints: '' },
        comments: {
            kind: 'relation',
            cardinality: 'many',
            source: 'User.id',
            destination: 'PostComment.authorId',
        },
        posts: {
            kind: 'relation',
            cardinality: 'many',
            source: 'User.id',
            destination: 'Post.authorId',
        },
    },
    PostComment: {
        authorId: { kind: 'atom', sqlType: 'INTEGER', jsType: 'number', constraints: '' },
        postId: { kind: 'atom', sqlType: 'INTEGER', jsType: 'number', constraints: '' },
        text: { kind: 'atom', sqlType: 'TEXT', jsType: 'string', constraints: '' },
        id: { kind: 'atom', sqlType: 'INTEGER', jsType: 'number', constraints: 'PRIMARY KEY' },
        post: {
            kind: 'relation',
            cardinality: 'one',
            source: 'PostComment.postId',
            destination: 'Post.id',
        },
        author: {
            kind: 'relation',
            cardinality: 'one',
            source: 'PostComment.authorId',
            destination: 'User.id',
        },
    },
}

export const Post = makeTable<PostHandle>(schema, 'Post')
type PostHandle = {
    text: Field<string>
    id: Field<number>
    authorId: Field<number>
    author: Relation<UserHandle>
    comments: Relation<PostCommentHandle>
}

export const User = makeTable<UserHandle>(schema, 'User')
type UserHandle = {
    id: Field<number>
    name: Field<string>
    age: Field<number>
    comments: Relation<PostCommentHandle>
    posts: Relation<PostHandle>
}

export const PostComment = makeTable<PostCommentHandle>(schema, 'PostComment')
type PostCommentHandle = {
    authorId: Field<number>
    postId: Field<number>
    text: Field<string>
    id: Field<number>
    post: Relation<PostHandle>
    author: Relation<UserHandle>
}
