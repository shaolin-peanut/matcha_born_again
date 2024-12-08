const crypto = require('crypto');
const hashFunction = crypto.createHash('sha256');
const { initVerification } = require('../../services/user/verification')

module.exports = async function (fastify, opts) {
    fastify.route({
        url: '/request-verification',
        method: ['POST'],
        schema: {
            summary: 'Request verification',
            description: 'Requests a verification email to be sent to the provided email address',
            tags: ['User'],
            body: {
                type: 'object',
                required: ['username'],
                properties: {
                    email: { type: 'string' }
                }
            },
            response: {
                200: {
                    description: 'Verification email sent successfully',
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
                        success: { type: 'boolean' },
                        code: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                500: {
                    description: 'Internal server error',
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
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
                const [user] = await connection.query(
                    'SELECT * FROM user WHERE username = ?', [username])
                if (user.length === 0) {
                    reply.code(400).send({
                        success: false,
                        code: 'USER_NOT_FOUND',
                        message: 'User not found'
                    });
                    return;
                }
                initVerification({ user_id: user[0].id, fastify });

                reply.code(200).send({
                    success: true,
                    message: 'Verification email sent successfully'
                });
            } catch (error) {
              console.error('Error processing request-verification', error);
              reply.code(500).send({
                success: false,
                message: 'Internal server error'
              });
            } finally {
              connection.release();
            }
        }
    });
}; 