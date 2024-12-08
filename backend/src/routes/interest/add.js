'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/add-interest',
    method: ['POST'],
    schema: {
      summary: 'Add a new interest',
      description: 'Add a new interest for the user. A user cannot add an interest that they have already added before.',
      tags: ['Interest'],
      body: {
        type: 'object',
        required: ['username', 'interest'],
        properties: {
          username: { type: 'string', description: 'Username of the user adding the interest' },
          interest: { type: 'string', description: 'The interest to add' }
        }
      },
      response: {
        200: {
          description: 'Interest added successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid input or interest already added by the user',
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
      const { username, interest } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        // Find the user ID based on the username
        const [userRows] = await connection.query(
          `SELECT id FROM user WHERE username = ?`,
          [username]
        );

        if (userRows.length === 0) {
          reply.code(400).send({
            code: 'INVALID_USER',
            message: 'User does not exist'
          });
          return;
        }

        const userId = userRows[0].id;

        // Check if the user already added the interest
        const [existingInterest] = await connection.query(
          `SELECT * FROM user_interests WHERE user_id = ? AND interest = ?`,
          [userId, interest]
        );

        if (existingInterest.length > 0) {
          reply.code(400).send({
            code: 'INTEREST_ALREADY_ADDED',
            message: 'This interest has already been added by the user'
          });
          return;
        }

        // Insert the new interest into the user_interests table
        await connection.query(
          `INSERT INTO user_interests (user_id, interest) VALUES (?, ?)`,
          [userId, interest]
        );

        // Commit transaction
        await connection.commit();

        reply.code(200).send({
          success: true,
          message: 'Interest added successfully'
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while adding the interest',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
