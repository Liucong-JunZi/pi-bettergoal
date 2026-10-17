import json, pathlib, subprocess, time, sys, os, traceback
p=pathlib.Path(sys.argv[1]);plan=json.loads((p/'plan.json').read_text());start=time.time();checks=[]
def cmd(args,timeout=35):
 r=subprocess.run(['kaggle',*args],capture_output=True,text=True,timeout=timeout)
 return {'code':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
def finish(data):
 data.update(kernel=plan['kernel'],elapsed_seconds=time.time()-start,checks=checks)
 tmp=p/'finished.tmp';tmp.write_text(json.dumps(data,indent=2));os.replace(tmp,p/'finished.json')
try:
 for i in range(40):
  r=cmd(['kernels','status',plan['kernel']]);checks.append({'at':time.time(),**r});(p/'watch-progress.json').write_text(json.dumps(checks,indent=2))
  text=(r['stdout']+r['stderr']).lower()
  if r['code']==0 and 'complete' in text:
   out=cmd(['kernels','output',plan['kernel'],'-p',str(p/'output')],90);(p/'download.json').write_text(json.dumps(out,indent=2))
   if out['code']!=0:raise RuntimeError('Output download failed')
   receipt=json.loads((p/'output/wake-receipt.json').read_text())
   if receipt.get('token')!=plan['token'] or receipt.get('completed') is not True:raise RuntimeError('Receipt mismatch')
   finish({'success':True,'receipt':receipt});break
  if r['code']==0 and any(x in text for x in ['error','cancelled','canceled']):
   finish({'success':False,'error':'Kernel terminal failure','status':r});break
  time.sleep(30)
 else:finish({'success':False,'error':'40-check bounded monitor exhausted'})
except Exception:
 finish({'success':False,'error':traceback.format_exc()})
