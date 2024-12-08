'use strict';

const argon2 = require('argon2');
const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/getinfo',
    method: ['POST'],
    schema: {
      summary: 'Get user info',
      description: 'Return specific user info including interests',
      tags: ['User'],
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: 'User username' }
        }
      },
      response: {
        200: {
          description: 'User info retrieved',
          type: 'object',
          properties: {
            exists: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string'},
                email: { type: 'string' },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                gender: { type: 'string' },
                sexuality: { type: 'string' },
                biography: { type: 'string' },
                interests: { 
                  type: 'array',
                  items: { type: 'string' }
                },
                coordinates: { type: 'string' },
                famerating: { type: 'integer' },
                picturecount: { type: 'integer' },
				        picture_path: { type: 'string' },
                profile_completed: { type: 'boolean' },
                active: { type: 'boolean' },
                verified: { type: 'boolean' }
              }
            }
          }
        },
        400: {
          description: 'Invalid input',
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
      const { username } = request.body;
      const connection = await fastify.mysql.getConnection();
    
      try {
        // Query the specific user information based on the username
        const [userRows] = await connection.query(
          `SELECT id, email, first_name, last_name, gender, sexuality, biography, 
                  coordinates, famerating, picturecount, picture_path,
                  profile_completed, active, verified 
           FROM user WHERE username = ?`,
          [username]
        );
        
        if (userRows.length === 0) {
          reply.code(200).send({
            exists: false,
            user: null
          });
          return;
        }
        
        const user = userRows[0];
        
        // Query the user's interests from the user_interests table
        const [interestRows] = await connection.query(
          `SELECT interest FROM user_interests WHERE user_id = ?`,
          [user.id]
        );
        
        const interests = interestRows.map(row => row.interest);

        // Send the specific user information
        reply.code(200).send({
          exists: true,
          user: {
            id: user.id,
            username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            gender: user.gender,
            sexuality: user.sexuality,
            biography: user.biography,
            interests: interests,
            coordinates: user.coordinates,
            famerating: user.famerating,
            picturecount: user.picturecount,
			      picture_path: user.picture_path,
            profile_completed: user.profile_completed,
            active: user.active,
            verified: user.verified
          }
        });
        
      } catch (error) {
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while retrieving the user information',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
}
