import io, json, re, tempfile, unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tools import dispatch_core_us_repair as d
from tools.dispatch_core_us_repair import run, lagging, session_ready_utc

LAG={"issues":[{"code":"GROUP_CORE_US_LAGGING","severity":"CRITICAL"}],
     "groups":{"core_us":{"anchor":"2026-11-12","state":"LAGGING"}}}
READY=session_ready_utc("2026-11-12")  # 2026-11-12T21:15Z (EST)
def iso(t): return t.strftime("%Y-%m-%dT%H:%M:%SZ")
def fake(dispatches=(), active=False, calls=None):
    calls=[] if calls is None else calls
    def api(method,path,token,payload=None):
        calls.append((method,path))
        if method=="POST": return {}
        if "status=" in path: return {"workflow_runs":[{"head_branch":"main"}] if active else []}
        return {"workflow_runs":[{"head_branch":"main","created_at":iso(t)} for t in dispatches]}
    return api,calls
def quiet(fn,*a,**k):
    out=io.StringIO()
    with redirect_stdout(out),redirect_stderr(out): r=fn(*a,**k)
    return r,out.getvalue()

class Filter(unittest.TestCase):
    def test_filter(self):
        self.assertTrue(lagging(LAG))
        self.assertFalse(lagging({"issues":None}))
        self.assertFalse(lagging({"issues":["bad",None]}))
        self.assertFalse(lagging({"issues":[{"code":"OTHER","severity":"CRITICAL"}]}))
    def test_ready_clock(self):
        self.assertEqual(iso(READY),"2026-11-12T21:15:00Z")
        self.assertEqual(iso(session_ready_utc("2026-11-27")),"2026-11-27T18:15:00Z")  # early close

class Dispatch(unittest.TestCase):
    def test_first_dispatch(self):
        api,calls=fake()
        r,out=quiet(run,LAG,"t","o/r",api,now=READY+timedelta(minutes=40))
        self.assertTrue(r); self.assertEqual([c for c in calls if c[0]=="POST"].__len__(),1)
        self.assertIn("attempt=1/3",out)
        q=[p for m,p in calls if "event=workflow_dispatch" in p][0]
        self.assertIn("created=%3E%3D2026-11-12T21%3A15%3A00Z",q)
    def test_active_run_blocks(self):
        api,calls=fake(active=True)
        self.assertFalse(quiet(run,LAG,"t","o/r",api,now=READY+timedelta(hours=1))[0])
        self.assertNotIn("POST",[m for m,_ in calls])
    def test_recent_window_edges(self):
        now=READY+timedelta(hours=2)
        api,calls=fake([now-timedelta(minutes=29)])
        self.assertFalse(quiet(run,LAG,"t","o/r",api,now=now)[0])
        api,calls=fake([now-timedelta(minutes=31)])
        self.assertTrue(quiet(run,LAG,"t","o/r",api,now=now)[0])
    def test_session_cap_exhausted(self):
        now=READY+timedelta(hours=5)
        api,calls=fake([READY+timedelta(minutes=m) for m in (10,50,120)])
        r,out=quiet(run,LAG,"t","o/r",api,now=now)
        self.assertFalse(r); self.assertIn("CORE_US_REPAIR=EXHAUSTED",out)
        self.assertNotIn("POST",[m for m,_ in calls])
    def test_previous_session_dispatches_not_counted(self):
        now=READY+timedelta(hours=1)
        api,_=fake([READY-timedelta(hours=h) for h in (2,3,4)])  # yesterday's repairs
        self.assertTrue(quiet(run,LAG,"t","o/r",api,now=now)[0])
    def test_non_main_ignored(self):
        def api(method,path,token,payload=None):
            if method=="POST": return {}
            return {"workflow_runs":[{"head_branch":"feature","created_at":iso(READY)}]*5}
        self.assertTrue(quiet(run,LAG,"t","o/r",api,now=READY+timedelta(hours=1))[0])
    def test_not_lagging_makes_no_call(self):
        api,calls=fake()
        self.assertFalse(quiet(run,{"issues":[]},"t","o/r",api)[0]); self.assertEqual(calls,[])

class BestEffort(unittest.TestCase):
    def _main(self,exc=None,body=None):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"a.json"; p.write_text(body if body is not None else json.dumps(LAG))
            def api(*a,**k): raise exc
            import os; os.environ["GH_TOKEN"]="t"; os.environ["GH_REPOSITORY"]="o/r"
            return quiet(d.main,str(p),api)
    def test_timeout_does_not_stop_step(self):
        r,out=self._main(TimeoutError("read timed out"))
        self.assertEqual(r,0); self.assertIn("CORE_US_REPAIR=ERROR TimeoutError",out)
    def test_bad_json_response_does_not_stop_step(self):
        r,out=self._main(json.JSONDecodeError("x","",0))
        self.assertEqual(r,0); self.assertIn("JSONDecodeError",out)
    def test_corrupt_audit_file_does_not_stop_step(self):
        r,out=self._main(body="{not json")
        self.assertEqual(r,0); self.assertIn("CORE_US_REPAIR=ERROR",out)

class WorkflowContract(unittest.TestCase):
    def test_guard_and_order(self):
        wf=Path(".github/workflows/market-observatory-freshness-ui.yml").read_text()
        rep=wf.index("Request missing US-close repair once"); acc=wf.index("Freshness and full-data audit acceptance")
        self.assertLess(rep,acc)
        self.assertIn("continue-on-error: true",wf[rep:acc])
        self.assertNotIn("continue-on-error",wf[acc:])  # acceptance itself must stay blocking
        self.assertIn("assert int(a.get('critical_count') or 0)==0",wf[acc:])
if __name__=="__main__": unittest.main()
