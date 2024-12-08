'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/profile',
    method: ['POST'],
    schema: {
      summary: 'Fill user profile',
      description: 'Create/Update the profile of the user with the provided username, gender, sexuality, biography, interests, and coordinates',
      tags: ['User'],
      body: {
        type: 'object',
        required: ['username', 'email', 'gender', 'sexuality', 'biography', 'interests', 'coordinates'],
        properties: {
          username: { type: 'string', description: 'Username of the user' },
          email: { type: 'string', description: 'User email' },
          gender: { type: 'string', description: 'User gender' },
          sexuality: { type: 'string', description: 'User sexuality' },
          biography: { type: 'string', description: 'User biography' },
          interests: { type: 'string', description: 'Comma-separated list of user interests' },
          coordinates: { type: 'string', description: 'User location' },
        },
      },
      response: {
        201: {
          description: 'Profile filled successfully',
          type: 'object',
          properties: {
            id: { type: 'number' },
            username: { type: 'string' },
            email: { type: 'string' },
            gender: { type: 'string' },
            sexuality: { type: 'string' },
            biography: { type: 'string' },
            interests: { type: 'array', items: { type: 'string' } },
            coordinates: { type: 'string' },
          },
        },
        400: {
          description: 'Invalid input',
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: verifyJWT,
    handler: async (request, reply) => {
      const { username, email, gender, sexuality, biography, interests, coordinates } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        // Find the user by username
        const [userRows] = await connection.query(
          'SELECT id FROM user WHERE username = ?',
          [username]
        );

        if (userRows.length === 0) {
          await connection.rollback();
          reply.code(400).send({
            code: 'USER_NOT_FOUND',
            message: 'Username does not exist',
          });
          return;
        }

        const userId = userRows[0].id;

        // Update the user profile fields
        await connection.query(
          'UPDATE user SET email = ?, gender = ?, sexuality = ?, biography = ?, coordinates = ? WHERE username = ?',
          [email, gender, sexuality, biography, coordinates, username]
        );

        // Delete existing interests for the user
        await connection.query('DELETE FROM user_interests WHERE user_id = ?', [userId]);

        // Parse the interests string into an array
        const interestsArray = interests
          .split(',')
          .map((interest) => interest.trim())
          .filter(Boolean);

        // Insert new interests into user_interests table
        if (interestsArray.length > 0) {
          const interestsValues = interestsArray.map((interest) => [userId, interest]);
          await connection.query('INSERT INTO user_interests (user_id, interest) VALUES ?', [
            interestsValues,
          ]);
        }

        // Commit transaction
        await connection.commit();
        fastify.log.info('Profile updated successfully');

        reply.code(201).send({
          id: userId,
          username,
          email,
          gender,
          sexuality,
          biography,
          interests: interestsArray,
          coordinates,
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();
        console.error(error);
        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while filling the profile',
        });
      } finally {
        connection.release();
      }
    },
  });
};
