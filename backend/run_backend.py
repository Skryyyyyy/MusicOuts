import sys
from pathlib import Path
import uvicorn

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.config import HOST, PORT

if __name__ == "__main__":
    print(f"Starting WalkOuts Backend on {HOST}:{PORT} ...")
    uvicorn.run("backend.app.main:app", host=HOST, port=PORT, reload=True)
