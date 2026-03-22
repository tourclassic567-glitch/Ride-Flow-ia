// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('Error:', err.message, err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
