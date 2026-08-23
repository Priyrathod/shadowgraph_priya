def test_scrape_sync_and_report_history(client, auth_headers):
    payload = {
        'seed_urls': ['https://example.com'],
        'keywords': ['example', 'domain'],
        'max_pages': 2,
        'same_domain_only': True,
    }
    scrape = client.post('/scrape-aggregate', json=payload, headers=auth_headers)
    assert scrape.status_code == 200
    assert scrape.json()['status'] == 'scraped'

    history = client.get('/report/history', headers=auth_headers)
    assert history.status_code == 200
    assert len(history.json()['events']) >= 1


def test_scrape_job_queue(client, auth_headers):
    payload = {
        'seed_urls': ['https://example.com'],
        'keywords': ['example'],
        'max_pages': 1,
        'same_domain_only': True,
    }
    queued = client.post('/jobs/scrape', json=payload, headers=auth_headers)
    assert queued.status_code == 200
    job_id = queued.json()['job_id']

    jobs = client.get('/jobs/scrape', headers=auth_headers)
    assert jobs.status_code == 200
    assert any(row['job_id'] == job_id for row in jobs.json()['jobs'])


def test_pdf_report_export(client, auth_headers):
    response = client.get('/report/export/pdf', headers=auth_headers)
    assert response.status_code == 200
    assert response.headers['content-type'] == 'application/pdf'
