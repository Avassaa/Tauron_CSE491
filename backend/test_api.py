import asyncio
import httpx
import uuid

async def test():
    async with httpx.AsyncClient() as client:
        # Assuming admin/admin or test user is in DB?
        # Let's try to find an existing access token or create a user.
        # It's easier to just hit an endpoint that gives us a token.
        login_data = {
            "username": "irem@gmail.com",
            "password": "password" # I see iremkrkaplaniiii and irem@gmail.com in the screenshot
        }
        res = await client.post("http://localhost:8000/api/v1/auth/login", data=login_data)
        if res.status_code != 200:
            # Let's try to register the user
            print("Login failed:", res.status_code, res.text)
            return

        token = res.json()["access_token"]
        print("Logged in!")

        sess_id = str(uuid.uuid4())
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        body = {
            "session_id": sess_id,
            "role": "user",
            "content": "Hello World test"
        }
        
        print("Posting to chat-history...")
        res = await client.post("http://localhost:8000/api/v1/chat-history", json=body, headers=headers)
        print("Status:", res.status_code)
        print("Body:", res.text)
        
        res2 = await client.get("http://localhost:8000/api/v1/chat-history/sessions", headers=headers)
        print("Sessions:", res2.json())

asyncio.run(test())
