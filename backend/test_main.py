import pytest
from fastapi.testclient import TestClient
from main import app, Database
import json
from unittest.mock import Mock, patch

# Test client
client = TestClient(app)

# Mock database for testing
@pytest.fixture
def mock_db():
    with patch('main.db') as mock:
        mock.get_items.return_value = [
            {
                "id": 1,
                "item_id": "test_item_01",
                "name": "Test Item",
                "location": "Test Location",
                "status": "Working",
                "created_at": "2024-01-01T00:00:00Z"
            }
        ]
        mock.get_messages.return_value = [
            {
                "id": 1,
                "item_id": "test_item_01",
                "message": "Test message",
                "user_name": "Test User",
                "msg_type": "general",
                "created_at": "2024-01-01T00:00:00Z",
                "formatted_time": "2024年01月01日 09:00"
            }
        ]
        mock.add_item.return_value = (True, "Success")
        mock.add_message.return_value = (True, "Message posted successfully")
        mock.update_item_status.return_value = True
        mock.delete_item.return_value = True
        yield mock

class TestAPI:
    def test_root(self):
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {"message": "Digital Memo Tag API"}

    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert "status" in response.json()
        assert response.json()["status"] == "healthy"

    def test_login_success(self):
        response = client.post("/login", json={"password": "1234"})
        assert response.status_code == 200
        assert response.json()["success"] == True
        assert "token" in response.json()

    def test_login_failure(self):
        response = client.post("/login", json={"password": "wrong"})
        assert response.status_code == 401

    def test_get_items(self, mock_db):
        response = client.get("/items")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)

    def test_get_item_by_id(self, mock_db):
        response = client.get("/items/test_item_01")
        assert response.status_code == 200
        item = response.json()
        assert item["item_id"] == "test_item_01"

    def test_get_item_not_found(self, mock_db):
        mock_db.get_items.return_value = []
        response = client.get("/items/nonexistent")
        assert response.status_code == 404

    def test_create_item_unauthorized(self):
        response = client.post("/items", json={
            "item_id": "test_new",
            "name": "New Item",
            "location": "New Location",
            "status": "Working"
        })
        assert response.status_code == 401

    def test_create_item_authorized(self, mock_db):
        headers = {"Authorization": "Bearer 1234"}
        response = client.post("/items", 
            json={
                "item_id": "test_new",
                "name": "New Item",
                "location": "New Location",
                "status": "Working"
            },
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True

    def test_get_messages(self, mock_db):
        response = client.get("/messages")
        assert response.status_code == 200
        messages = response.json()
        assert isinstance(messages, list)

    def test_get_messages_for_item(self, mock_db):
        response = client.get("/messages?item_id=test_item_01")
        assert response.status_code == 200
        messages = response.json()
        assert isinstance(messages, list)

    def test_create_message(self, mock_db):
        response = client.post("/messages", json={
            "item_id": "test_item_01",
            "message": "Test message",
            "user_name": "Test User",
            "msg_type": "general"
        })
        assert response.status_code == 200
        assert response.json()["success"] == True

    def test_create_message_empty(self, mock_db):
        mock_db.add_message.return_value = (False, "Message is empty")
        response = client.post("/messages", json={
            "item_id": "test_item_01",
            "message": "",
            "user_name": "Test User",
            "msg_type": "general"
        })
        assert response.status_code == 400

    def test_update_item_status_authorized(self, mock_db):
        headers = {"Authorization": "Bearer 1234"}
        response = client.patch("/items/test_item_01/status",
            json={"status": "Needs Maintenance"},
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True

    def test_delete_item_authorized(self, mock_db):
        headers = {"Authorization": "Bearer 1234"}
        response = client.delete("/items/test_item_01", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] == True

class TestTimestampFormatting:
    def test_format_timestamp_jst(self):
        from main import format_timestamp_jst
        
        # Test UTC timestamp
        utc_time = "2024-01-01T00:00:00Z"
        result = format_timestamp_jst(utc_time)
        assert "2024年01月01日 09:00" == result
        
        # Test empty timestamp
        result = format_timestamp_jst("")
        assert result == "時刻不明"
        
        # Test None timestamp
        result = format_timestamp_jst(None)
        assert result == "時刻不明"

class TestDatabase:
    @patch('requests.get')
    def test_get_items_success(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = [{"item_id": "test"}]
        
        db = Database()
        items = db.get_items()
        assert len(items) == 1
        assert items[0]["item_id"] == "test"

    @patch('requests.get')
    def test_get_items_failure(self, mock_get):
        mock_get.return_value.status_code = 500
        
        db = Database()
        items = db.get_items()
        assert items == []

    @patch('requests.post')
    def test_add_item_success(self, mock_post):
        mock_post.return_value.status_code = 201
        
        db = Database()
        db.get_items = Mock(return_value=[])  # No existing items
        
        success, message = db.add_item("test_id", "Test", "Location", "Working")
        assert success == True
        assert message == "Success"

    @patch('requests.post')
    def test_add_message_success(self, mock_post):
        mock_post.return_value.status_code = 201
        
        db = Database()
        success, message = db.add_message("test_id", "Test message", "User", "general")
        assert success == True
        assert "successfully" in message

if __name__ == "__main__":
    pytest.main([__file__])