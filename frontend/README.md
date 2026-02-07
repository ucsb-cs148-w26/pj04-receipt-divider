# Eezy Receipt Frontend

## Quick start

Install dependencies

```sh
# run this at the project root (frontend/)
npm ic
```

Start mobile

```sh
npm run start -w apps/mobile
```

Start web

```sh
npm run start -w apps/web
```

## Project structure
```txt
frontend
├── apps                (mobile and web codebase)               
│   ├── mobile/            
│   └── web/
└── shared/             (code that can be shared between mobile and web)
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
