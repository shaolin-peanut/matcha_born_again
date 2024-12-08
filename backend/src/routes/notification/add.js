'use strict'

const { notificationTransaction } = require("../../routes/notification/transaction");

module.exports = async function (fastify, opts) {
    fastify.route({
        url: '/create',
        method: ['POST'],
        schema: {
            summary: 'add notifications',
            description: 'add notifications',
            tags: ['Notifications'],
            body: {
              type: 'object',
              required: ['author', 'target', 'type', 'message'],
              properties: {
                author: { type: 'string', description: 'Author'},
                target: { type: 'string', description: 'Target'},
                type: { type: 'string', description: 'Type'},
                message: { type: 'string', description: 'Message'}
              }
            },
            response: {
              200: {
                description: 'Notifications added',
                type: 'object',
                properties: {
                  success: { type: 'boolean' }
                }
              },
              400: {
                description: 'Invalid input or notifications not found',
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              },
              500: {
                description: 'Internal Server Error',
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            }
    },
    handler: async (request, reply) => {
      const { author, target, type, message } = request.body;

      if (!author || !target || !message) {
        return reply.status(400).send({
          type: 'ERROR',
          message: 'Missing required fields: author, target, message'
        });
      }

      try {
        notificationTransaction({ author, target, message }, fastify)

        reply.send({
          type: 'SUCCESS',
          message: 'Notification created successfully'
        });
      } catch (error) {
        fastify.log.error('Error creating notification:', error.message);
        reply.status(500).send({
          type: 'ERROR',
          message: 'Internal server error'
        })
      }
    }})
}
