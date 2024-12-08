'use strict';

const fs = require('fs');
const path = require('path');
const { verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/get',
    method: ['POST'], // Changed to POST to accept body parameters
    schema: {
      summary: 'Get Images',
      description: 'Retrieve all images for the user',
      tags: ['Image'],
      body: { // Updated to accept the username in the body
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: 'Username of the user' }
        }
      },
      response: {
        200: {
          description: 'Images retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              imageName: { type: 'string' },
              image: { type: 'string', description: 'Base64 encoded image' }
            }
          }
        },
        400: {
          description: 'Invalid input or no images found',
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
      const { username } = request.body; // Changed to request.body

      if (!username) {
        reply.code(400).send({
          code: 'INVALID_INPUT',
          message: 'Username is missing'
        });
        return;
      }

      const imageDirectory = path.join('/usr/src/app/profile_image', username);

      if (!fs.existsSync(imageDirectory)) {
        reply.code(202).send([]);
        return;
      }

      const userImages = fs.readdirSync(imageDirectory).filter(f => f.startsWith(username));
      if (userImages.length === 0) {
        reply.code(202).send([]);
        return;
      }

      const imageList = userImages.map(image => {
        const imagePath = path.join(imageDirectory, image);
        const imageBuffer = fs.readFileSync(imagePath);
        return {
          imageName: image,
          image: imageBuffer.toString('base64')
        };
      });

      reply.code(200).send(imageList);
    }
  });
};
