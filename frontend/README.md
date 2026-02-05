# Eezy Receipt Frontend

## Quick start

Install dependencies

```sh
# run this at the project root (frontend/)
npm ic
```

Start expo

```sh
npm run start
```

## Contributing

### Project structure
```txt
frontend
├── apps                          (mobile and web codebase)
│   ├── mobile
│   │   ├── *.ts, *.js, *.json    (config files, DO NOT TOUCH, unless you know what you're doing)
│   │   ├── app                   (pages)
│   │   ├── assets                (static assets, e.g., images, favico)
│   │   ├── components            (reusable ReactNative components)
│   │   ├── hooks                 (custom React hooks)
│   │   └── providers             (context providers)
│   └── web/
└── shared                        (common code that can be shared between mobile and web)
    ├── contexts                  (context providers)
    │   ├── index.ts              (export script)
    │   ├── package.json
    │   └── src/                  (all code goes in here)
    ├── providers/                (service providers)
    ├── types/                    (TypeScript types definitions)
    └── ui                        (shared UI components and CSS)
        ├── index.ts
        ├── package.json
        └── src
            ├── *.tsx
            └── styles            (additional CSS)
                └── global.css    (the global CSS file)
```

### Code formatting

```sh
npm run format:fix
```

### Adding dependency
Adding dependency to the whole project (web + mobile)
```sh
npm i <package-name>
```

Adding dependency to a specific workspace
```sh
npm i <package-name> --workspace <workspace-name>
```

Adding dev dependency
```sh
npm i -D <package-name>
```
