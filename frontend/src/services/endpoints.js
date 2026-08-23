import { apiClient } from './apiClient';
import { ApiError, normalizeApiError } from './apiErrors';

export async function scanFace(imageFile, searchText = '') {
  try {
    if (!imageFile) {
      throw new ApiError('Upload an image before scanning.', { status: 400, code: 'MISSING_FILE' });
    }

    const formData = new FormData();
    formData.append('file', imageFile);
    if (searchText?.trim()) {
      formData.append('search_text', searchText.trim());
    }

    const { data } = await apiClient.post('/upload-face', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return {
      matched_profiles: data.matched_profiles || [],
      online_presence: data.online_presence || [],
      presence_summary: data.presence_summary || { profiles_found: 0, platforms_checked: 0 },
      faces_detected: data.faces_detected ?? 0,
      fake_detection_confidence: data.fake_detection_confidence ?? 0,
      fake_detection_label: data.fake_detection_label || 'Unknown',
      anti_spoof_model: data.anti_spoof_model || 'unknown',
      signals: data.signals || {}
    };
  } catch (error) {
    throw normalizeApiError(error, 'Failed to run face scan.');
  }
}

export async function getDigitalFootprintSummary() {
  try {
    const { data } = await apiClient.get('/digital-footprint-summary');
    return data.summary || {
      total_accounts_found: 0,
      active_platforms: [],
      categories: { Social: 0, Coding: 0, Academic: 0 },
      research_papers_found: 0,
      breach_records_found: 0,
      profiles: []
    };
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load digital footprint summary.');
  }
}

export async function getReputationInsight() {
  try {
    const { data } = await apiClient.get('/reputation-insight');
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load reputation insight.');
  }
}

export async function getProfileDashboard() {
  try {
    const { data } = await apiClient.get('/profile-dashboard');
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load profile dashboard.');
  }
}

export async function getAiNarrative() {
  try {
    const { data } = await apiClient.get('/ai-narrative');
    return data.stories || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load narrative.');
  }
}

export async function getPrivacyAlerts() {
  try {
    const { data } = await apiClient.get('/privacy-alerts');
    return data.alerts || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load privacy alerts.');
  }
}

export async function getSkillRadar() {
  try {
    const { data } = await apiClient.get('/skill-radar');
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load skill radar.');
  }
}

export async function getNetworkingOpportunities() {
  try {
    const { data } = await apiClient.get('/networking-opportunities');
    return data.opportunities || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load networking opportunities.');
  }
}

export async function getActivityTimeline() {
  try {
    const { data } = await apiClient.get('/activity-timeline');
    return data.timeline || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load activity timeline.');
  }
}

export async function getPublicPersonaScore() {
  try {
    const { data } = await apiClient.get('/public-persona-score');
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load public persona score.');
  }
}

export async function getAchievements() {
  try {
    const { data } = await apiClient.get('/achievements');
    return data.badges || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load achievements.');
  }
}

export async function getPredictiveAnalytics() {
  try {
    const { data } = await apiClient.get('/predictive-analytics');
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load predictive analytics.');
  }
}

export async function getEthicalVerification() {
  try {
    const { data } = await apiClient.get('/ethical-verification');
    return data.checklist || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load ethical verification.');
  }
}

export async function scanUsername(username) {
  try {
    const { data } = await apiClient.post('/scan-username', { username });
    const rows = Array.isArray(data?.results) ? data.results : [];

    return rows
      .filter((row) => row?.status === 'Found' && typeof row?.profile_url === 'string' && row.profile_url.startsWith('http'))
      .map((row) => ({
        platform: row.platform,
        username: row.username || username,
        status: 'Found',
        link: row.profile_url
      }));
  } catch (error) {
    throw normalizeApiError(error, 'Failed to scan username across platforms.');
  }
}

export async function searchResearch(name, institution) {
  try {
    const { data } = await apiClient.post('/search-research', { full_name: name, institution });
    const papers = data.papers || [];

    return papers.map((paper) => ({
      title: paper.title,
      authors: paper.authors || `${name}, Co-authors`,
      source: paper.source,
      year: paper.year,
      citations: paper.citations,
      summary: paper.summary || '',
      url: paper.url || '',
      institution
    }));
  } catch (error) {
    throw normalizeApiError(error, 'Failed to fetch research records.');
  }
}

export async function checkBreach(email) {
  try {
    const { data } = await apiClient.post('/check-breach', { email });
    if (data.status === 'api-key-missing') {
      throw new ApiError('Breach API key is not configured on backend (HIBP_API_KEY).', { status: 503, code: 'CONFIG_MISSING' });
    }
    if (data.status === 'auth-error') {
      throw new ApiError('HIBP API key is invalid or expired.', { status: 401, code: 'UPSTREAM_AUTH' });
    }
    if (data.status === 'rate-limited') {
      throw new ApiError('HIBP rate limit reached. Try again later.', { status: 429, code: 'RATE_LIMITED' });
    }
    const breaches = data.breaches || [];
    return breaches.map((row) => ({ ...row, email }));
  } catch (error) {
    throw normalizeApiError(error, 'Failed to check breach exposure.');
  }
}

export async function calculateRisk() {
  try {
    const { data } = await apiClient.post('/calculate-risk');
    return {
      score: data.score ?? 0,
      vector: data.vector || [0, 0, 0, 0],
      tips: data.tips || [
        'Enable MFA across all recovered accounts.',
        'Remove stale public profiles without activity.',
        'Rotate credentials exposed in historical breaches.'
      ]
    };
  } catch (error) {
    throw normalizeApiError(error, 'Failed to calculate exposure score.');
  }
}

export async function graphData() {
  try {
    const { data } = await apiClient.get('/graph-data');
    return {
      nodes: data.nodes || [],
      edges: data.edges || [],
      summary: data.summary || { nodes: 0, edges: 0, events_ingested: 0 }
    };
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load graph data.');
  }
}

export async function getSettings() {
  try {
    const { data } = await apiClient.get('/settings');
    return data.settings;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load settings.');
  }
}

export async function saveSettings(settings) {
  try {
    const { data } = await apiClient.put('/settings', settings);
    return data.settings;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to save settings.');
  }
}

export async function deleteAccount() {
  try {
    const { data } = await apiClient.delete('/account');
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to delete account.');
  }
}

export async function exportPdfReport() {
  try {
    const response = await apiClient.get('/report/export/pdf', { responseType: 'blob' });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to export report.');
  }
}

export async function exportJsonReport() {
  try {
    const { data } = await apiClient.get('/report/export/json');
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to export JSON report.');
  }
}

export async function scrapeAggregate(payload) {
  try {
    const { data } = await apiClient.post('/scrape-aggregate', payload);
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to run scraping pipeline.');
  }
}

export async function enqueueScrapeJob(payload) {
  try {
    const { data } = await apiClient.post('/jobs/scrape', payload);
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to enqueue scrape job.');
  }
}

export async function listScrapeJobs() {
  try {
    const { data } = await apiClient.get('/jobs/scrape');
    return data.jobs || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load scrape jobs.');
  }
}

export async function listCrawlerSchedules() {
  try {
    const { data } = await apiClient.get('/crawler/schedules');
    return data.schedules || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load crawler schedules.');
  }
}

export async function createCrawlerSchedule(payload) {
  try {
    const { data } = await apiClient.post('/crawler/schedules', payload);
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create crawler schedule.');
  }
}

export async function deleteCrawlerSchedule(scheduleId) {
  try {
    const { data } = await apiClient.delete(`/crawler/schedules/${scheduleId}`);
    return data;
  } catch (error) {
    throw normalizeApiError(error, 'Failed to delete crawler schedule.');
  }
}

export async function getReportHistory() {
  try {
    const { data } = await apiClient.get('/report/history');
    return data.events || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load report history.');
  }
}

export async function getAuditEvents() {
  try {
    const { data } = await apiClient.get('/audit/events');
    return data.events || [];
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load audit events.');
  }
}
