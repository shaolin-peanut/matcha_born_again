'use strict'

const fp = require('fastify-plugin')
require ('dotenv').config()

module.exports = fp(async function (fastify, opts) {
  fastify.register(require('@fastify/mysql'), {
    promise: true, //needed to use async-await
    connectionString: `mysql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
  })
})

