'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/block',
    method: ['POST'],
    schema: {
      summary: 'Block a user',
      description: 'Block a specific user',
      tags: ['Block'],
      body: {
        type: 'object',
        required: ['username', 'blocked_username'],
        properties: {
          username: { type: 'string', description: 'User who is blocking another user' },
          blocked_username: { type: 'string', description: 'User being blocked' }
        }
      },
      response: {
        200: {
          description: 'User blocked successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid input or user already blocked',
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
      const { username, blocked_username } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        // Find the user IDs based on usernames
        const [userRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [username]
        );

        const [blockedUserRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [blocked_username]
        );

        if (userRows.length === 0 || blockedUserRows.length === 0) {
          reply.code(400).send({
            code: 'INVALID_USER',
            message: 'One or both users do not exist'
          });
          return;
        }

        const userId = userRows[0].id;
        const blockedUserId = blockedUserRows[0].id;

        // Check if the user has already blocked the other user
        const [existingBlock] = await connection.query(
          `SELECT * FROM blocked WHERE user_id = ? AND blocked_user_id = ?`,
          [userId, blockedUserId]
        );

        if (existingBlock.length > 0) {
          reply.code(400).send({
            code: 'ALREADY_BLOCKED',
            message: 'You have already blocked this user'
          });
          return;
        }

        // Insert the block into the blocked table
        await connection.query(
          `INSERT INTO blocked (user_id, blocked_user_id) VALUES (?, ?)`,
          [userId, blockedUserId]
        );

        // Commit transaction
        await connection.commit();

        reply.code(200).send({
          success: true,
          message: 'User blocked successfully'
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while blocking the user',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
