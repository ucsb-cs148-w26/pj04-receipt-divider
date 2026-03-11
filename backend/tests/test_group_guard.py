"""Integration test: non-hosts cannot add/remove items and receipts once a room is finished."""

import base64
import json
import requests


def jwt_subject(token: str) -> str:
    """Decode the JWT payload (no signature check) and return the 'sub' claim."""
    payload_b64 = token.split(".")[1]
    # Add padding
    payload_b64 += "=" * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(payload_b64))["sub"]


SUPA_URL = "https://cdqfpzuszcttfzolhykq.supabase.co"
ANON_KEY = "sb_publishable_B6861c8WEda1w-ih0MeTPw_LvojmY5V"
API = "http://localhost:8000"


def supa_login(email: str, password: str) -> str:
    r = requests.post(
        f"{SUPA_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
    )
    r.raise_for_status()
    return r.json()["access_token"]


def api(method, path, token=None, **kwargs):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, f"{API}{path}", headers=headers, **kwargs)


def run():
    print("=== Room-Completed Guard Test ===\n")

    # 1. Host login
    host_token = supa_login("eezy.receipt@gmail.com", "Eezy.receipt!")
    print("[1] Host logged in ✓")

    # 2. Create group
    r = api("POST", "/group/create", host_token, json={"groupName": "GuardTest"})
    r.raise_for_status()
    group_id = r.json()["groupId"]
    print(f"[2] Created group: {group_id} ✓")

    # 3. Create guest user in the group
    r = api(
        "POST",
        "/group/create-profile",
        json={"groupId": group_id, "username": "GuestTester"},
    )
    r.raise_for_status()
    guest_token = r.json()["accessToken"]
    guest_profile_id = jwt_subject(guest_token)
    print("[3] Guest profile created ✓")

    # 4. Add a manual receipt + item as host
    r = api("POST", "/group/receipt/manual", host_token, json={"groupId": group_id})
    r.raise_for_status()
    receipt_id = r.json()["receiptId"]
    print(f"[4] Receipt created: {receipt_id} ✓")

    r = api(
        "POST",
        "/group/item/add",
        host_token,
        json={
            "groupId": group_id,
            "receiptId": receipt_id,
            "name": "Pizza",
            "unitPrice": 10.0,
        },
    )
    r.raise_for_status()
    item_id = r.json()["itemId"]
    print(f"[5] Item created: {item_id} ✓")

    # 5. Finish the group (host only)
    r = api("PATCH", "/group/finish", host_token, json={"groupId": group_id})
    r.raise_for_status()
    print("[6] Group finished ✓\n")

    failures = []

    # --- Test: guest tries to add an item ---
    r = api(
        "POST",
        "/group/item/add",
        guest_token,
        json={
            "groupId": group_id,
            "receiptId": receipt_id,
            "name": "Sneaky",
            "unitPrice": 5.0,
        },
    )
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from add_item (403) ✓")
    else:
        print(f"[FAIL] Guest add_item returned {r.status_code}: {r.text}")
        failures.append("add_item")

    # --- Test: guest tries to delete an item ---
    r = api("DELETE", "/group/item", guest_token, json={"itemId": item_id})
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from delete_item (403) ✓")
    else:
        print(f"[FAIL] Guest delete_item returned {r.status_code}: {r.text}")
        failures.append("delete_item")

    # --- Test: guest tries to delete the receipt ---
    r = api("DELETE", "/group/receipt", guest_token, json={"receiptId": receipt_id})
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from delete_receipt (403) ✓")
    else:
        print(f"[FAIL] Guest delete_receipt returned {r.status_code}: {r.text}")
        failures.append("delete_receipt")

    # --- Test: guest tries to create a manual receipt ---
    r = api("POST", "/group/receipt/manual", guest_token, json={"groupId": group_id})
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from create_manual_receipt (403) ✓")
    else:
        print(f"[FAIL] Guest create_manual_receipt returned {r.status_code}: {r.text}")
        failures.append("create_manual_receipt")

    # --- Test: guest tries to update an item ---
    r = api(
        "PATCH",
        "/group/item",
        guest_token,
        json={"itemId": item_id, "name": "Hacked", "unitPrice": 0.01},
    )
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from update_item (403) ✓")
    else:
        print(f"[FAIL] Guest update_item returned {r.status_code}: {r.text}")
        failures.append("update_item")

    # --- Test: guest tries to claim an item ---
    r = api("POST", "/group/item/claim", guest_token, json={"itemId": item_id})
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from claim_item (403) ✓")
    else:
        print(f"[FAIL] Guest claim_item returned {r.status_code}: {r.text}")
        failures.append("claim_item")

    # --- Test: guest tries to self-assign an item ---
    r = api(
        "POST",
        "/group/item/assign",
        guest_token,
        json={"itemId": item_id, "guestProfileId": guest_profile_id},
    )
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from assign_item (403) ✓")
    else:
        print(f"[FAIL] Guest assign_item returned {r.status_code}: {r.text}")
        failures.append("assign_item")

    # --- Test: guest tries to self-unassign an item ---
    r = api(
        "POST",
        "/group/item/unassign",
        guest_token,
        json={"itemId": item_id, "guestProfileId": guest_profile_id},
    )
    if r.status_code == 403:
        print(f"[PASS] Guest blocked from unassign_item (403) ✓")
    else:
        print(f"[FAIL] Guest unassign_item returned {r.status_code}: {r.text}")
        failures.append("unassign_item")

    # --- Test: host CAN still delete item after finish ---
    r = api("DELETE", "/group/item", host_token, json={"itemId": item_id})
    if r.status_code in (200, 204):
        print(f"[PASS] Host can still delete item after finish ✓")
    else:
        print(f"[FAIL] Host delete_item returned {r.status_code}: {r.text}")
        failures.append("host_delete_item")

    print()
    if failures:
        print(f"❌ FAILED: {failures}")
    else:
        print("✅ All guards working correctly!")


if __name__ == "__main__":
    run()
