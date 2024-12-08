'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/unlike',
    method: ['POST'],
    schema: {
      summary: 'Unlike a user',
      description: 'Unlike a specific user, update the famerating, and remove the match if exists',
      tags: ['Like'],
      body: {
        type: 'object',
        required: ['username', 'liked_username'],
        properties: {
          username: { type: 'string', description: 'User unliking another user' },
          liked_username: { type: 'string', description: 'User being unliked' }
        }
      },
      response: {
        200: {
          description: 'User unliked successfully, and match removed if existed',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
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
      const { username, liked_username } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        // Find the user IDs based on usernames
        const [userRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [username]
        );

        const [likedUserRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [liked_username]
        );

        if (userRows.length === 0 || likedUserRows.length === 0) {
          reply.code(400).send({
            code: 'INVALID_USER',
            message: 'One or both users do not exist'
          });
          return;
        }

        const userId = userRows[0].id;
        const likedUserId = likedUserRows[0].id;

        // Delete the like from the liked table
        await connection.query(
          `DELETE FROM liked WHERE user_id = ? AND liked_user_id = ?`,
          [userId, likedUserId]
        );

        // Decrement the famerating of the unliked user
        await connection.query(
          `UPDATE user SET famerating = famerating - 1 WHERE id = ? AND famerating > 0`,
          [likedUserId]
        );

        // Check if a match exists between the two users
        const [matchRows] = await connection.query(
          `SELECT * FROM matches WHERE (userone = ? AND usertwo = ?) OR (userone = ? AND usertwo = ?)`,
          [userId, likedUserId, likedUserId, userId]
        );

        // If a match exists, delete it
        if (matchRows.length > 0) {
          await connection.query(
            `DELETE FROM matches WHERE (userone = ? AND usertwo = ?) OR (userone = ? AND usertwo = ?)`,
            [userId, likedUserId, likedUserId, userId]
          );
        }

        // Commit transaction
        await connection.commit();

        reply.code(200).send({
          success: true,
          message: 'User unliked successfully, and match removed if existed'
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while unliking the user',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
