'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/blocked-by',
    method: ['POST'],
    schema: {
      summary: 'Get all usernames who blocked a specific user',
      description: 'Return all the usernames who blocked a specific user',
      tags: ['Block'],
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: 'User who was blocked by others' }
        }
      },
      response: {
        200: {
          description: 'List of usernames who blocked the user retrieved',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            blocked_by_usernames: {
              type: 'array',
              items: { type: 'string' }
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
      const { username } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Find the user ID based on the username
        const [userRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [username]
        );

        if (userRows.length === 0) {
          reply.code(400).send({
            code: 'INVALID_USER',
            success: false,
            message: "User does not exist"
          });
          return;
        }

        const userId = userRows[0].id;

        // Retrieve all usernames who blocked the given user
        const [blockedByUserRows] = await connection.query(
          `SELECT u.username FROM blocked b
           JOIN user u ON b.user_id = u.id
           WHERE b.blocked_user_id = ?`,
          [userId]
        );

        const blockedByUsernames = blockedByUserRows.map(row => row.username);

        reply.code(200).send({
          success: true,
          blocked_by_usernames: blockedByUsernames
        });
      } catch (error) {
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while retrieving the usernames who blocked the user',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
