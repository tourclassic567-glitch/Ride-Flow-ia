function cleanString(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/[<>]/g, '');
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return cleanString(value);
  } else if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  } else if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj = {}) {
  const out = {};

  for (const key of Object.keys(obj)) {
    out[key] = sanitizeValue(obj[key]);
  }

  return out;
}

module.exports = { sanitizeObject };
