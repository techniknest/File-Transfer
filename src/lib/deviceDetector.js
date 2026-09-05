/**
 * Device & IP detection utility.
 * Parses userAgent strings and request headers to extract device type, browser, OS, and client IP.
 */

export function parseUserAgent(userAgentString = '') {
  const ua = (userAgentString || '').toLowerCase();

  // 1. Detect Device Type
  let deviceType = 'Desktop / Laptop';
  let deviceCategory = 'desktop'; // 'desktop' | 'mobile' | 'tablet'

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'Tablet';
    deviceCategory = 'tablet';
  } else if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      ua
    )
  ) {
    deviceType = 'Mobile Phone';
    deviceCategory = 'mobile';
  }

  // 2. Detect Operating System
  let os = 'Unknown OS';
  if (ua.includes('windows nt 10.0')) os = 'Windows 10 / 11';
  else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (ua.includes('windows nt 6.2')) os = 'Windows 8';
  else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
  else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macOS';
    if (ua.includes('iphone')) os = 'iOS (iPhone)';
    else if (ua.includes('ipad')) os = 'iPadOS (iPad)';
  } else if (ua.includes('android')) {
    const match = ua.match(/android\s([0-9\.]+)/);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('cros')) {
    os = 'Chrome OS';
  }

  // 3. Detect Browser
  let browser = 'Unknown Browser';
  if (ua.includes('edg/')) {
    const match = ua.match(/edg\/([0-9\.]+)/);
    browser = `Microsoft Edge ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('opr/') || ua.includes('opera/')) {
    const match = ua.match(/(?:opr|opera)\/([0-9\.]+)/);
    browser = `Opera ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
    const match = ua.match(/chrome\/([0-9\.]+)/);
    browser = `Google Chrome ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
    const match = ua.match(/version\/([0-9\.]+)/);
    browser = `Safari ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('firefox/')) {
    const match = ua.match(/firefox\/([0-9\.]+)/);
    browser = `Mozilla Firefox ${match ? match[1].split('.')[0] : ''}`.trim();
  }

  return {
    deviceType,
    deviceCategory,
    os,
    browser,
  };
}

export function extractClientDetails(request, customPayload = {}) {
  let ip = '127.0.0.1';
  let userAgent = '';

  if (request && typeof request.headers?.get === 'function') {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    ip = forwarded ? forwarded.split(',')[0].trim() : (realIp || '127.0.0.1');
    if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';

    userAgent = request.headers.get('user-agent') || '';
  }

  if (customPayload?.userAgent) {
    userAgent = customPayload.userAgent;
  }

  const parsed = parseUserAgent(userAgent);

  return {
    ip: customPayload?.ip || ip,
    userAgent,
    deviceType: parsed.deviceType,
    deviceCategory: parsed.deviceCategory,
    os: parsed.os,
    browser: parsed.browser,
    requestTime: new Date().toISOString(),
    formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}
