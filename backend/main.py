import os
import io
import time
import hashlib
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any, Dict

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE', 'service_account.json')

# --- Models ---
class SheetRequest(BaseModel):
    sheet_url: str
    gid: Optional[str] = None

# --- Helpers ---
def csv_hash(df):
    return hashlib.md5(
        pd.util.hash_pandas_object(df, index=True).values
    ).hexdigest()

def get_gsheet_df(sheet_url: str, gid: str = None) -> pd.DataFrame:
    if os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE') and os.path.exists(SERVICE_ACCOUNT_FILE):
        creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        gc = gspread.authorize(creds)
        
        try:
            sh = gc.open_by_url(sheet_url)
        except Exception as e:
            raise Exception(f"Could not open sheet: {str(e)}")

        worksheet = None
        if gid is not None:
            for ws in sh.worksheets():
                if str(ws.id) == str(gid):
                    worksheet = ws
                    break
            if not worksheet:
                raise Exception(f"Worksheet with gid {gid} not found")
        else:
            worksheet = sh.sheet1
            
        data = worksheet.get_all_records()
        return pd.DataFrame(data)
    else:
        # Public sheet logic
        base_url = sheet_url.split('/edit')[0]
        csv_url = f"{base_url}/export?format=csv"
        
        if gid is not None:
            gid_str = str(gid).strip()
            if gid_str:
                csv_url += f"&gid={gid_str}"
        
        try:
            start = time.time()
            last_hash = None
            
            while True:
                df = pd.read_csv(csv_url, on_bad_lines='skip')
                current_hash = csv_hash(df)
                
                if current_hash == last_hash and not df.empty:
                    return df
                
                last_hash = current_hash
                
                if time.time() - start > 60:
                    raise TimeoutError("Sheet did not stabilize in time")
                
                time.sleep(1)
                
        except Exception as e:
            msg = str(e)
            if "Error tokenizing data" in msg or "ParserError" in msg:
                 raise Exception("Could not parse CSV. The sheet might not be public, or URL/GID is invalid.")
            raise Exception(f"Failed to load data: {msg}")

# --- Routes ---

@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/data")
def get_data(req: SheetRequest):
    try:
        df = get_gsheet_df(req.sheet_url, req.gid)
        # Convert NaN to None for valid JSON
        records = df.where(pd.notnull(df), None).to_dict(orient='records')
        return JSONResponse(content=records)
    except Exception as e:
        print(f"Error: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=400)

@app.post("/analyze")
def analyze(req: SheetRequest):
    try:
        df = get_gsheet_df(req.sheet_url, req.gid)
        return {
            'columns': list(df.columns),
            'preview': df.head(10).where(pd.notnull(df), None).to_dict(orient='records'),
            'total_rows': len(df),
            'numeric_columns': list(df.select_dtypes(include=['number']).columns)
        }
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)

@app.post("/download")
def download(req: SheetRequest):
    try:
        df = get_gsheet_df(req.sheet_url, req.gid)
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = Response(content=stream.getvalue(), media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=data.csv"
        return response
    except Exception as e:
         return JSONResponse(content={"error": str(e)}, status_code=400)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
