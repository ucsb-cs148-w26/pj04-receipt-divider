from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
client = create_client(os.getenv("supabase_url"), os.getenv("supabase_key"))
res = client.auth.sign_in_with_password(
    {
        "email": os.getenv("supabase_test_email"),
        "password": os.getenv("supabase_test_paswd"),
    }
)

print(res.session.access_token)
