module.exports = function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const payload = {
    status: 'error',
    action: err.action || 'global_error',
    data: {
      message: err.message || 'Internal server error'
    }
  };

  console.error(JSON.stringify({
    event: 'request_failed',
    input: {},
    output: payload,
    status: 'error',
    timestamp: new Date().toISOString()
  }));

  res.status(statusCode).json(payload);
};
