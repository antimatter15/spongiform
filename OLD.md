# Thoughts on ORMs

Ideally we'd like to be able to specify our table schema declaratively

```
type Bees {
    id: integer
    name: varchar(50)
    wings: integer
    legs: integer
}
```

Ideally we should be able to run a command and create a migration that determines how a thing ought
to change in order to apply such a change.

We should discourage `SELECT *` because it's fairly wasteful.

```
SELECT * FROM Bees WHERE b.wings = 2 AND b.legs = 6
```

Ideally we'd be able to fetch structures composably.

With the following schema:

```
User {
    name: string
    posts: [Post]
}

Post {
    author: User
    comments: [Comment]
}

Comment {
    author: User
    text: string
    created: date
}
```

Ideally we'd be able to make the following query

```
{
    User: {
        name,
        posts: {
            comments: {
                author: {
                    name
                }
            }
        }
    }
}
```

Can we have a system that basically gives us the full power of SQL but with the ability to compose
queries?

```
SELECT ... WHERE ...
```

```
SELECT name, friends, age FROM User WHERE ? IN User.friends


await SELECT('User', {
    name: true,
    friends: {
        name: true,
        profilePic: true
    },
    age: true,
    [WHERE]: '? in User.friends'
})


[{
    name: 'Bob',
    friends: [ {
        name: 'Carl',
        profilePic: 'http://whatever.jpg'
    } ],
    age: 17,
}]
```

Alternatively

```
await SELECT({
    User: {
        name: true,
        friends: {
            name: true,
            profilePic: true
        },
        age: true,
        [WHERE]: '? in User.friends'
    }
})


{
    User: [{
        name: 'Bob',
        friends: [ {
            name: 'Carl',
            profilePic: 'http://whatever.jpg'
        } ],
        age: 17,
    }]
}
```

What's the composability story?

```

function mutualFriends(me){
    return {
        name: true,
        profilePic: true,
        [TABLE]: 'User'
        [WHERE]: '${me} in User.friends'
    }
}

await SELECT(mutualFriends(4))

await SELECT({
    name: true,
    friends: mutualFriends(),
    age: true,
    [TABLE]: 'User',
    [WHERE]: '${me} in friends'
})

```

Let's try again

```

SELECT({
    [TABLE]: 'Posts',
    [WHERE]: visibleTo(me),
})
```

What if we could pretend things

```
Posts
    .filter(k => visibleTo(k, me))
    .get({
        text: 1,
        author: {
            name: 1,
            profilePic: 1
        },
        comments: 'COUNT(*)'
    })
```

Can we do something like GraphQL

```
{
    text: 'text',
    author: 'author',
    comment_count: 'SELECT COUNT(*) FROM Comment WHERE Comment.post = @id'
}
```

```

fucntion visibleTo(me){
    return {
        [TABLE]: 'Post',
        [WHERE]: 'Post.confidentialityLevel <= me.confidentialityLevel'
    }
}

SELECT({
    [TABLE]: 'Post',
    [WHERE]: [ visibleTo(me) ],
})


SELECT({
    hello: {

    },
    whatever: {

    }
})






SELECT({
    [TABLE]: 'table name',
    [WHERE]: 'filter things',
    [GROUP]: 'good news',
    [ORDER]: 'whatever',

    text: 'text',
    author: 'author'
})

SELECT({
    name: value,
    name: value
}, 'WHERE', 'GROUP BY')

```

How can we make things nice and typescriptable?

```js
SELECT({
    profile: User({
        id: 'asdf',
        name: 1,
        comments: XComment({
            text: 1,
            author: User({
                name: 1,
            }),
        }),
    }),
})



SELECT(User({
    id: 'whatever',
    name: 1,
    comments: Comment({
        text: 1,
        author: User({
            name: 1
        })
    })
}))


User({
    // where clause
    id: 'whatever',
}, {
    // select clause
    name: 1,
    comments: Comment({
        author: PARENT
    }, {
        text: 1,
        author: User({
            id:
        }, {
            name: 1
        })
    })
})


Post({}, {
    text: Post.text,
    comments: Comment({
        post: Post.id
    }, {
        text: Comment.text,
        author: User({
            id: Comment.author
        }, {
            name: User.name
        })
    })
})
```

This is tricky for scoping reasons, maybe we could use functions to solve some of our scope issues

```js
Post({}, p => ({
    text: p.text,
    comments: Comment(
        {
            post: p.id,
        },
        c => ({
            text: c.text,
            author: User({ id: c.author }, a => ({
                name: a.name,
            })),
        })
    ),
}))

// but this doesn't actually work that well for where clauses

// so we can try to stick everything within the object
Post(p => ({
    text: p.text,
    comments: Comment(c => ({
        [where]: {
            post: p.id,
        },
        text: c.text,
        author: User(a => ({
            [where]: EQUAL(a.id, c.author),
            name: a.name,
        })),
    })),
}))

// what if we added better support for declaring
// relations

Post(p => ({
    text: p.text,
    comments: p.comments(c => ({
        text: c.text,
        author: c.author(a => ({
            name: a.name,
        })),
    })),
}))
```

Okay how about this design:

```
type XComment = {
  author(fn: (user: XUser) => any): Field
  text: Field
}
type XUser = {
  name: Field
}
type XPost = {
  text: Field,
  comments(fn: (comment: XComment) => XResult): Field
}

type XResult = {
  [key: string]: Field
}

interface Field {
  isAField: boolean
}

// type Field = "adsfasdf"

function Post<T extends XResult>(fn: (post: XPost) => T): {
  [key in keyof T]: string
} {
  return { } as any
}




Post(p => ({
    text: p.text,
    // wumbo: 77,
    comments: p.comments(c => ({
        text: c.text,
        author: c.author(a => ({
            name: a.name,
        })),
    })),
}))


SELECT
    p1.text as text,
    json_group_array(SELECT
        c1.text as text,
        json_group_array(SELECT
            u1.name as name
        FROM User u1
        WHERE u1.id = c1.author) as author
    FROM Comment c1
    WHERE c1.post = p1.id) as comments
FROM Post p1


Actual query:
SELECT
    p1.text as "text",
    (select json_group_array(
        json_object(
            'text', c1.text,
            'id', c1.authorId,
            'author', (
                select json_object(
                    'name', u1.name
                )
                from User u1 where u1.id = c1.authorId
                limit 1
            )
        )
    ) from Comment c1 where c1.postId = p1.id) as comments
from Post p1


Entirely JSON:
SELECT
    json_group_array(json_object('text', p1.text,
    'comments', (select json_group_array(
        json_object(
            'text', c1.text,
            'id', c1.authorId,
            'author', (
                select json_object(
                    'name', u1.name
                )
                from User u1 where u1.id = c1.authorId
                limit 1
            )
        )
    ) from Comment c1 where c1.postId = p1.id))) as data
from Post p1


```

Notable things you can't do: all foreign key relation traversals require nesting. That means if you
want to get a comment's author's name through a JOIN, you must access it with
`Comment.author.name` — there's no way to stick that information into `Comment.author_name`.

This might actually be a feature.

```

Table("Post", {
    text: STRING,
    id: INTEGER,
    author: RELATION_ONE('User.id', 'Post.authorId'),
})

Table("User", {
    id: INTEGER,
    name: STRING,
    age: INTEGER,
    comments: RELATION_MANY('Comment.authorId', 'User.id'),
    posts: RELATION_MANY('Post.authorId', 'User.id')
})

Table("Comment", {
    post: RELATION_ONE("Post.id", 'Comment.postId'),
    author: RELATION_ONE("User.id", "Comment.authorId"),
    text: STRING,
    id: INTEGER
})


```

Alternatively, here's the non-imperative version

```
const Schema = {
    Post: {
        text: STRING,
        id: INTEGER,
        authorId: INTEGER,
        author: RELATION_ONE('Post.authorId', 'User.id'),
    },
    User: {
        id: INTEGER,
        name: STRING,
        age: INTEGER,
        comments: RELATION_MANY('User.id', 'Comment.authorId'),
        posts: RELATION_MANY('User.id', 'Post.authorId')
    },
    Comment: {
        post: RELATION_ONE('Comment.postId', "Post.id"),
        author: RELATION_ONE("Comment.authorId", "User.id"),
        authorId: INTEGER,
        text: STRING,
        id: INTEGER
    }
}
```

From our Schema AST, we can then diff in order to figure out how to do things.

We can then also generate our appropriate Typescript definitions.

```js
// here is a potential alternative API
// which is a little less ideal because it can be
// somewhat ambiguous when there are multiple references
// to the same table

Post({
    [WHERE]: expr`${Post.text} = ${42}`,
    text: Post.text,
    comments: Post.comments({
        text: PostComment.text,
        author: PostComment.author({
            name: User.name,
        }),
    }),
})
```

Where might we have a subquery of the same table?

```
User(u => {
    name: u.name,
    best_friend: User(f => {
        [WHERE]: expr`${f.id} = ${u.best_friend_id}`,
        name: f.name
    })
})
```

# ORM Whitepaper

What if SQL was a little bit more like GraphQL?

-   Compose your queries from logical chunks
-   Fetch information from nested graph structures without fearing the N+1 problem
-   Typecheck your column and table names with Typescript for both queries and results
-   Fetch only the data you actually use, not all columns in a table
-   Retain the full power of SQL without having to learn different abstractions and APIs.

Specify your model succinctly.

```js
const Schema: SCHEMA = {
    Post: {
        text: TEXT,
        id: INTEGER,
        authorId: INTEGER,
        author: RELATION_ONE('Post.authorId', 'User.id'),
        comments: RELATION_MANY('Post.id', 'PostComment.postId'),
    },
    User: {
        id: INTEGER,
        name: TEXT,
        age: INTEGER,
        comments: RELATION_MANY('User.id', 'PostComment.authorId'),
        posts: RELATION_MANY('User.id', 'Post.authorId'),
    },
    PostComment: {
        authorId: INTEGER,
        postId: INTEGER,
        text: TEXT,
        id: INTEGER,
        post: RELATION_ONE('PostComment.postId', 'Post.id'),
        author: RELATION_ONE('PostComment.authorId', 'User.id'),
    },
}
```

Describe the query and all the related graph data that you want to fetch

```js
Post(p => ({
    [WHERE]: expr`${p.text} = ${42}`,
    text: p.text,
    comments: p.comments(c => ({
        text: c.text,
        author: c.author(a => ({
            name: a.name,
        })),
    })),
}))
```

Our ORM, i.e. object-relational mapper, is built on mapping functions. Mapping functions allow you
to read and rename values from your database. In GraphQL, you can read from a field "name" and
output it with the name "my_name" like this:

```js
{
    my_name: name
}
```

Likewise in this ORM we can do it like this:

```js
Post(p => ({
    my_name: p.name,
}))
```

Here we're forced to give a name to our Post `p`. This handle gives us access to the various columns
of the table. This handle is particularly powerful as it allows you to reference this from elsewhere
in the query.

Let's say we want to find the name of the User with id=3.

```js
User(u => ({
    [WHERE]: expr`${u.id} = 3`,
    name: u.name,
}))
```

Here `User` represents the `User` table.

By passing a function to it, we can get a handle
