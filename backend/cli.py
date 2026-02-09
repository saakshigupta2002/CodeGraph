"""CLI entry point: `codegraph start` boots the server and opens the browser."""

import subprocess
import sys
import threading
import time
import webbrowser


def main():
    args = sys.argv[1:]

    if not args or args[0] == "start":
        start_server()
    elif args[0] == "version":
        print("CodeGraph v1.0.0")
    elif args[0] == "help":
        print("Usage: codegraph [command]")
        print("")
        print("Commands:")
        print("  start    Start the CodeGraph server (default)")
        print("  version  Show version")
        print("  help     Show this help message")
    else:
        print(f"Unknown command: {args[0]}")
        print("Run 'codegraph help' for usage info")
        sys.exit(1)


def start_server():
    from backend.config import FRONTEND_PORT, HOST, PORT

    print(f"""
    ╔══════════════════════════════════════╗
    ║          CodeGraph v1.0.0            ║
    ║   A living X-ray of your codebase   ║
    ╚══════════════════════════════════════╝

    Backend:  http://{HOST}:{PORT}
    Frontend: http://localhost:{FRONTEND_PORT}
    """)

    # Open browser after a short delay
    def open_browser():
        time.sleep(2)
        webbrowser.open(f"http://localhost:{FRONTEND_PORT}")

    threading.Thread(target=open_browser, daemon=True).start()

    # Start uvicorn
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
