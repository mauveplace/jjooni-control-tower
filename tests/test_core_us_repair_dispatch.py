import unittest
from tools.dispatch_core_us_repair import run, lagging
LAG={"issues":[{"code":"GROUP_CORE_US_LAGGING","severity":"CRITICAL"}]}
class Tests(unittest.TestCase):
    def test_filter(self):
        self.assertTrue(lagging(LAG))
        self.assertFalse(lagging({"issues":None}))
        self.assertFalse(lagging({"issues":[{"code":"OTHER","severity":"CRITICAL"}]}))
    def test_dispatch(self):
        calls=[]
        def api(method,path,token,payload=None):
            calls.append(method)
            return {"workflow_runs":[]}
        self.assertTrue(run(LAG,"token","owner/repo",api))
        self.assertEqual(calls.count("POST"),1)
    def test_dedup(self):
        calls=[]
        def api(method,path,token,payload=None):
            calls.append(method)
            return {"workflow_runs":[{"head_branch":"main"}]} if "status=queued" in path else {"workflow_runs":[]}
        self.assertFalse(run(LAG,"token","owner/repo",api))
        self.assertNotIn("POST",calls)
if __name__=="__main__": unittest.main()
