'use strict';

const { verifyJWT } = require('../../jwt');
const { notificationTransaction } = require('../notification/transaction')

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/view',
    method: ['POST'],
    schema: {
      summary: 'Record profile view',
      description: 'Record that a user viewed another user\'s profile',
      tags: ['View'],
      body: {
        type: 'object',
        required: ['username', 'viewed_username'],
        properties: {
          username: { type: 'string', description: 'User viewing another user\'s profile' },
          viewed_username: { type: 'string', description: 'User whose profile is being viewed' }
        }
      },
      response: {
        200: {
          description: 'Profile view recorded successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid input or already viewed',
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
      const { username, viewed_username } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        // Find the user IDs based on usernames
        const [userRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [username]
        );

        const [viewedUserRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [viewed_username]
        );

        if (userRows.length === 0 || viewedUserRows.length === 0) {
          reply.code(400).send({
            code: 'INVALID_USER',
            message: 'One or both users do not exist'
          });
          return;
        }

        const userId = userRows[0].id;
        const viewedUserId = viewedUserRows[0].id;

        // Check if the user has already viewed the other user's profile
        const [existingView] = await connection.query(
          `SELECT * FROM viewed WHERE user_id = ? AND viewed_user_id = ?`,
          [userId, viewedUserId]
        );

        if (existingView.length > 0) {
          // If the view already exists, update the timestamp
          await connection.query(
            `UPDATE viewed SET created_at = CURRENT_TIMESTAMP WHERE user_id = ? AND viewed_user_id = ?`,
            [userId, viewedUserId]
          );
          notificationTransaction(
            {
              author: username,
              target: liked_username,
              message: 'VIEW'},
              fastify)
          reply.code(200).send({
            success: true,
            message: 'Profile view updated successfully'
          });
          return;
        }

        // Insert the new view into the viewed table
        await connection.query(
          `INSERT INTO viewed (user_id, viewed_user_id) VALUES (?, ?)`,
          [userId, viewedUserId]
        );

        // Commit transaction
        await connection.commit();

        reply.code(200).send({
          success: true,
          message: 'Profile view recorded successfully'
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while recording the profile view',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
