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
uv run fastapi dev app/index.py
```
