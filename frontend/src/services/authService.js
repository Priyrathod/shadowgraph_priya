import { apiClient } from './apiClient';
import { normalizeApiError } from './apiErrors';

export async function authenticateUser({ email, password, mode }) {
  try {
    const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
    const payload = mode === 'signup' ? { email, password, name: email.split('@')[0] } : { email, password };

    const { data } = await apiClient.post(endpoint, payload);

    return {
      token: data.access_token,
      user: data.user
    };
  } catch (error) {
    throw normalizeApiError(error, 'Authentication failed.');
  }
}

export async function getOAuthStartUrl(provider, redirectUri) {
  try {
    const { data } = await apiClient.get(`/auth/oauth/${provider}/start-url`, {
      params: { redirect_uri: redirectUri }
    });
    return data;
  } catch (error) {
    throw normalizeApiError(error, `Failed to start ${provider} OAuth.`);
  }
}

export async function exchangeOAuthCode({ provider, code, state, redirectUri }) {
  try {
    const { data } = await apiClient.post(`/auth/oauth/${provider}/exchange`, {
      code,
      state,
      redirect_uri: redirectUri
    });

    return {
      token: data.access_token,
      user: data.user
    };
  } catch (error) {
    throw normalizeApiError(error, `Failed to complete ${provider} OAuth.`);
  }
}
