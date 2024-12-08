'use strict'

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/verify-account/:verificationId',
    method: ['GET'],
    schema: {
      summary: 'Verify user account',
      description: 'Verifies a user account using the provided verification ID',
      tags: ['User'],
      params: {
        type: 'object',
        required: ['verificationId'],
        properties: {
          verificationId: {
            type: 'string',
            description: 'Verification ID sent to the user\'s email'
          }
        }
      },
      response: {
        200: {
          description: 'Account verified successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid or expired verification ID',
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
            message: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { verificationId } = request.params;
      const connection = await fastify.mysql.getConnection();
      try {
        console.log('Checking if the verification ID exists and is not expired yet (24 hours');
        const [rows] = await connection.query(
          'SELECT user_id FROM user_verification WHERE token = ? AND expires_at > NOW()',
          [verificationId]
        );

        if (rows.length === 0) {
          reply.code(400).send({
            success: false,
            code: 'INVALID_VERIFICATION_ID',
            message: 'The verification ID is invalid or has expired'
          });
          return;
        }

        const userId = rows[0].user_id;

        console.log('Updating user account to set verified');
        await connection.query(
          'UPDATE user SET verified = ? WHERE id = ?',
          [true, userId]
        );

        console.log('Deleting verification ID from database');
        await connection.query(
          'DELETE FROM user_verification WHERE token = ?',
          [verificationId]
        );

        reply.code(200).send({
          success: true,
          message: 'Account verified successfully'
        });
      } catch (error) {
        console.log('An error occurred while verifying the account');
        console.log('Error:', error);
        reply.code(500).send({
          success: false,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while verifying the account'
        });
      } finally {
        connection.release();
      }
    }
  })
}