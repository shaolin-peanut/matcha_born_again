'use strict'

const path = require('node:path')
const AutoLoad = require('@fastify/autoload')

const options = {}
const userConnections = new Map()

module.exports = async function (fastify, opts) {
  fastify.register(require('@fastify/swagger'), {})
  fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    })
  fastify.register(require('@fastify/formbody'));
  fastify.register(require('@fastify/websocket'));
  fastify.register(require('@fastify/cookie'), {
    secret: "super secret key",
    hook: 'onRequest',
    parseOptions: {}
  })
  fastify.register(require('@fastify/cors'), {
    origin: 'http://localhost:4000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
    credentials: true,
    optionsSuccessStatus: 200,
  });
  
  
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })
  
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })

  fastify.decorate('userConnections', userConnections);
}

module.exports.options = options