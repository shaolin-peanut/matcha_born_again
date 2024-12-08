'use strict';

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/logout',
    method: ['GET'],
    schema: {
      summary: 'Logout a user',
      description: 'Logs out a user by clearing the jwt cookie',
      tags: ['User'],
      response: {
        200: {
          description: 'User logged out successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      reply.clearCookie('jwt', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 0
      });

      return reply.code(200).send({
        success: true
      });
    }
  });
}