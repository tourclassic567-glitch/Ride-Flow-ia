function success(action, data = {}) {
  return {
    status: 'success',
    action,
    data
  };
}

function error(action, data = {}) {
  return {
    status: 'error',
    action,
    data
  };
}

module.exports = { success, error };
