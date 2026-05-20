Copyright (c) 2026 Stefan Lessle

VoteCast is licensed under the GNU Affero General Public License v3.0.
See the LICENSE file for details.

# sv-votecast

A Svelte project for the VoteCast community governance platform.

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.12.5 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:node" devtools-json drizzle="database:sqlite+sqlite:better-sqlite3" better-auth="demo:none" mcp="ide:claude-code,other,vscode,opencode+setup:local" --install pnpm votecast
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
