"""Dispatch a missing US-close watchdog once; never bypass audit acceptance."""
import json, os, sys
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
from observatory_session import ET, EARLY_CLOSES, GRACE_MINUTES  # noqa: E402

WF = "market-observatory-close-watchdog.yml"
MAX_DISPATCHES_PER_SESSION = 3
RECENT_SECONDS = 1800
def lagging(a):
    return any(isinstance(i, dict) and i.get("severity") == "CRITICAL" and i.get("code") == "GROUP_CORE_US_LAGGING" for i in (a.get("issues") or []))
def session_ready_utc(anchor):
    day = datetime.fromisoformat(str(anchor)[:10]).date()
    close = time(13 if day in EARLY_CLOSES else 16, 0)
    return (datetime.combine(day, close, ET) + timedelta(minutes=GRACE_MINUTES)).astimezone(timezone.utc)
def api(method, path, token, payload=None):
    req=Request("https://api.github.com"+path, data=json.dumps(payload).encode() if payload else None, method=method, headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"})
    with urlopen(req,timeout=15) as resp:
        return json.load(resp) if method=="GET" else {}
def _created(r):
    try:
        return datetime.fromisoformat(r["created_at"].replace("Z","+00:00"))
    except (KeyError,ValueError,TypeError,AttributeError):
        return None
def run(audit, token, repo, call=api, now=None):
    if not lagging(audit):
        print("CORE_US_REPAIR=NOOP not lagging")
        return False
    if not token or not repo:
        raise ValueError("GitHub credentials missing")
    now = now or datetime.now(timezone.utc)
    base=f"/repos/{repo}/actions/workflows/{WF}/runs?per_page=30&branch=main"
    for status in ("queued","in_progress","waiting","pending","requested"):
        runs=call("GET",base+"&status="+status,token).get("workflow_runs") or []
        if any(r.get("head_branch")=="main" for r in runs):
            print("CORE_US_REPAIR=NOOP watchdog already active")
            return False
    anchor=((audit.get("groups") or {}).get("core_us") or {}).get("anchor")
    ready=session_ready_utc(anchor) if anchor else now-timedelta(hours=24)
    since=quote(">="+ready.strftime("%Y-%m-%dT%H:%M:%SZ"))
    # One session yields only a handful of dispatches, so 100 rows bounded by
    # created>=ready cannot hide an earlier one behind pagination.
    runs=call("GET",f"/repos/{repo}/actions/workflows/{WF}/runs?per_page=100&branch=main&event=workflow_dispatch&created={since}",token).get("workflow_runs") or []
    session_runs=[r for r in runs if r.get("head_branch")=="main" and (_created(r) or ready)>=ready]
    if len(session_runs)>=MAX_DISPATCHES_PER_SESSION:
        print(f"CORE_US_REPAIR=EXHAUSTED anchor={anchor} dispatches={len(session_runs)} max={MAX_DISPATCHES_PER_SESSION}; critical audit still blocks")
        return False
    for r in session_runs:
        c=_created(r)
        if c and 0<=(now-c).total_seconds()<RECENT_SECONDS:
            print("CORE_US_REPAIR=NOOP recent dispatch")
            return False
    call("POST",f"/repos/{repo}/actions/workflows/{WF}/dispatches",token,{"ref":"main","inputs":{"force_repair":"false"}})
    print(f"CORE_US_REPAIR=DISPATCHED anchor={anchor} attempt={len(session_runs)+1}/{MAX_DISPATCHES_PER_SESSION}; critical audit still blocks")
    return True
def main(path="market-observatory/data/data-audit.json", call=api):
    # Repair is best effort: any failure here must leave the critical
    # acceptance step to decide the run, never stop before it.
    try:
        audit=json.loads(Path(path).read_text())
        run(audit,os.getenv("GH_TOKEN"),os.getenv("GH_REPOSITORY"),call)
    except Exception as e:  # noqa: BLE001
        print(f"CORE_US_REPAIR=ERROR {type(e).__name__}: {e}",file=sys.stderr)
    return 0
if __name__=="__main__":
    sys.exit(main())
