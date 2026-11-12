"""Dispatch a missing US-close watchdog once; never bypass audit acceptance."""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

WF = "market-observatory-close-watchdog.yml"
def lagging(a):
    return any(isinstance(i, dict) and i.get("severity") == "CRITICAL" and i.get("code") == "GROUP_CORE_US_LAGGING" for i in (a.get("issues") or []))
def api(method, path, token, payload=None):
    req=Request("https://api.github.com"+path, data=json.dumps(payload).encode() if payload else None, method=method, headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"})
    with urlopen(req,timeout=15) as resp:
        return json.load(resp) if method=="GET" else {}
def run(audit, token, repo, call=api):
    if not lagging(audit):
        print("CORE_US_REPAIR=NOOP not lagging")
        return False
    if not token or not repo:
        raise ValueError("GitHub credentials missing")
    base=f"/repos/{repo}/actions/workflows/{WF}/runs?per_page=30"
    for status in ("queued","in_progress","waiting","pending"):
        runs=call("GET",base+"&status="+status,token).get("workflow_runs",[])
        if any(r.get("head_branch")=="main" for r in runs):
            print("CORE_US_REPAIR=NOOP watchdog already active")
            return False
    runs=call("GET",base+"&event=workflow_dispatch",token).get("workflow_runs",[])
    now=datetime.now(timezone.utc)
    for r in runs:
        try:
            age=(now-datetime.fromisoformat(r["created_at"].replace("Z","+00:00"))).total_seconds()
        except (KeyError,ValueError,TypeError):
            continue
        if r.get("head_branch")=="main" and 0<=age<1800:
            print("CORE_US_REPAIR=NOOP recent dispatch")
            return False
    call("POST",f"/repos/{repo}/actions/workflows/{WF}/dispatches",token,{"ref":"main","inputs":{"force_repair":"false"}})
    print("CORE_US_REPAIR=DISPATCHED; critical audit still blocks")
    return True
if __name__=="__main__":
    audit=json.loads(Path("market-observatory/data/data-audit.json").read_text())
    try:
        run(audit,os.getenv("GH_TOKEN"),os.getenv("GH_REPOSITORY"))
    except (HTTPError,URLError,ValueError) as e:
        print("CORE_US_REPAIR=ERROR "+str(e),file=sys.stderr)
