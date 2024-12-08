const argon2 = require('argon2');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/reset-password/:verificationId',
    method: ['POST'],
    schema: {
      summary: 'Reset password',
      description: 'Resets the user password with the provided token and new password',
      tags: ['User'],
      params: {
        type: 'object',
        properties: {
          verificationId: { type: 'string' }
        },
        required: ['verificationId']
      },
      body: {
        type: 'object',
        required: ['new_password'],
        properties: {
          new_password: { type: 'string' }
        }
      },
      response: {
        200: {
          description: 'Password reset successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Bad request or invalid token',
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
      const { verificationId } = request.params;
      const { new_password } = request.body;
      let connection;

      try {
        connection = await fastify.mysql.getConnection();

        const [resetRecords] = await connection.query(
          'SELECT user_id FROM user_verification WHERE token = ? AND expires_at > NOW()', 
          [verificationId]
        );

        if (resetRecords.length === 0) {
          return reply.code(400).send({
            success: false,
            message: 'Invalid or expired token'
          });
        }

        const userId = resetRecords[0].user_id;
        const hashedPassword = await argon2.hash(new_password + process.env.DATABASE_SALT);

        await connection.query('UPDATE user SET password = ?, verified = true WHERE id = ?', [hashedPassword, userId]);
        await connection.query('DELETE FROM user_verification WHERE user_id = ?', [userId]);

        return reply.code(200).send({
          success: true,
          message: 'Password reset successfully'
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'An error occurred while resetting the password'
        });
      } finally {
        if (connection) connection.release();
      }
    }
  });
};
