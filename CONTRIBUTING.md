# Contributing

Hivemind is still being designed, so the most useful contribution right now is a question or a challenge to the concept. Open an issue.

## Development

You need Node.js 24 or later and Docker.

```sh
docker compose up -d   # PostgreSQL on port 5442
npm install
npm run check          # type checking
npm test               # recreates the test database and runs the tests
```

## Releasing

Versions follow [Semantic Versioning](https://semver.org). Until 1.0, a minor version may include breaking changes, and its notes say so.

A release starts as a draft:

```sh
gh release create v0.1.0 --draft --generate-notes
```

GitHub lists the merged pull requests. Add a few sentences on top about what's new and anything to do when upgrading, then publish. Publishing builds the Docker image for amd64 and arm64 and pushes it to `ghcr.io/maxjohnsen/hivemind` as `0.1.0`, `0.1` and `latest`. Published releases can't be changed.

## License

Hivemind is licensed under AGPL-3.0. To keep the option of offering it under other terms later, for example a commercial license for organizations that can't use AGPL, contributors will be asked to sign a short contributor agreement before their first pull request is merged. You keep the copyright to your work. The agreement only gives the project the right to relicense it.

The agreement will be published here before any outside code is accepted.
