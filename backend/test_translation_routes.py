import pytest
from flask import Flask
from unittest.mock import patch

from routes.translation_routes import translation_bp


@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(translation_bp)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_translate_text_persists_translation_to_database(client):
    insert_calls = []

    def fake_execute(query, params=None, fetch=None):
        if fetch == "one":
            return None
        if "INSERT INTO TRANSLATIONS" in query.upper():
            insert_calls.append((query, params))
            return None
        return None

    with patch("routes.translation_routes.TranslationFilter.should_skip", return_value=False), \
         patch("routes.translation_routes.get_provider_settings", return_value={
             "provider": "openai",
             "model": "gpt-4o-mini",
             "api_keys": {"openai": "test-key"},
         }), \
         patch("routes.translation_routes.get_provider_response", return_value="Bonjour"), \
         patch("routes.translation_routes.execute", side_effect=fake_execute) as mock_execute:
        response = client.post("/translate", json={
            "source_text": "Hello",
            "target_language": "French"
        })

    assert response.status_code == 200
    assert response.get_json()["translated_text"] == "Bonjour"
    assert len(insert_calls) == 1
    assert mock_execute.call_count >= 2
