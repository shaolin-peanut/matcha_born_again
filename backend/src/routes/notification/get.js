'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/history',
    method: ['POST'],
    schema: {
      summary: 'Get all notifications for a specific user',
      description: 'Return all notifications sent to a specific user',
      tags: ['Notifications'],
      body: {
        type: 'object',
        required: ['target'],
        properties: {
          target: { type: 'string', description: 'Username of the user receiving notifications' }
        }
      },
      response: {
        200: {
          description: 'List of notifications retrieved for the user',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  author: { type: 'string' },
                  message: { type: 'string' },
                  read_status: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid input',
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
      const { target } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Find the target user ID based on the target username
        const [targetRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [target]
        );

        if (targetRows.length === 0) {
          reply.code(400).send({
            code: 'INVALID_USER',
            message: 'The specified target user does not exist'
          });
          return;
        }

        const targetId = targetRows[0].id;

        // Retrieve all notifications for the target user
        const [notificationRows] = await connection.query(
          `SELECT id, author, message, read_status, created_at
           FROM notifications WHERE target = ? AND read_status = 0
           ORDER BY created_at DESC`,
          [target]
        );

        const notifications = notificationRows.length > 0 ? notificationRows.map(row => ({
          id: row.id,
          author: row.author,
          message: row.message,
          read_status: row.read_status,
          created_at: row.created_at
        }))
        : [];

        reply.code(200).send({
          success: true,
          notifications: notifications
        });
      } catch (error) {
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while retrieving the notifications',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
