function cleanString(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/[<>]/g, '');
}

function sanitizeObject(obj = {}) {
  const out = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (typeof value === 'string') {
      out[key] = cleanString(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeObject(item)
          : typeof item === 'string'
            ? cleanString(item)
            : item
      );
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeObject(value);
    } else {
      out[key] = value;
    }
  }

  return out;
}

module.exports = { sanitizeObject };
