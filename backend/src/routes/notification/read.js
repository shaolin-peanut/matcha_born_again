'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/read',
    method: ['PUT'],
    schema: {
      summary: 'Mark notifications as read',
      description: 'Mark notifications as read',
      tags: ['Notifications'],
      body: {
        type: 'object',
        required: ['username', 'notificationIds'],
        properties: {
          username: { type: 'string', description: 'Username' },
          notificationIds: { type: 'string', description: 'Comma-separated list of notification IDs' }
        }
      },
      response: {
        200: {
          description: 'Notifications marked as read successfully',
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
    preHandler: verifyJWT,
    handler: async (request, reply) => {
      try {
        const db = await fastify.mysql.getConnection();
        
        const { username, notificationIds } = request.body;
          const splitIds = notificationIds.split(',');
          await db.query(
            'UPDATE notifications SET read_status = true WHERE id IN (?) AND target = ?',
          [splitIds, username]
        );
        reply.code(200).send({
          success: true
        });
      } catch (error) {
        fastify.log.error('Error marking notifications as read:', error);
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while marking notifications as read',
          error: error.message
        });
      }
    }
  });
}