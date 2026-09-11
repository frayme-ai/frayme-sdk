# Releasing

Every push and pull request runs `CI` (type-check, build, tests, publint).

Publishing is automated. To release:

1. Bump the versions in `packages/*/package.json`, re-pin the internal ranges
   (`@frayme/api` → `@frayme/catalog`, `@frayme/runtime` → `@frayme/api` and
   its `@frayme/catalog` peer range), update `CATALOG_VERSION` if the catalog
   vocabulary changed, and add the CHANGELOG entries.
2. Commit, then tag and push the tag:

   ```bash
   git tag v0.4.0
   git push origin v0.4.0
   ```

3. The `Release` workflow builds, tests and publishes `@frayme/catalog`,
   `@frayme/api` and `@frayme/runtime` in that order, skipping any version that
   is already on the registry. It authenticates through npm Trusted Publishing
   (GitHub OIDC); no token is stored in the repository.

The trusted publisher for each package is configured on npmjs.com:
package → Settings → Trusted Publisher → GitHub Actions, with owner
`frayme-ai`, repository `frayme-sdk`, workflow `release.yml`, environment `npm`.
