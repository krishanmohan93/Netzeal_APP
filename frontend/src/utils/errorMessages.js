export const getUserFacingError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;

  const explicitMessage = error.userMessage || error.response?.data?.detail || error.response?.data?.error?.message;
  if (explicitMessage && typeof explicitMessage === 'string') {
    return explicitMessage;
  }

  const message = String(error.message || '');
  const code = error.code;

  if (
    code === 'ECONNABORTED' ||
    message === 'Network Error' ||
    /network request failed/i.test(message) ||
    /failed to fetch/i.test(message)
  ) {
    return 'You appear to be offline. Check your internet connection and try again.';
  }

  if (error.response?.status === 404) {
    return 'Requested information was not found.';
  }

  if (error.response?.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (error.response?.status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (error.response?.status >= 500) {
    return 'Server is temporarily unavailable. Please try again in a moment.';
  }

  return fallback;
};
