'use strict'

const argon2 = require('argon2');
const { generateJwt } = require('../../jwt');
const { initVerification } = require('../../services/user/verification');


module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/create-user',
    method: ['POST'],
    schema: {
      summary: 'Create a new user',
      description: 'Creates a new user with the provided email, username, password, first_name, and last_name',
      tags: ['User'],
      body: {
        type: 'object',
        required: ['email', 'username', 'password', 'first_name', 'last_name'],
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          password: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' }
        }
      },
      response: {
        201: {
          description: 'User created successfully',
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            username: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
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
      const { email, username, password, first_name, last_name } = request.body;
      let connection;

      try {
        connection = await fastify.mysql.getConnection();

        if (!connection) {
          return reply.code(500).send({
            success: false,
            message: 'An error occurred while connecting to the database'
          });
        }

        const [existingUsers] = await connection.query(
          'SELECT COUNT(*) AS count FROM user WHERE email = ? OR username = ?',
          [email, username]
        );

        if (existingUsers[0].count > 0) {
          return reply.code(400).send({
            success: false,
            message: 'Email or Username already exists'
          });
        }

        const hashedPassword = await argon2.hash(password + process.env.DATABASE_SALT);
      
        const [result] = await connection.query(
          'INSERT INTO user (email, username, password, first_name, last_name, active, verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [email, username, hashedPassword, first_name, last_name, true, false]
        )
        console.log("User inserted in db");

        const [newUsers] = await connection.query(
          'SELECT * FROM user WHERE username = ?', [username])
        
        if (process.env.DEV_MODE == 'false') {
          initVerification({ user_id: newUsers[0].id, fastify });
        }

        reply.setCookie('jwt', generateJwt(username, result.insertId), {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
          maxAge: 3600 // one hour
        });

        return reply.code(201).send({
          success: true,
          id: result.insertId,
          email,
          username,
          first_name,
          last_name
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'An error occurred while creating the user'
        });
      } finally {
        if (connection) connection.release();
      }
    }
  });
}
