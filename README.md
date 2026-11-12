# WebAppComputerServiceHelper

Computer-service management application with a Django REST API and a React/Vite frontend.

## Requirements

- Python 3.12 or newer
- Node.js 20 or newer and npm
- PostgreSQL 14 or newer
- Git

## Backend setup

From the repository root:

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with a database user, password, and Django secret key. Create the
PostgreSQL database named in `DB_NAME` before running migrations.

```powershell
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/api`.

The optional seed command creates development data:

```powershell
python manage.py test_seed
```

The `SIMC_Urzedowy_*.csv` file is needed only when using the city import command.

## Frontend setup

Open another terminal from the repository root:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

The frontend is available at `http://localhost:5173`.

Useful commands:

```powershell
npm run build
npm run lint
```

## Backend tests

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py test
```

## Configuration and security

- Never commit `.env`, database files, virtual environments, `node_modules`, or build output.
- Use a unique random `SETTINGS_KEY` outside development.
- Configure SMTP variables only when email notifications are required.
- Set production hosts, CORS, HTTPS, and `DEBUG=False` before deployment.
- Django migration files are committed and must be applied with `python manage.py migrate`.
