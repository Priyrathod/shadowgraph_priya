def test_ops_readiness(client):
    response = client.get('/ops/readiness')
    assert response.status_code == 200
    assert 'checks' in response.json()


def test_scrape_schedule_crud(client, auth_headers):
    payload = {
        'seed_urls': ['https://example.com'],
        'keywords': ['example'],
        'interval_minutes': 5,
        'max_pages': 1,
        'same_domain_only': True,
    }
    create = client.post('/crawler/schedules', json=payload, headers=auth_headers)
    assert create.status_code == 200
    schedule_id = create.json()['schedule_id']

    listed = client.get('/crawler/schedules', headers=auth_headers)
    assert listed.status_code == 200
    assert any(row['schedule_id'] == schedule_id for row in listed.json()['schedules'])

    deleted = client.delete(f'/crawler/schedules/{schedule_id}', headers=auth_headers)
    assert deleted.status_code == 200
