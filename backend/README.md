# Eezy Receipt Backend

## Quick start

Install uv

```sh
# MacOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Window
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```


Install dependencies

```sh
uv sync --locked
```

Start dev server

```sh
uv run fastapi dev app/main.py --host 0.0.0.0
```

## Project structure
```txt
backend
├── .env
└── app
    ├── main.py          (entrypoint)
    ├── database.py      (database connection and pooling management)
    ├── dependencies.py  (services provider)
    ├── models/          (orm models)
    ├── routers/         (endpoints definition)
    ├── schemas/         (endpoint interfaces)
    └── services/        (functions, e.g. MLService, AuthService)

```

## Contributing
### Code format

Run before merge

```sh
uv run black .
```

### Adding dependency
Deployment dependency
```sh
uv add [your-dependency]
```

Dev dependency
```sh
uv add --dev [your-dependency]
```
