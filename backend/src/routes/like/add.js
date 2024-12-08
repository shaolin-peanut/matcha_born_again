'use strict';

const { verifyJWT } = require('../../jwt');
const { notificationTransaction } = require('../notification/transaction')

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/like',
    method: ['POST'],
    schema: {
      summary: 'Like a user',
      description: 'Like a specific user and update the famerating',
      tags: ['Like'],
      body: {
        type: 'object',
        required: ['username', 'liked_username'],
        properties: {
          username: { type: 'string', description: 'User liking another user' },
          liked_username: { type: 'string', description: 'User being liked' }
        }
      },
      response: {
        200: {
          description: 'User liked successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid input or already liked',
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

        // Check if the user has already liked the other user
        const [existingLike] = await connection.query(
          `SELECT * FROM liked WHERE user_id = ? AND liked_user_id = ?`,
          [userId, likedUserId]
        );

        if (existingLike.length > 0) {
          reply.code(400).send({
            code: 'ALREADY_LIKED',
            message: 'You have already liked this user'
          });
          return;
        }

        // Insert the like into the liked table
        await connection.query(
          `INSERT INTO liked (user_id, liked_user_id) VALUES (?, ?)`,
          [userId, likedUserId]
        );

        // Increment the famerating of the liked user
        await connection.query(
          `UPDATE user SET famerating = famerating + 1 WHERE id = ?`,
          [likedUserId]
        );

		// if both user kiled each other, add a match
		const [match] = await connection.query(
		  `SELECT * FROM liked WHERE user_id = ? AND liked_user_id = ?`,
		  [likedUserId, userId]
		);

		if (match.length > 0) {
		  const [existingMatch] = await connection.query(
			'SELECT * FROM matches WHERE (userone = ? AND usertwo = ?) OR (userone = ? AND usertwo = ?)',
			[userId, likedUserId, likedUserId, userId]
		  );

		  if (existingMatch.length === 0) {
			console.log('Coucou2')
			await connection.query(
			  'INSERT INTO matches (userone, usertwo) VALUES (?, ?)',
			  [userId, likedUserId]
			);

      notificationTransaction({
          author: username,
          target: liked_username,
          message: 'MATCH'
        }, fastify)
      notificationTransaction({
            author: liked_username,
            target: username,
            message: 'MATCH'
          }, fastify)
		  }
		} else {
    // Commit transaction
      await connection.commit();

      notificationTransaction({
          author: username,
          target: liked_username,
          message: 'LIKE'},
          fastify)

      reply.code(200).send({
        success: true,
        message: 'User liked successfully'
      });
    }

      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while liking the user',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
