'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/unblock',
    method: ['POST'],
    schema: {
      summary: 'Unblock a user',
      description: 'Unblock a specific user',
      tags: ['Block'],
      body: {
        type: 'object',
        required: ['username', 'blocked_username'],
        properties: {
          username: { type: 'string', description: 'User who is unblocking another user' },
          blocked_username: { type: 'string', description: 'User being unblocked' }
        }
      },
      response: {
        200: {
          description: 'User unblocked successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid input or user not blocked',
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

        if (existingBlock.length === 0) {
          reply.code(400).send({
            code: 'NOT_BLOCKED',
            message: 'You have not blocked this user'
          });
          return;
        }

        // Delete the block from the blocked table
        await connection.query(
          `DELETE FROM blocked WHERE user_id = ? AND blocked_user_id = ?`,
          [userId, blockedUserId]
        );

        // Commit transaction
        await connection.commit();

        reply.code(200).send({
          success: true,
          message: 'User unblocked successfully'
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while unblocking the user',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
