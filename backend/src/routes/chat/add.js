'use strict';

const { verifyJWT } = require('../../jwt');
const { notificationTransaction } = require('../notification/transaction')

module.exports = async function (fastify, opts) {
    fastify.route({
        url: '/add',
        method: ['POST'],
        schema: {
            summary: 'Add a chat',
            description: 'Add a chat between two users',
            tags: ['Chat'],
            body: {
                type: 'object',
                required: ['sender', 'receiver', 'message'],
                properties: {
                    sender: { type: 'string', description: 'User sending the message' },
                    receiver: { type: 'string', description: 'User receiving the message' },
                    message: { type: 'string', description: 'Message being sent' }
                }
            },
            response: {
                200: {
                    description: 'Chat added successfully',
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
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
            const { sender, receiver, message } = request.body;
            const connection = await fastify.mysql.getConnection();

            try {
                // Begin transaction8
                await connection.beginTransaction();

                console.log(sender, receiver, message)
                // Get sender and receiver IDs based on the username
                const [senderResult] = await connection.query('SELECT id FROM user WHERE username = ?', [sender]);
                const [receiverResult] = await connection.query('SELECT id FROM user WHERE username = ?', [receiver]);

                if (!senderResult.length || !receiverResult.length) {
                    return reply.code(400).send({
                        code: 'USER_NOT_FOUND',
                        message: 'Sender or receiver not found'
                    });
                }

                const senderId = senderResult[0].id;
                const receiverId = receiverResult[0].id;

                // Insert the chat message into the chat table
				await connection.query('INSERT INTO chat (sender, receiver, message, date) VALUES (?, ?, ?, ?)', [senderId, receiverId, message, new Date()]);

                notificationTransaction({
                    author: sender,
                    target: receiver,
                    message: 'MSG',
                }, fastify)
                // Commit the transaction
                await connection.commit();

                // Send success response
                reply.code(200).send({
                    success: true,
                    message: 'Chat added successfully'
                });
            } catch (error) {
                // Rollback the transaction in case of an error
                await connection.rollback();
                reply.code(500).send({
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while adding the chat',
                    error: error.message
                });
            } finally {
                // Release the connection back to the pool
                connection.release();
            }
        }
    });
};
