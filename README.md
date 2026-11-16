# Fraud Risk Engine — React + FastAPI

A migration of the uploaded Java/Spring Boot rule-based fraud scoring logic to Python/FastAPI, with a React frontend.

## Preserved scoring behaviour

- Initial score: 5
- Amount > 10x average transaction: +30
- Else amount > 5x average transaction: +20
- Amount > historical maximum: +20
- Previous transaction within 5 seconds: +20
- More than 5 previous transactions in the session: +10
- New device: +15
- Transaction hour before 06:00: +10
- International location: +15
- Crypto, gaming, or jewelry merchant: +15
- Score capped at 100
- Hard decline if rapid transaction AND at least 3 previous transactions; score forced to at least 70
- Otherwise decline at score >= 70; approve below 70

Defaults: average transaction = 5000; historical maximum = 20000. The transaction count passed to the evaluator is the count BEFORE the current transaction, matching the original controller.

## Run locally

### 1. Start the API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API: http://localhost:8000  
Interactive docs: http://localhost:8000/docs

### 2. Start React

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## API endpoints

- `POST /check` — evaluate a transaction. Send `X-Session-ID` header.
- `GET /history` — return history for that session.
- `POST /reset` — clear that session.
- `GET /health` — health check.

Example body for `POST /check`:

```json
{
  "amount": 65000,
  "merchant": "crypto",
  "location": "international",
  "avgTxn": 5000,
  "maxTxn": 20000,
  "device": "new",
  "time": 2
}
```

## Important implementation notes

- The uploaded Java source includes session-based transaction count, last-transaction timestamp, and history. This version reproduces those behaviours with an `X-Session-ID` header.
- Session state is held in Python memory for this demo. It is lost when the API restarts and is not shared between multiple API workers/instances. For production, move session state to Redis or a database.
- The uploaded Java controller also writes browser telemetry to a `user_telemetry` PostgreSQL table. That table/schema and the original HTML/JS frontend were not included in the uploads, so this starter does not reproduce that separate telemetry pipeline.
- The original scoring algorithm is rule-based, not machine learning. It is a demonstration and must not be used as a real payment authorisation or fraud-prevention system without security, validation, persistence, monitoring, and domain review.
- For deployment, set `VITE_API_URL` to your deployed API URL before building the frontend. Update FastAPI CORS `allow_origins` to your deployed frontend domain.
