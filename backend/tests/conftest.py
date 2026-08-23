import pytest
from fastapi.testclient import TestClient

from app.main import Base, SessionLocal, app, engine


@pytest.fixture(scope='session', autouse=True)
def setup_schema():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def clean_db():
    db = SessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    email = 'test_user@example.com'
    password = 'TestPass123'
    signup = client.post('/auth/signup', json={'email': email, 'password': password, 'name': 'Tester'})
    assert signup.status_code == 200
    token = signup.json()['access_token']
    return {'Authorization': f'Bearer {token}'}
