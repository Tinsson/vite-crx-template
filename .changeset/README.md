# Changesets

Changesets manages the npm version and changelog for the publishable
`create-vite-crx` package. Private workspace packages are not versioned or
published.

Add a changeset for every user-visible CLI or generated-template change:

```sh
pnpm changeset
```

Repository-only maintenance does not require a changeset. To prepare and
publish a release:

```sh
pnpm version-packages
pnpm release
```

Review and commit the generated package version and changelog before running
the release command.
