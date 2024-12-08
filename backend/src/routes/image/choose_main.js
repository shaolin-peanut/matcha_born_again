'use strict';

const fs = require('fs');
const path = require('path');
const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/change-main-picture',
    method: ['PUT'],
    schema: {
      summary: 'Change Main Picture',
      description: 'Change the main profile picture for a user',
      tags: ['Image'],
      consumes: ['application/json'],
      body: {
        type: 'object',
        required: ['username', 'image'],
        properties: {
          username: { type: 'string', description: 'Username of the user' },
          image: { type: 'string', description: 'The image name to set as main picture' }
        }
      },
      response: {
        200: {
          description: 'Main picture updated successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid input or image not found',
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: verifyJWT,
    handler: async (request, reply) => {
      const { username, image } = request.body;
      const connection = await fastify.mysql.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        const imageDirectory = path.join('/usr/src/app/profile_image', username);
        const imagePath = path.join(imageDirectory, image);

        // Check if the image exists in the user's directory
        if (!fs.existsSync(imagePath)) {
          reply.code(400).send({
            code: 'IMAGE_NOT_FOUND',
            message: 'The specified image does not exist'
          });
          return;
        }

        // Update the main picture path in the database
        const updateQuery = `
          UPDATE user
          SET picture_path = ?
          WHERE username = ?;
        `;
        await connection.query(updateQuery, [image, username]);

        // Commit transaction
        await connection.commit();

        reply.code(200).send({
          success: true,
          message: `Main picture updated to ${image}`
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while updating the main picture',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
