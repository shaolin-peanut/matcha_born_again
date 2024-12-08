const { v4: uuidv4 } = require('uuid');
const postmark = require('postmark');
var client = new postmark.ServerClient(process.env.MAIL_API_KEY);

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/request-password-reset',
    method: ['POST'],
    schema: {
      summary: 'Request a password reset',
      description: 'Initiates the password reset process for the user',
      tags: ['User'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          description: 'Password reset email sent',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
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
      const { email } = request.body;
      let connection;

      try {
        connection = await fastify.mysql.getConnection();

        const [user] = await connection.query('SELECT id FROM user WHERE email = ?', [email]);
        if (user.length === 0) {
          return reply.code(400).send({
            success: false,
            message: 'User with provided email does not exist'
          });
        }

        const userId = user[0].id;
        const resetToken = uuidv4();
        const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await connection.query('UPDATE user SET verified = false WHERE id = ?', [userId]);

        await connection.query(
          'INSERT INTO user_verification (user_id, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?',
          [userId, resetToken, expiration, resetToken, expiration]
        );

        const url = `http://localhost:3000/reset-password/${resetToken}`;
        client.sendEmail({
          "From": "sbars@student.42lausanne.ch",
          "To": email,
          "Subject": "Password Reset Request",
          "HtmlBody": `<strong>Hello</strong>, you requested a password reset. <a href="${url}">Reset your password</a>.`,
          "TextBody": "Reset your password by clicking the link above",
          "MessageStream": "outbound"
        });

        return reply.code(200).send({
          success: true,
          message: 'Password reset email sent'
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'An error occurred while processing the password reset request'
        });
      } finally {
        if (connection) connection.release();
      }
    }
  });
};
