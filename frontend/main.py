import os
import requests
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
# Mount videos - serve from current dir or specific location? 
# The video '7947397-hd_1920_1080_30fps.mp4' is in the root of frontend usually. 
# I will mount the root for direct file access or just move video to static.
# For simplicity, I will route the specific video file or just mount root as static? NO.
# Safe way: Create an endpoint for the video or move it to static.
# I will assume I'll move it to static/media/ or serve it via a generic route.
# Let's create a specific route for the video for now to avoid moving files via complex commands if possible, 
# or better, just `app.mount("/media", ...)` and I'll ensure I create that dir and move the file.

templates = Jinja2Templates(directory="templates")

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5000")

class ProxyRequest(BaseModel):
    sheet_url: str
    gid: Optional[str] = None
    has_headers: Optional[bool] = True

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/faq", response_class=HTMLResponse)
async def read_faq(request: Request):
    return templates.TemplateResponse("faq.html", {"request": request})

@app.get("/usecases", response_class=HTMLResponse)
async def read_usecases(request: Request):
    return templates.TemplateResponse("usecases.html", {"request": request})

@app.get("/pricing", response_class=HTMLResponse)
async def read_pricing(request: Request):
    return templates.TemplateResponse("pricing.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def read_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register", response_class=HTMLResponse)
async def read_register(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def read_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/data-sources", response_class=HTMLResponse)
async def read_datasources(request: Request):
    return templates.TemplateResponse("datasources.html", {"request": request})

@app.get("/dashboards", response_class=HTMLResponse)
async def read_dashboards(request: Request):
    return templates.TemplateResponse("dashboards.html", {"request": request})

@app.get("/reports", response_class=HTMLResponse)
async def read_reports(request: Request):
    return templates.TemplateResponse("reports.html", {"request": request})

# Proxy Auth Requests
@app.post("/api/register")
async def proxy_register(request: Request):
    try:
        body = await request.json()
        resp = requests.post(f"{BACKEND_URL}/auth/register", json=body)
        if resp.status_code != 200:
             return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/login")
async def proxy_login(request: Request):
    try:
        form = await request.form()
        # forward as form data
        resp = requests.post(f"{BACKEND_URL}/auth/token", data=form, headers={"Content-Type": "application/x-www-form-urlencoded"})
        if resp.status_code != 200:
             return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        print(e)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/me")
async def proxy_me(request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.get(f"{BACKEND_URL}/auth/me", headers={'Authorization': auth_header})
        if resp.status_code != 200:
             return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/video.mp4")
async def get_video():
    from fastapi.responses import FileResponse
    return FileResponse("7947397-hd_1920_1080_30fps.mp4")

# Proxy to Backend
@app.post("/api/proxy/data")
async def proxy_data(req: ProxyRequest):
    try:
        resp = requests.post(f"{BACKEND_URL}/data", json=req.model_dump(), timeout=60)
        if resp.status_code != 200:
             return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Data Sources API Proxies
@app.get("/api/datasources")
async def proxy_list_datasources(request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.get(f"{BACKEND_URL}/datasources", headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/datasources")
async def proxy_create_datasource(request: Request):
    try:
        body = await request.json()
        auth_header = request.headers.get('Authorization')
        resp = requests.post(f"{BACKEND_URL}/datasources", json=body, headers={'Authorization': auth_header})
        if resp.status_code != 200 and resp.status_code != 201:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json(), status_code=resp.status_code)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/datasources/{datasource_id}")
async def proxy_get_datasource(datasource_id: int, request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.get(f"{BACKEND_URL}/datasources/{datasource_id}", headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.put("/api/datasources/{datasource_id}")
async def proxy_update_datasource(datasource_id: int, request: Request):
    try:
        body = await request.json()
        auth_header = request.headers.get('Authorization')
        resp = requests.put(f"{BACKEND_URL}/datasources/{datasource_id}", json=body, headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.delete("/api/datasources/{datasource_id}")
async def proxy_delete_datasource(datasource_id: int, request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.delete(f"{BACKEND_URL}/datasources/{datasource_id}", headers={'Authorization': auth_header})
        if resp.status_code != 200 and resp.status_code != 204:
            try:
                error_content = resp.json()
            except:
                error_content = {"detail": resp.text or "Unknown error"}
            return JSONResponse(status_code=resp.status_code, content=error_content)
        return Response(status_code=resp.status_code)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Dashboards API Proxies
@app.get("/api/dashboards")
async def proxy_list_dashboards(request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.get(f"{BACKEND_URL}/dashboards", headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/dashboards")
async def proxy_create_dashboard(request: Request):
    try:
        body = await request.json()
        auth_header = request.headers.get('Authorization')
        resp = requests.post(f"{BACKEND_URL}/dashboards", json=body, headers={'Authorization': auth_header})
        if resp.status_code != 200 and resp.status_code != 201:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json(), status_code=resp.status_code)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/dashboards/{dashboard_id}")
async def proxy_get_dashboard(dashboard_id: int, request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.get(f"{BACKEND_URL}/dashboards/{dashboard_id}", headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.put("/api/dashboards/{dashboard_id}")
async def proxy_update_dashboard(dashboard_id: int, request: Request):
    try:
        body = await request.json()
        auth_header = request.headers.get('Authorization')
        resp = requests.put(f"{BACKEND_URL}/dashboards/{dashboard_id}", json=body, headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.delete("/api/dashboards/{dashboard_id}")
async def proxy_delete_dashboard(dashboard_id: int, request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.delete(f"{BACKEND_URL}/dashboards/{dashboard_id}", headers={'Authorization': auth_header})
        if resp.status_code != 200 and resp.status_code != 204:
            try:
                error_content = resp.json()
            except:
                error_content = {"detail": resp.text or "Unknown error"}
            return JSONResponse(status_code=resp.status_code, content=error_content)
        return Response(status_code=resp.status_code)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Reports API Proxies
@app.get("/api/reports")
async def proxy_list_reports(request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.get(f"{BACKEND_URL}/reports", headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/reports")
async def proxy_create_report(request: Request):
    try:
        body = await request.json()
        auth_header = request.headers.get('Authorization')
        resp = requests.post(f"{BACKEND_URL}/reports", json=body, headers={'Authorization': auth_header})
        if resp.status_code != 200 and resp.status_code != 201:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json(), status_code=resp.status_code)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/reports/{report_id}")
async def proxy_get_report(report_id: int, request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.get(f"{BACKEND_URL}/reports/{report_id}", headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.put("/api/reports/{report_id}")
async def proxy_update_report(report_id: int, request: Request):
    try:
        body = await request.json()
        auth_header = request.headers.get('Authorization')
        resp = requests.put(f"{BACKEND_URL}/reports/{report_id}", json=body, headers={'Authorization': auth_header})
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        return JSONResponse(content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.delete("/api/reports/{report_id}")
async def proxy_delete_report(report_id: int, request: Request):
    try:
        auth_header = request.headers.get('Authorization')
        resp = requests.delete(f"{BACKEND_URL}/reports/{report_id}", headers={'Authorization': auth_header})
        if resp.status_code != 200 and resp.status_code != 204:
            try:
                error_content = resp.json()
            except:
                error_content = {"detail": resp.text or "Unknown error"}
            return JSONResponse(status_code=resp.status_code, content=error_content)
        return Response(status_code=resp.status_code)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8501)
