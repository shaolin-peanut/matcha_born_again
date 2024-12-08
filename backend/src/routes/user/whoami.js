const crypto = require('crypto');
const { verifyToken } = require('../../jwt');

module.exports = async function (fastify, opts) {
    fastify.route({
        url: '/whoami',
        method: ['GET'],
        schema: {
            summary: 'Get username from JWT',
            description: 'Returns the username from the provided JWT token',
            tags: ['User'],
            response: {
                200: {
                    description: 'Username fetched successfully',
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        username: { type: 'string' },
                        id: { type: 'string' }
                    }
                },
                201: {
                    description: 'Unauthorized',
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
            try {
                const token = request.cookies.jwt;
                if (!token) {
                    reply.code(201).send({
                        success: false,
                        message: 'Missing or invalid token'
                    });
                    return;
                }

                const decoded = await verifyToken(token);
                const username = decoded.sub; // `sub` is the username in the JWT
                const id = decoded.id;
                console.log(username, id)

                reply.code(200).send({
                    success: true,
                    username,
                    id,
                });
            } catch (err) {
                console.error('Error decoding JWT', err);
                reply.code(201).send({
                    success: false,
                    message: 'Invalid token or expired token'
                });
            }
        }
    });
};
