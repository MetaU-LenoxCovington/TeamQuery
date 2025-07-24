#!/usr/bin/env python3
"""
dev startup script for TeamQuery python service
"""

import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

if __name__ == "__main__":
    import uvicorn

    # Set development environment variables if not set
    os.environ.setdefault("DEBUG", "true")
    os.environ.setdefault("HOST", "0.0.0.0")
    os.environ.setdefault("PORT", "8001")

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
