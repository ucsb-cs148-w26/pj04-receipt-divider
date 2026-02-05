# Eezy Receipt Frontend (Shared Library)

## Project structure
```txt
shared                        
├── src
│   ├── index.ts              (export script)
│   ├── components            (shared React components)
│   │   ├── index.ts
│   │   └── *.tsx
│   ├── constants
│   │   ├── index.ts
│   │   └── *.ts     
│   ├── hooks                 (custom React hooks)
│   │   ├── index.ts
│   │   └── *.ts
│   ├── providers             (context providers)
│   │   ├── index.ts
│   │   └── *.tsx
│   ├── services              (look it up if u don't know, idk how to explain)
│   │   ├── index.ts
│   │   └── *.ts
│   ├── theme 
│   │   ├── index.ts
│   │   └── *.ts
│   ├── types                 (types definitions)
│   │   ├── index.ts
│   │   └── *.ts
│   └── utils                 (utlity functions)
│   │   ├── index.ts
│   │   └── *.ts
├── styles                    (CSS)
│   ├── global.css            (global CSS, to be imported everywhere)
│   └── *.css                 (additional CSS styling)
└── ui                        (shared UI components and CSS)
```

## Contributing
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
