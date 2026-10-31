/**
 * Page session evaluation and authentication redirect guards.
 * Detects login/SSO redirects or access denied pages and skips them gracefully.
 * Never attempts to log in, bypass paywalls, read cookies, or export credentials.
 */

export interface PageSessionEvaluation {
  isAuthRedirect: boolean;
  isAccessDenied: boolean;
  isContentPage: boolean;
  reason?: string | undefined;
  statusCode?: number | undefined;
  finalUrl: string;
}

export interface SessionEvaluationInput {
  requestedUrl: string;
  finalUrl: string;
  statusCode?: number | undefined;
  documentTitle?: string | undefined;
  hasPasswordField?: boolean | undefined;
}

const AUTH_PATH_PATTERNS = [
  /(?:^|\/)(?:login|signin|sign-in|log-in)(?:\/|$|\?)/i,
  /(?:^|\/)(?:auth|authentication|oauth|sso|saml|identity)(?:\/|$|\?)/i,
  /(?:^|\/)(?:password\/reset|forgot-password)(?:\/|$|\?)/i
];

const ACCESS_DENIED_PATH_PATTERNS = [
  /(?:^|\/)(?:access-denied|unauthorized|forbidden|403|401)(?:\/|$|\?)/i
];

/**
 * Evaluates whether a requested page was redirected to an authentication, SSO,
 * or access-denied screen.
 */
export function evaluatePageSession(input: SessionEvaluationInput): PageSessionEvaluation {
  const { requestedUrl, finalUrl, statusCode, documentTitle, hasPasswordField } = input;

  let finalPathname = '';
  try {
    const parsed = new URL(finalUrl);
    finalPathname = parsed.pathname.toLowerCase();
  } catch {
    finalPathname = finalUrl.toLowerCase();
  }

  // 1. Check HTTP status codes (401 Unauthorized, 403 Forbidden)
  if (statusCode === 401 || statusCode === 403) {
    return {
      isAuthRedirect: statusCode === 401,
      isAccessDenied: true,
      isContentPage: false,
      statusCode,
      finalUrl,
      reason: statusCode === 401 ? 'HTTP 401 Unauthorized' : 'HTTP 403 Forbidden'
    };
  }

  // 2. Check access denied paths
  for (const pattern of ACCESS_DENIED_PATH_PATTERNS) {
    if (pattern.test(finalPathname)) {
      return {
        isAuthRedirect: false,
        isAccessDenied: true,
        isContentPage: false,
        statusCode,
        finalUrl,
        reason: `Access denied path detected: ${finalPathname}`
      };
    }
  }

  // 3. Check auth/login paths (especially if requestedUrl was a content page)
  for (const pattern of AUTH_PATH_PATTERNS) {
    if (pattern.test(finalPathname)) {
      const requestedPath = getPathname(requestedUrl);
      const wasRedirected = requestedPath !== finalPathname;
      return {
        isAuthRedirect: true,
        isAccessDenied: false,
        isContentPage: false,
        statusCode,
        finalUrl,
        reason: wasRedirected
          ? `Redirected from ${requestedPath} to login screen: ${finalPathname}`
          : `Login or authentication page detected: ${finalPathname}`
      };
    }
  }

  // 4. Check DOM cues if document is loaded
  if (documentTitle) {
    const lowerTitle = documentTitle.toLowerCase();
    if (
      lowerTitle.includes('login') ||
      lowerTitle.includes('sign in') ||
      lowerTitle.includes('log in') ||
      lowerTitle.includes('authenticate') ||
      lowerTitle.includes('sso portal')
    ) {
      return {
        isAuthRedirect: true,
        isAccessDenied: false,
        isContentPage: false,
        statusCode,
        finalUrl,
        reason: `Page title indicates login screen: "${documentTitle}"`
      };
    }

    if (lowerTitle.includes('access denied') || lowerTitle.includes('403 forbidden')) {
      return {
        isAuthRedirect: false,
        isAccessDenied: true,
        isContentPage: false,
        statusCode,
        finalUrl,
        reason: `Page title indicates access denied: "${documentTitle}"`
      };
    }
  }

  // 5. Check if page contains an active password input (unexpected login form)
  if (hasPasswordField) {
    const requestedPath = getPathname(requestedUrl);
    if (!requestedPath.includes('login') && !requestedPath.includes('signin')) {
      return {
        isAuthRedirect: true,
        isAccessDenied: false,
        isContentPage: false,
        statusCode,
        finalUrl,
        reason: 'Password input form detected on redirected content route.'
      };
    }
  }

  return {
    isAuthRedirect: false,
    isAccessDenied: false,
    isContentPage: true,
    statusCode,
    finalUrl
  };
}

function getPathname(urlStr: string): string {
  try {
    return new URL(urlStr).pathname.toLowerCase();
  } catch {
    return urlStr.toLowerCase();
  }
}
