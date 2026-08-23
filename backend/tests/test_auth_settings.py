def test_login_and_me(client):
    email = 'a@example.com'
    password = 'StrongPass1'
    signup = client.post('/auth/signup', json={'email': email, 'password': password, 'name': 'A'})
    assert signup.status_code == 200

    login = client.post('/auth/login', json={'email': email, 'password': password})
    assert login.status_code == 200
    token = login.json()['access_token']

    me = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.json()['user']['email'] == email


def test_settings_persist(client, auth_headers):
    read_resp = client.get('/settings', headers=auth_headers)
    assert read_resp.status_code == 200

    updated = client.put(
        '/settings',
        json={
            'profile_visible': False,
            'allow_aggregation': True,
            'breach_alerts': False,
            'light_theme': True,
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()['settings']['light_theme'] is True
