export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function normalizeApiError(error, fallbackMessage = 'Request failed. Please try again.') {
  const status = error?.response?.status || 0;
  const detail = error?.response?.data?.detail;

  if (status === 401) {
    return new ApiError('Your session expired. Please login again.', { status, code: 'UNAUTHORIZED', details: detail });
  }
  if (status === 403) {
    return new ApiError('Access denied for this operation.', { status, code: 'FORBIDDEN', details: detail });
  }
  if (status === 404) {
    return new ApiError('Requested resource was not found.', { status, code: 'NOT_FOUND', details: detail });
  }
  if (status === 422) {
    return new ApiError('Invalid input. Please check your values and retry.', { status, code: 'VALIDATION_ERROR', details: detail });
  }
  if (status === 429) {
    return new ApiError(detail || 'Too many requests. Please wait and try again.', { status, code: 'RATE_LIMITED', details: detail });
  }
  if (status === 400) {
    return new ApiError(detail || fallbackMessage, { status, code: 'BAD_REQUEST', details: detail });
  }
  if (status >= 500) {
    return new ApiError('Backend service error. Please retry shortly.', { status, code: 'SERVER_ERROR', details: detail });
  }
  if (!status) {
    return new ApiError('Network unavailable. Verify backend is running and reachable.', { status: 0, code: 'NETWORK_ERROR', details: error?.message });
  }

  return new ApiError(fallbackMessage, {
    status,
    code: 'REQUEST_ERROR',
    details: detail || error?.message
  });
}

export function getDisplayError(error, fallbackMessage = 'Something went wrong.') {
  if (!error) return fallbackMessage;
  if (error instanceof ApiError) return error.message;
  if (typeof error === 'string') return error;
  return error?.message || fallbackMessage;
}
