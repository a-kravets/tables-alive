import os
import requests
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8501)
