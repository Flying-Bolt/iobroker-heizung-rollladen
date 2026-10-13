import json, sys, time, base64, subprocess, urllib.request, websocket
url=sys.argv[1]; steps=json.load(open(sys.argv[2])); shotpath=sys.argv[3] if len(sys.argv)>3 else None
prof="/tmp/profil_cdp"
p=subprocess.Popen(["google-chrome","--headless=new","--disable-gpu","--no-sandbox",f"--user-data-dir={prof}","--remote-debugging-port=9333","--remote-allow-origins=*","--window-size=1640,1420","about:blank"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(40):
        try: tabs=json.load(urllib.request.urlopen("http://127.0.0.1:9333/json")); break
        except Exception: time.sleep(0.5)
    ws=websocket.create_connection([t for t in tabs if t["type"]=="page"][0]["webSocketDebuggerUrl"],timeout=90); i=0
    def call(m,**pr):
        global i; i+=1; ws.send(json.dumps({"id":i,"method":m,"params":pr}))
        while True:
            r=json.loads(ws.recv())
            if r.get("id")==i: return r
    call("Emulation.setDeviceMetricsOverride",width=1640,height=1420,deviceScaleFactor=1,mobile=False)
    call("Page.navigate",url=url); time.sleep(30)
    for s in steps:
        r=call("Runtime.evaluate",expression=s["js"],returnByValue=True)
        print("->",s.get("name",s["js"][:60]),"=",json.dumps(r["result"].get("result",{}).get("value"),ensure_ascii=False))
        time.sleep(s.get("sleep",1))
    if shotpath:
        open(shotpath,"wb").write(base64.b64decode(call("Page.captureScreenshot",format="png")["result"]["data"]))
finally:
    p.terminate()
