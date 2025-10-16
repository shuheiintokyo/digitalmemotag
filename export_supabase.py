import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

print(f"DEBUG: SUPABASE_URL is: {SUPABASE_URL}") 
print(f"DEBUG: SUPABASE_KEY is: {SUPABASE_KEY[:5]}...") # Print a truncated key for safety

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
}

def export_table(table_name):
    """Export data from Supabase table"""
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table_name}?select=*",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        
        # Save to JSON file
        with open(f'{table_name}_export.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Exported {len(data)} records from {table_name}")
        return data
    else:
        print(f"❌ Error exporting {table_name}: {response.status_code}")
        return []

# Export all tables
print("Starting Supabase export...")
items = export_table('items')
messages = export_table('messages')

print("\n📊 Export Summary:")
print(f"Items: {len(items)}")
print(f"Messages: {len(messages)}")
