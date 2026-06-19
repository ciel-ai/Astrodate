"""One-off: query the highest Android version code live on Play Console."""
from google.oauth2 import service_account
from googleapiclient.discovery import build

PKG = "com.astrodate.app"
KEY = "google-service-account.json"

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/androidpublisher"]
)
service = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

edit = service.edits().insert(packageName=PKG, body={}).execute()
edit_id = edit["id"]

all_codes = []
try:
    tracks = service.edits().tracks().list(packageName=PKG, editId=edit_id).execute()
    print(f"Tracks for {PKG}:")
    for t in tracks.get("tracks", []):
        for r in t.get("releases", []):
            vcs = r.get("versionCodes", []) or []
            all_codes.extend(int(v) for v in vcs)
            print(f"  track={t['track']:12} status={r.get('status'):10} name={r.get('name')!r:10} versionCodes={vcs}")
finally:
    service.edits().delete(packageName=PKG, editId=edit_id).execute()

if all_codes:
    print(f"\nHIGHEST version code currently on Play Console: {max(all_codes)}")
    print(f"NEXT safe version code to use: {max(all_codes) + 1}")
else:
    print("\nNo releases found on any track.")
