'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/viewed-by',
    method: ['POST'],
    schema: {
      summary: 'Get all usernames who viewed a specific user\'s profile',
      description: 'Return all the usernames who viewed a specific user\'s profile',
      tags: ['View'],
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: 'User whose profile was viewed by others' }
        }
      },
      response: {
        200: {
          description: 'List of usernames who viewed the user\'s profile retrieved',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            viewed_by_usernames: {
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
            message: 'User not found'
          });
          return;
        }

        const userId = userRows[0].id;

        // Retrieve all usernames who viewed the given user's profile
        const [viewedByUserRows] = await connection.query(
          `SELECT u.username FROM viewed v
           JOIN user u ON v.user_id = u.id
           WHERE v.viewed_user_id = ?`,
          [userId]
        );

        const viewedByUsernames = viewedByUserRows.map(row => row.username);

        reply.code(200).send({
          success: true,
          viewed_by_usernames: viewedByUsernames
        });
      } catch (error) {
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while retrieving the usernames who viewed the user\'s profile',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
