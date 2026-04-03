# Bun & Butter Website

The Bun & Butter website is a static Astro site for browsing the public
repositories in the `bun-and-butter` GitHub organization.

It renders:

- a landing page with the current catalog
- one detail page per fetched repository
- repository README content, install instructions, tags, and examples

The site reads repository data from the local `repos/` directory. That
directory is managed by a fetch script that discovers public repositories from
GitHub automatically and excludes the website repository itself.

## Stack

- Astro
- Tailwind CSS v4
- Bun
- `astro-seo`
- `@astrojs/sitemap`
- `@playform/compress`

## Requirements

- Bun
- Git

## Getting Started

1. Install dependencies:

```sh
bun install
```

2. Create an environment file if you want to use an authenticated GitHub API
   token:

```sh
cp .env.template .env
```

3. Fetch the current public repositories from the Bun & Butter organization:

```sh
bun run fetch-repos
```

4. Start the local development server:

```sh
bun run dev
```

The site will be available at `http://localhost:4321`.

## Available Commands

```sh
bun run dev
```

Starts the Astro development server.

```sh
bun run build
```

Builds the static production output into `dist/`.

```sh
bun run preview
```

Serves the production build locally.

```sh
bun run fetch-repos
```

Discovers public repositories from the `bun-and-butter` GitHub organization,
filters out `website`, and clones or refreshes them into `repos/`.

```sh
bun astro check
```

Runs Astro's type and template checks.

## How It Works

This repository is not the source of truth for the catalog content itself.

The source of truth lives in the public repositories of the
`bun-and-butter` GitHub organization. The website acts as a static renderer
for that data.

At a high level, the system is meant to work like this:

1. A package repository in the organization changes.
2. That change triggers a website redeployment.
3. During the deployment, the website either refreshes cached repositories in
   `repos/` or clones them from scratch if they are missing.
4. The Astro build reads those local checkouts and generates static HTML.
5. The deployed website reflects the latest repository state.

This keeps the website lightweight. It does not need a runtime database, CMS,
or dynamic API layer for catalog pages.

In practice, the deployment pipeline follows this order:

1. install dependencies
2. fetch or refresh all public Bun & Butter repositories
3. run the Astro static build
4. upload `dist/` as a GitHub Pages artifact
5. deploy that artifact to GitHub Pages

Example:

```sh
bun install
bun run fetch-repos
bun run build
```

The Astro build does not fetch remote content on demand while rendering pages.
It only renders from the already-synced local `repos/` directory, which keeps
the final deployment fully static.

Production deployments run through a GitHub Actions workflow in
`.github/workflows/deploy.yml`. That workflow builds the site, uploads `dist/`
as the GitHub Pages artifact, and deploys it with the official Pages actions.
The custom domain is configured in the repository's GitHub Pages settings, not
through a committed `CNAME` file.

## Repository Sync

The fetch script:

- queries the GitHub organization API
- keeps only public repositories
- excludes the `website` repository
- uses each repository's default branch
- clones missing repositories from scratch
- fetches tags and hard-resets existing repositories to `origin/<default-branch>`

If you provide `GITHUB_TOKEN`, the script will use it for authenticated GitHub
API requests.

Example `.env`:

```sh
GITHUB_TOKEN=your-token-here
```

Without a token, the script still works for public repositories, subject to
normal anonymous API limits.

## How Content Is Built

The website expects each synced repository to provide:

- `package.json`
- `README.md`
- `doc/logo.webp`
- files inside `examples/`

During build, the site reads repository metadata from `package.json`, normalizes
README links to example anchors, reads example files, and extracts tags and the
latest commit from Git.

Catalog pages are generated from `src/pages/catalog/[id].astro`.

## Deployment

This repository now targets GitHub Pages directly.

To finish the setup in GitHub:

1. Open `Settings -> Pages`.
2. Set the source to `GitHub Actions`.
3. Add `bun-and-butter.dev` as the custom domain.
4. Point your DNS records at GitHub Pages.

If you are publishing with the custom workflow in `.github/workflows/deploy.yml`,
GitHub does not require a committed `CNAME` file. Any existing `CNAME` file is
ignored for this workflow mode.

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/
├── repos/
├── scripts/
│   └── fetch-repos.ts
├── src/
│   ├── components/
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   └── styles/
├── astro.config.ts
├── package.json
└── README.md
```

## SEO and Output

The site is built as a static Astro project with:

- canonical URLs
- Open Graph metadata
- Twitter card metadata
- sitemap generation
- post-build compression

The production site URL is configured in `astro.config.ts` as:

```ts
site: "https://bun-and-butter.dev"
```

Because the output is static, every catalog page is pre-rendered at build time.
There is no server-side lookup for repository content after deployment.

## Notes

- Run `bun run fetch-repos` before local development if `repos/` is empty or
  stale.
- The deployment pipeline should also run `bun run fetch-repos` before building.
- The current implementation expects every synced repository to include an
  `examples/` directory.
- Repository detail pages are only generated for repositories present in
  `repos/` at build time.
