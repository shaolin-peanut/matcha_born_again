'use strict';

const fs = require('fs');
const path = require('path');
const fileType = require('file-type'); // Ensure this package is installed

const writeFileAsync = require('util').promisify(fs.writeFile);

const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/add',
    method: ['POST'],
    schema: {
      summary: 'Add Image',
      description: 'Upload and add a new image for the user',
      tags: ['Image'],
      consumes: ['application/json'],
      body: {
        type: 'object',
        required: ['file', 'username'],
        properties: {
          username: { type: 'string', description: 'Username of the user' },
          file: { type: 'string', format: 'binary', description: 'The image file to upload (base64 encoded)' }
        }
      },
      response: {
        201: {
          description: 'Image added successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid input or maximum images reached',
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
      const { username, file } = request.body;
	  const connection = await fastify.mysql.getConnection();

      if (!username || !file) {
        reply.code(400).send({
          code: 'INVALID_INPUT',
          message: 'Username or file is missing'
        });
        return;
      }

      const imageDirectory = path.join('/usr/src/app/profile_image', username);

      if (!fs.existsSync(imageDirectory)) {
        fs.mkdirSync(imageDirectory, { recursive: true });
      }

      const userImages = fs.readdirSync(imageDirectory).filter(f => f.startsWith(username));

      // Check if the user already has 5 images
      if (userImages.length >= 5) {
        reply.code(400).send({
          code: 'MAX_IMAGES_REACHED',
          message: 'User already has the maximum of 5 images'
        });
        return;
      }

      // Convert base64 to buffer
      const fileBuffer = Buffer.from(file, 'base64');

      // Detect file type from buffer
      const fileTypeInfo = await fileType.fromBuffer(fileBuffer);

      if (!fileTypeInfo || !['image/png'].includes(fileTypeInfo.mime)) {
        reply.code(400).send({
          code: 'INVALID_FILE_TYPE',
          message: 'Only image files of types PNG are accepted'
        });
        return;
      }

      const imageNumber = userImages.length + 1;
      const imageName = `${username}_${imageNumber}.${fileTypeInfo.ext}`;
      const imagePath = path.join(imageDirectory, imageName);

	try {
        await writeFileAsync(imagePath, fileBuffer);
        await connection.beginTransaction();

        // If this is the first image, set it as the profile image in the user table
        if (imageNumber === 1) {
          const updateQuery = 'UPDATE user SET picture_path = ? WHERE username = ?';
          await connection.query(updateQuery, [imageName, username]);
        }

        // Commit the transaction
        await connection.commit();

        reply.code(201).send({
          success: true,
          message: `Image added successfully as ${imageName}`
        });
      } catch (error) {
        // Rollback the transaction in case of an error
        await connection.rollback();

        reply.code(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while saving the image',
          error: error.message
        });
      }
    }
  });
};
