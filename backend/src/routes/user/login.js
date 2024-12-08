'use strict';

const argon2 = require('argon2');
const { generateJwt } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/login',
    method: ['POST'],
    schema: {
      summary: 'Login user',
      description: 'Login the user with the provided username and password',
      tags: ['User'],
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
			username: { type: 'string', description: 'User username' },
			password: { type: 'string', description: 'User password' }
        }
      },
      response: {
        200: {
		  description: 'User logged in successfully',
		  type: 'object',
		  properties: {
			id: { type: 'number' },
			username: { type: 'string' },
			token: { type: 'string' },
			success: { type: 'boolean' }
		  }
		},
        400: {
          description: 'Invalid input',
		  type: 'object',
		  properties: {
			code: { type: 'string' },
			message: { type: 'string' }
          }
        }
      }
    },
	handler: async (request, reply) => {
		const { username, password } = request.body;
		const connection = await fastify.mysql.getConnection();

		try {
			const [user] = await connection.query(
				'SELECT id, username, password FROM user WHERE username = ?',
			[username]
			);
			if (user.length === 0) {
				console.log('user not found');
				reply.code(400).send({
					code: 'USER_NOT_FOUND',
					message: 'Username does not exist'
				});
				return;
			}
			//verify password wtith salt in env
			const salt = process.env.DATABASE_SALT
			const saltedPassword = password + salt
			if (!(await argon2.verify(user[0].password, saltedPassword))) {
				console.log('invalid password');
				reply.code(400).send({
				code: 'INVALID_PASSWORD',
				message: 'Invalid password'
			});
			return;
			}

			reply.setCookie('jwt', generateJwt(user[0].username, user[0].id), {
				httpOnly: true,
				secure: true,
				sameSite: 'None',
				path: '/',
				maxAge: 3600 // one hour
			});

			reply.code(200).send({
				id: user[0].id,
				code: 'USER_SUCCESS',
				username: user[0].username,
				// "Set-Cookie": `token=${token}; HttpOnly; Path=/`,
				success: true
			});
			connection.release();
		} catch (error) {
			console.log('error')
			console.log(error)
			reply.code(500).send({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'An error occurred while verifying the user',
				error: error
			});
			
			} finally {
			connection.release();
		}
		}
  });
}

