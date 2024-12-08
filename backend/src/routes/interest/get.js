'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/unique-interests',
    method: ['GET'],
    schema: {
      summary: 'Get all unique interests',
      description: 'Return a list of all unique interests across all users',
      tags: ['Interest'],
      response: {
        200: {
          description: 'List of unique interests retrieved',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            unique_interests: {
              type: 'array',
              items: { type: 'string' }
            }
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
      const connection = await fastify.mysql.getConnection();

      try {
        // Retrieve all unique interests
        const [uniqueInterestsRows] = await connection.query(
          `SELECT DISTINCT interest FROM user_interests`
        );

        const uniqueInterests = uniqueInterestsRows.map(row => row.interest);

        reply.code(200).send({
          success: true,
          unique_interests: uniqueInterests
        });
      } catch (error) {
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while retrieving the unique interests',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
