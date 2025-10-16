import resend
import os
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

try:
    params = {
        "from": os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
        "to": ["kinugasa.hirata@gmail.com"],  # ✅ Changed to YOUR email!
        "subject": "✅ Test Email from Memo Tag System",
        "html": "<strong>Resend is working!</strong><p>Your email notifications are ready.</p>",
    }
    
    email = resend.Emails.send(params)
    print(f"✅ Email sent successfully!")
    print(f"Email ID: {email['id']}")
    print(f"📧 Check your inbox: kinugasa.hirata@gmail.com")
    
except Exception as e:
    print(f"❌ Error: {e}")