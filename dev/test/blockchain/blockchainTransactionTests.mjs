import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';

// Import the default export of networkNode.js as an object
import networkNode from '../../networkNode.js';
// Extract app and blockchain from the imported object
const { app, blockchain } = networkNode;

/**
 * Test cases validating the blockchain create transaction logic 
 * 
 * Blockchain consensus, explorer, mining will be seperated into other test modules
 */

describe('Blockchain Internal Business Logic', function () {

    beforeEach(function () {
        //not doing anything at the moment
    });

    after((done) => {
        // Log active handles before cleanup (optional, for debugging)
        console.log('Closing active handles before exiting');

        // Function to forcibly close all open TCP connections
        function closeAllOpenConnections() {
            const activeHandles = process._getActiveHandles();
            const activeRequests = process._getActiveRequests();

            // Close active handles (e.g., sockets, streams)
            activeHandles.forEach((handle) => {
                if (handle.close) {
                    handle.close();  // Close the handle if possible
                }
                if (handle.destroy) {
                    handle.destroy();  // Destroy the handle if possible
                }
            });

            // End or abort any pending HTTP/TCP requests
            activeRequests.forEach((request) => {
                if (request.abort) {
                    request.abort();  // Abort the request if possible
                }
                if (request.end) {
                    request.end();  // End the request if possible
                }
            });

            console.log('Active handles closed');
        }

        closeAllOpenConnections(); // Force close all active connections
        done();  // Proceed to exit the test process
    });

    describe('Blockchain', () => {
        it('should create a new instance of a blockchain', () => {

            //create new instance of Blockchain
            //const blockchain = new Blockchain();
            expect(blockchain.chain.length).to.equal(1); //check genesis block created
        });

    });

});