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
    has_headers: Optional[bool] = True

# --- Helpers ---
def csv_hash(df):
    return hashlib.md5(
        pd.util.hash_pandas_object(df, index=True).values
    ).hexdigest()

def get_gsheet_df(sheet_url: str, gid: str = None, has_headers: bool = True) -> pd.DataFrame:
    raw_values = []
    
    # 1. Fetch Raw Data (List of Lists)
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
        
        raw_values = worksheet.get_all_values()
    else:
        # Public sheet logic
        base_url = sheet_url.split('/edit')[0]
        csv_url = f"{base_url}/export?format=csv"
        if gid:
            csv_url += f"&gid={gid}"
        
        start = time.time()
        last_hash = None
        
        while True:
            # header=None ensures we read the file exactly as it is (no rows skipped)
            df_temp = pd.read_csv(csv_url, header=None, on_bad_lines='skip')
            current_hash = hashlib.md5(pd.util.hash_pandas_object(df_temp).values).hexdigest()
            
            if last_hash is not None and current_hash == last_hash:
                raw_values = df_temp.values.tolist()
                break
                
            last_hash = current_hash
            if time.time() - start > 30: # 30s is more than enough for small CSVs
                if not df_temp.empty:
                    raw_values = df_temp.values.tolist()
                    break
                raise TimeoutError("Sheet data did not stabilize")
            time.sleep(1)

    # 2. Process Header Logic (Lossless)
    if not raw_values:
        return pd.DataFrame()

    if has_headers:
        # First row is headers
        columns = [str(x) for x in raw_values[0]]
        data_rows = raw_values[1:]
        return pd.DataFrame(data_rows, columns=columns)
    else:
        # No headers: keep all rows (including row 0), use numeric columns
        return pd.DataFrame(raw_values)

# --- Routes ---

@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/data")
def get_data(req: SheetRequest):
    try:
        df = get_gsheet_df(req.sheet_url, req.gid, req.has_headers)
        # Convert NaN to None for valid JSON
        records = df.where(pd.notnull(df), None).to_dict(orient='records')
        response = JSONResponse(content=records)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    except Exception as e:
        print(f"Error: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=400)

@app.post("/analyze")
def analyze(req: SheetRequest):
    try:
        df = get_gsheet_df(req.sheet_url, req.gid, req.has_headers)
        response = JSONResponse(content={
            'columns': list(df.columns),
            'preview': df.head(10).where(pd.notnull(df), None).to_dict(orient='records'),
            'total_rows': len(df),
            'numeric_columns': list(df.select_dtypes(include=['number']).columns)
        })
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    except Exception as e:
        response = JSONResponse(content={"error": str(e)}, status_code=400)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

@app.post("/download")
def download(req: SheetRequest):
    try:
        df = get_gsheet_df(req.sheet_url, req.gid, req.has_headers)
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = Response(content=stream.getvalue(), media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=data.csv"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    except Exception as e:
        response = JSONResponse(content={"error": str(e)}, status_code=400)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
