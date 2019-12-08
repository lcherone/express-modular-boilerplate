const debug = require('debug')('app:module:minio')

// s3
const client = new (require('minio')).Client({
  endPoint: process.env.S3_HOST,
  port: parseInt(process.env.S3_PORT, 10),
  useSSL: process.env.S3_USE_SSL === 'true',
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_ACCESS_SECRET,
  region: process.env.S3_REGION
})

/**
 *
 */
module.exports = () => {
  return {client}
}
