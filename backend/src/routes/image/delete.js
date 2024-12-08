'use strict';

const fs = require('fs');
const path = require('path');
const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/delete',
    method: ['DELETE'],
    schema: {
      summary: 'Delete Image',
      description: 'Delete an image for the user by image number',
      tags: ['Image'],
      consumes: ['application/json'],
      body: {
        type: 'object',
        required: ['username', 'imageNumber'],
        properties: {
          username: { type: 'string', description: 'Username of the user' },
          imageNumber: { type: 'integer', description: 'The number of the image to delete' }
        }
      },
      response: {
        200: {
          description: 'Image deleted successfully',
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
      const { username, imageNumber } = request.body;
      const connection = await fastify.mysql.getConnection();

      if (!username || !imageNumber || imageNumber < 1) { 
        reply.code(400).send({
          code: 'INVALID_INPUT',
          message: 'Username or image number is invalid'
        });
        return;
      }

      const imageDirectory = path.join('/usr/src/app/profile_image', username);

      if (!fs.existsSync(imageDirectory)) {
        reply.code(400).send({
          code: 'IMAGE_NOT_FOUND',
          message: 'User has no images'
        });
        return;
      }

      const userImages = fs.readdirSync(imageDirectory).filter(f => f.startsWith(username)).sort();
      const imageToDelete = `${username}_${imageNumber}.png`; // Adjust extension as needed

      if (!userImages.includes(imageToDelete)) {
        reply.code(400).send({
          code: 'IMAGE_NOT_FOUND',
          message: 'The specified image does not exist'
        });
        return;
      }

      try {
        await connection.beginTransaction();

        // Get the current profile image from the database
        const [rows] = await connection.query('SELECT picture_path FROM user WHERE username = ?', [username]);
        const currentProfileImage = rows[0]?.picture_path;

        // Delete the specified image
        fs.unlinkSync(path.join(imageDirectory, imageToDelete));

        // Downgrade the index for images above the deleted one
        for (let i = imageNumber; i < userImages.length; i++) {
          const oldImageName = `${username}_${i + 1}.png`;
          const newImageName = `${username}_${i}.png`;
          const oldImagePath = path.join(imageDirectory, oldImageName);
          const newImagePath = path.join(imageDirectory, newImageName);

          // Rename only if the old image exists
          if (fs.existsSync(oldImagePath)) {
            fs.renameSync(oldImagePath, newImagePath);
          }

		  // check if the image is the profile picture
		  if (currentProfileImage === oldImageName) {
			await connection.query('UPDATE user SET picture_path = ? WHERE username = ?', [newImageName, username]);
		  }
        }

        const remainingImages = fs.readdirSync(imageDirectory).filter(f => f.startsWith(username)).sort();

        // Check if the deleted image was the profile picture
        if (currentProfileImage === imageToDelete) {
          if (remainingImages.length > 0) {
            // Set the first remaining image as the new profile picture
            const newProfileImage = remainingImages[0];
            await connection.query('UPDATE user SET picture_path = ? WHERE username = ?', [newProfileImage, username]);
          } else {
            // No images left, clear the picture_path
            await connection.query('UPDATE user SET picture_path = NULL WHERE username = ?', [username]);
          }
        }

        // Commit the transaction
        await connection.commit();

        reply.code(200).send({
          success: true,
          message: `Image number ${imageNumber} deleted successfully`
        });
      } catch (error) {
        // Rollback the transaction in case of an error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while deleting the image',
          error: error.message
        });
      } finally {
        connection.release();
      }
    }
  });
};
