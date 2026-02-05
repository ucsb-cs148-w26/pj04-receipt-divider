# Eezy Receipt Frontend (Shared Library)

## Project structure
```txt
shared                        
├── src
│   ├── index.ts              (export script)
│   ├── components/           (shared React components)
│   ├── constants   
│   ├── hooks/                (custom React hooks)
│   ├── providers/            (context providers)
│   ├── services/             (look it up if u don't know, idk how to explain)
│   ├── theme/
│   ├── types/                (types definitions)
│   └── utils/                (utility functions)
└── styles                    (CSS)
    ├── global.css            (global CSS, to be imported everywhere)
    └── *.css                 (additional CSS styling)
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
