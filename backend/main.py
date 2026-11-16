
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, Header
from pydantic import BaseModel, Field

app = FastAPI(title="Fraud Risk Engine API", version="2.0.0")

sessions = {}


class FraudRequest(BaseModel):
    amount: int = Field(gt=0)
    merchant: str = "retail"
    location: str = "domestic"
    avgTxn: Optional[int] = Field(default=None, gt=0)
    maxTxn: Optional[int] = Field(default=None, gt=0)
    device: str = "known"
    time: Optional[int] = Field(default=None, ge=0, le=23)


class FraudResult(BaseModel):
    score: int
    decision: str
    reasons: list[str]
    session_id: Optional[str] = None


def get_session(session_id: str):
    if session_id not in sessions:
        sessions[session_id] = {
            "txn_count": 0,
            "last_txn_time": None,
            "history": [],
        }
    return sessions[session_id]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/check", response_model=FraudResult)
def check_transaction(
    request: FraudRequest,
    x_session_id: Optional[str] = Header(default=None),
):
    session_id = x_session_id or str(uuid4())
    state = get_session(session_id)

    previous_count = state["txn_count"]
    now = datetime.now().timestamp()
    last_txn_time = state["last_txn_time"]
    is_rapid = last_txn_time is not None and (now - last_txn_time < 5)

    result = evaluate(
        amount=request.amount,
        merchant=request.merchant.lower(),
        location=request.location.lower(),
        txn_count=previous_count,
        transaction_hour=request.time,
        avg_txn=request.avgTxn,
        max_txn=request.maxTxn,
        device=request.device.lower(),
        is_rapid=is_rapid,
    )

    state["txn_count"] += 1
    state["last_txn_time"] = now

    record = {
        "time": datetime.now().astimezone().strftime("%H:%M:%S"),
        "amount": request.amount,
        "merchant": request.merchant,
        "score": result["score"],
        "decision": result["decision"],
    }

    state["history"].insert(0, record)

    return {**result, "session_id": session_id}


def evaluate(
    amount,
    merchant,
    location,
    txn_count,
    transaction_hour,
    avg_txn,
    max_txn,
    device,
    is_rapid,
):
    score = 5
    reasons = []

    average = avg_txn if avg_txn is not None else 5000
    historical_max = max_txn if max_txn is not None else 20000

    odd_time = (
        transaction_hour < 6
        if transaction_hour is not None
        else datetime.now().hour < 6
    )
    new_device = device == "new"

    if amount > 10 * average:
        score += 30
        reasons.append("Severe deviation from normal spend behavior")
    elif amount > 5 * average:
        score += 20
        reasons.append("Moderate deviation from normal spend behavior")

    if amount > historical_max:
        score += 20
        reasons.append("Amount exceeds historical maximum transaction")

    if is_rapid:
        score += 20
        reasons.append("High transaction velocity detected (< 5s)")

    if txn_count > 5:
        score += 10
        reasons.append("High daily transaction volume")

    if new_device:
        score += 15
        reasons.append("New/unrecognized device used")

    if odd_time:
        score += 10
        reasons.append("Transaction attempted at an unusual hour (12 AM - 6 AM)")

    if location == "international":
        score += 15
        reasons.append("Unusual transaction location (International)")

    if merchant in {"crypto", "gaming", "jewelry"}:
        score += 15
        reasons.append(f"High-risk merchant category ({merchant.capitalize()})")

    score = min(score, 100)

    hard_decline = False

    if is_rapid and txn_count >= 3:
        hard_decline = True
        reasons.append(
            "Repeated rapid transactions indicate possible card testing"
        )

    if hard_decline:
        score = max(score, 70)

    decision = (
        "DECLINED"
        if hard_decline or score >= 70
        else "APPROVED"
    )

    return {
        "score": score,
        "decision": decision,
        "reasons": reasons,
    }


@app.get("/history")
def get_history(x_session_id: Optional[str] = Header(default=None)):
    if not x_session_id or x_session_id not in sessions:
        return []

    return sessions[x_session_id]["history"]


@app.post("/reset")
def reset_session(x_session_id: Optional[str] = Header(default=None)):
    if x_session_id:
        sessions.pop(x_session_id, None)

    return {"message": "Session reset"}


app.frontend("/", directory="frontend/dist")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
