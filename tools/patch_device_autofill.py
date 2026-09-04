from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old_css = '.row{display:flex;gap:8px}input{min-width:0;flex:1;background:#07101a;color:#fff;border:1px solid #30465c;border-radius:12px;padding:14px;font-size:16px;outline:none}input:focus{border-color:#5b9af5}button{border:0;border-radius:12px;padding:0 18px;background:#2167d5;color:#fff;font-weight:850;cursor:pointer}.msg{min-height:22px;margin-top:12px;font-size:12px;color:#8ca1b5}'
new_css = '.row{display:flex;gap:8px}.remember{display:flex;align-items:center;gap:8px;margin-top:12px;color:#91a6ba;font-size:12px;user-select:none}.remember input{width:16px;height:16px;min-width:16px;flex:none;accent-color:#2167d5}.sr-user{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;opacity:0!important}input[type=password]{min-width:0;flex:1;background:#07101a;color:#fff;border:1px solid #30465c;border-radius:12px;padding:14px;font-size:16px;outline:none}input[type=password]:focus{border-color:#5b9af5}button{border:0;border-radius:12px;padding:0 18px;background:#2167d5;color:#fff;font-weight:850;cursor:pointer}.msg{min-height:22px;margin-top:12px;font-size:12px;color:#8ca1b5}'
if old_css not in s:
    raise SystemExit('CSS_TARGET_NOT_FOUND')
s = s.replace(old_css, new_css, 1)

old_html = '<div class="row"><input id="pw" type="password" autocomplete="current-password" placeholder="Control Tower 비밀번호"><button id="go">OPEN</button></div>\n<div id="msg" class="msg"></div>'
new_html = '<form id="loginForm" autocomplete="on">\n<input class="sr-user" id="ctUser" name="username" type="text" value="jjooni-control-tower" autocomplete="username" tabindex="-1" aria-hidden="true">\n<div class="row"><input id="pw" name="password" type="password" autocomplete="current-password" enterkeyhint="go" placeholder="Control Tower 비밀번호"><button id="go" type="submit">OPEN</button></div>\n<label class="remember"><input id="rememberDevice" type="checkbox"> 이 기기에서 자동입력 사용 (Google/삼성 비밀번호 관리자)</label>\n</form>\n<div id="msg" class="msg"></div>'
if old_html not in s:
    raise SystemExit('HTML_TARGET_NOT_FOUND')
s = s.replace(old_html, new_html, 1)

old_success = "sessionStorage.setItem('jjooni_ct_session_pw',pw);\n    let html=new TextDecoder().decode(plain);"
new_success = "sessionStorage.setItem('jjooni_ct_session_pw',pw);\n    if($('rememberDevice')&&$('rememberDevice').checked){\n      localStorage.setItem('jjooni_ct_device_autofill','1');\n      try{\n        if(window.PasswordCredential&&navigator.credentials&&navigator.credentials.store){\n          navigator.credentials.store(new PasswordCredential({id:'jjooni-control-tower',password:pw,name:'JJOONI Control Tower'})).catch(()=>{});\n        }\n      }catch(_e){}\n    }\n    let html=new TextDecoder().decode(plain);"
if old_success not in s:
    raise SystemExit('SUCCESS_TARGET_NOT_FOUND')
s = s.replace(old_success, new_success, 1)

old_events = "$('go').onclick=()=>openTower($('pw').value);\n$('pw').addEventListener('keydown',e=>{if(e.key==='Enter')openTower(e.target.value)});\nconst saved=sessionStorage.getItem('jjooni_ct_session_pw'); if(saved){$('pw').value=saved;openTower(saved)}"
new_events = "$('loginForm').addEventListener('submit',e=>{e.preventDefault();openTower($('pw').value)});\nasync function tryDeviceAutofill(){\n  if(localStorage.getItem('jjooni_ct_device_autofill')!=='1')return;\n  if($('rememberDevice'))$('rememberDevice').checked=true;\n  try{\n    if(navigator.credentials&&navigator.credentials.get){\n      const cred=await navigator.credentials.get({password:true,mediation:'optional'});\n      if(cred&&cred.password){$('pw').value=cred.password;openTower(cred.password);return;}\n    }\n  }catch(_e){}\n  try{$('pw').focus()}catch(_e){}\n}\nconst saved=sessionStorage.getItem('jjooni_ct_session_pw');\nif(saved){$('pw').value=saved;if($('rememberDevice'))$('rememberDevice').checked=localStorage.getItem('jjooni_ct_device_autofill')==='1';openTower(saved)}\nelse{tryDeviceAutofill()}"
if old_events not in s:
    raise SystemExit('EVENT_TARGET_NOT_FOUND')
s = s.replace(old_events, new_events, 1)

p.write_text(s, encoding='utf-8')
print('DEVICE_AUTOFILL_PATCH=PASS')
