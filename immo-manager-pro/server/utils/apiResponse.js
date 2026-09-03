// Format standard unique pour toutes les routes API
const success = (res, data, message = 'OK', code = 200) => {
  return res.status(code).json({
    success: true,
    data,
    message,
    error: null,
    timestamp: new Date().toISOString()
  })
}

const error = (res, message = 'Erreur', code = 500, err = null) => {
  return res.status(code).json({
    success: false,
    data: null,
    message,
    error: process.env.NODE_ENV === 'development' ? err?.message : message,
    timestamp: new Date().toISOString()
  })
}

module.exports = { success, error }
