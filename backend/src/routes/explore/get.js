'use strict';

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/get-suggestions',
    method: ['POST'],
    schema: {
      summary: 'Get possible matches for a user',
      description: 'Get 50 possible matches based on the user\'s sexuality, gender, active status, and sorted by number of likes',
      tags: ['Explore'],
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: 'Username of the user requesting matches' }
        }
      },
      response: {
        200: {
          description: 'List of possible matches',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            matches: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
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
          }
        },
        400: {
          description: 'Invalid input or no matches found',
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
      const token = request.cookies.jwt;
      const { username } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        // Fetch the user's details including gender and sexuality
        const [userRows] = await connection.query(
          `SELECT id, gender, sexuality FROM user WHERE username = ?`,
          [username]
        );

        if (userRows.length === 0) {
          reply.code(400).send({
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          });
          return;
        }

        const { id: userId, gender, sexuality } = userRows[0];

        // Construct the gender filter based on the user's sexuality
        let genderFilter = '';
        if (sexuality === 'Straight') {
          // Straight: Male looks for Female, Female looks for Male
          genderFilter = gender === 'Male' ? "u.gender = 'Female'" : "u.gender = 'Male'";
        } else if (sexuality === 'Gay') {
          // Gay: Match with the same gender
          genderFilter = `u.gender = '${gender}'`;
        } else if (sexuality === 'Bisexual') {
          // Bisexual: Match with either Male or Female
          genderFilter = "(u.gender = 'Male' OR u.gender = 'Female')";
        } else {
          reply.code(400).send({
            code: 'INVALID_SEXUALITY',
            message: 'Invalid sexuality type'
          });
          return;
        }

        // Fetch 50 possible matches based on gender, active status, number of likes, and excluding blocked users
        const [matches] = await connection.query(
          `SELECT u.username
           FROM user u
           LEFT JOIN blocked b ON (b.user_id = u.id AND b.blocked_user_id = ?)
           WHERE u.active = 1 
           AND u.id != ?
           AND b.user_id IS NULL -- Exclude blocked users
           ORDER BY (SELECT COUNT(*) FROM liked l WHERE l.liked_user_id = u.id) DESC`,
          [userId, userId]
        );

        // Commit transaction
        await connection.commit();

        // If no matches were found, return an error
        if (matches.length === 0) {
          reply.code(400).send({
            code: 'NO_MATCHES_FOUND',
            message: 'No matches found'
          });
          return;
        }

        // Fetch detailed information for each matched user from /getinfo
        const detailedMatches = [];
        for (const match of matches) {
          const getInfoResponse = await fastify.inject({
            method: 'POST',
            url: '/user/getinfo',
            payload: { username: match.username },
			headers: {
				cookie: `jwt=${token}` // Pass the JWT cookie here
			  }
          });

          const userInfo = JSON.parse(getInfoResponse.payload);
          console.log(userInfo)
          if (userInfo.exists) {
            detailedMatches.push(userInfo.user);
          }
        }

        // Return the detailed matches to the frontend
        reply.code(200).send({
          success: true,
          matches: detailedMatches
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while fetching matches',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
