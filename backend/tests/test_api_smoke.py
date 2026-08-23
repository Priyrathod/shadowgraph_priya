from fastapi.testclient import TestClient

from app.main import app


def test_health_ok():
    client = TestClient(app)
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json().get('ok') is True


def test_auth_signup_and_login_roundtrip():
    client = TestClient(app)
    email = 'smoke_shadowgraph@example.com'
    password = 'StrongPass1'

    signup = client.post('/auth/signup', json={'email': email, 'password': password, 'name': 'Smoke'})
    assert signup.status_code in (200, 409)

    login = client.post('/auth/login', json={'email': email, 'password': password})
    assert login.status_code == 200
    data = login.json()
    assert data.get('access_token')
    assert data.get('user', {}).get('email') == email
