'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/liked-by',
    method: ['POST'],
    schema: {
      summary: 'Get all usernames who liked a specific user',
      description: 'Return all the usernames who liked a specific user',
      tags: ['Like'],
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: 'User who was liked by others' }
        }
      },
      response: {
        200: {
          description: 'List of usernames who liked the user retrieved',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            liked_by_usernames: {
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
          reply.code(200).send({
            code: 'INVALID_USER',
            success: 'false',
            message: 'Nobody liked this user'
          });
          return;
        }

        const userId = userRows[0].id;

        // Retrieve all usernames who liked the given user
        const [likedByUserRows] = await connection.query(
          `SELECT u.username FROM liked l
           JOIN user u ON l.user_id = u.id
           WHERE l.liked_user_id = ?`,
          [userId]
        );

        const likedByUsernames = likedByUserRows.map(row => row.username);

        reply.code(200).send({
          success: true,
          liked_by_usernames: likedByUsernames
        });
      } catch (error) {
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while retrieving the usernames who liked the user',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
