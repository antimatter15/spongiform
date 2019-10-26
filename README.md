# Spongiform

With the [Vietnam War](http://blogs.tedneward.com/post/the-vietnam-of-computer-science/) compared
favorably against Object-Relational Mappers (ORMs), you'd probably need some form of
[brain damage](https://en.wikipedia.org/wiki/Transmissible_spongiform_encephalopathy) to still try.

But the world has actually changed quite a bit over the past decade, and maybe our intractable
problems aren't quite so intractable anymore:

-   TypeScript makes it possible for schemas, queries, and results to be automatically checked and
    documented within your editor.
-   GraphQL has revealed that much of the data that modern applications depend on is naturally
    hierarchical, and traditional ways of fetching this data is complicated and inefficient.
-   Relational databases have improved considerably in the past 5 years— notably with the
    introduction of JSON Aggregation functions (Postgres 9.3 in 2013, MySQL 8.0 in 2016, SQLite in
    2016).

## What is Spongiform?

Perhaps more important than what Spongiform does is what it _doesn't_ do. Spongiform is not a
framework. It's not a new alternative query language, nor does it provide a write-once-run-anywhere
abstraction over different SQL engines.

Spongiform is a minimal system that lets you build composable queries. As a consequence of this
design, there are a few nice properties that pop out:

-   **Don't repeat yourself.** You can factor out common fragments of queries into reusable
    functions.
-   **Efficient.** It only fetches the data that you're going to use, and it does so with a single
    query. This is probably the only ORM out there that'll likely emit SQL which is faster than the
    stuff that you'd write by hand.
-   **Strongly typed.** Your schema gets compiled into TypeScript, which allows your code to be
    strongly typed automatically. Even embedded fragments of SQL in template strings can be
    typechecked. Rest easy knowing that a misspelt column name won't break production.
-   **Hierarchical.** Fetch data from nested or graph-like structures without wrangling JOINs.
-   **Still SQL.** You're not learning a completely different set of abstractions or APIs. You have
    the full power of SQL, not training wheels.

## Describing Models

Spongiform allows you to describe

```js
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
    PostComment: {
        authorId: INTEGER(),
        postId: INTEGER(),
        text: TEXT(),
        id: INTEGER('PRIMARY KEY'),
        post: RELATION_ONE('PostComment.postId', 'Post.id'),
        author: RELATION_ONE('PostComment.authorId', 'User.id'),
    },
}
```

---

`yarn migrate update`

The types of data and applications.

Because relational databases have improved considerably in the past 10 years, and the advent of
things like Typescript.

But in many ways the world has changed enough that many of these traditionally intractable issues no
longer necessarily apply.

Spongiform is inspired by GraphQL, and enabled by the .

## Features

-   Automatically validate schemas
-   Compute diff between schemas to generate migration
-   Generate typescript bindings from schema
-   Generate SQL query from usage string
