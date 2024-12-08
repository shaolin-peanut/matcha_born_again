'use strict';

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/get-user-matches',
    method: ['POST'],
    schema: {
      summary: 'Get all matches for a user',
      description: 'Fetch all matches for a user from the matches table',
      tags: ['Match'],
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: 'Username of the user requesting their matches' }
        }
      },
      response: {
        200: {
          description: 'List of matches for the user',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            matches: { 
              type: 'array',
              items: {
                type: 'string',  // Return only the usernames
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
    handler: async (request, reply) => {
      const { username } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        // Fetch the user ID
        const [userRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [username]
        );

        if (userRows.length === 0) {
          reply.code(400).send({
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          });
          return;
        }

        const userId = userRows[0].id;

        // Fetch all matches for the user
        const [matchRows] = await connection.query(
          `SELECT userone, usertwo FROM matches WHERE userone = ? OR usertwo = ?`,
          [userId, userId]
        );

        // Check if there are any matches
        if (matchRows.length === 0) {
          reply.code(201).send({
            code: 'NO_MATCHES',
            message: 'No matches found',
            matches: 'none'
          });
          return;
        }

        // Collect all matched user IDs
        const matchedUserIds = matchRows.map(row => row.userone === userId ? row.usertwo : row.userone);

        // Fetch the usernames of matched users
        const [matchedUsernames] = await connection.query(
          `SELECT username 
           FROM user 
           WHERE id IN (?)`,
          [matchedUserIds]
        );

        // Extract only the usernames
        const usernames = matchedUsernames.map(row => row.username);

        // Commit transaction
        await connection.commit();

        // Return the list of matched usernames
        reply.code(200).send({
          success: true,
          matches: usernames
        });

      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while fetching matches',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
