import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';
import Blockchain from '../blockchain/blockchain.js';
import app from '../networkNode.js';

let blockchain;

describe('Blockchain Endpoints', function () {

    beforeEach(function () {
        blockchain = new Blockchain();
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
    /*
        Test each of the endpoints
    */

    describe('GET /blockchain', function () {
        it('should return JSON representing the blockchain instance', function (done) {
            request(app)
                .get('/blockchain')
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('chain');
                    expect(res.body).to.have.property('pendingTransactions');
                    expect(res.body).to.have.property('accounts');
                    expect(res.body).to.have.property('networkNodes');
                    done();
                });
        });
    });

    describe('GET /healthcheck', function () {
        it('should return a 200 OK response', function (done) {
            request(app)
                .get('/healthcheck')
                .expect(200)
                .expect('OK', done);
        });
    });

    describe('POST /transaction/broadcast', function () {
        let blockchainStub;
        //const blockchain = new Blockchain();
        beforeEach(() => {
            blockchainStub = sinon.stub(blockchain, 'createNewTransaction').returns({
                txnID: 'testTxnID',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: 'xyz789',
                amount: 100,
                gas: 10,
                nonce: 0
            });
        });

        afterEach(() => {
            blockchainStub.restore();
        });

        it('should broadcast a transaction to the network', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                    creditAddress: 'xyz789',
                    amount: 100,
                    gas: 10
                })
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body.note).to.equal('new transaction created and broadcast successfully');
                    done();
                });
        });

        it('should return an error if debitAddress is missing', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    creditAddress: 'receiver123',
                    amount: 100,
                    gas: 10
                })
                .expect(400) // Assuming 400 is returned for validation errors
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).to.have.property('error').that.includes("\"debitAddress\" is required");
                    done();
                });
        });

        it('should return an error if debit address does not exist', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: 'sender123',
                    creditAddress: 'receiver123',
                    amount: 100,
                    gas: 10
                })
                .expect(400)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).to.have.property('error').that.includes('Account with address sender123 does not exist');
                    done();
                });
        });

        it('should return an error if debit address does not have sufficient funds', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                    creditAddress: 'receiver123',
                    amount: 1001,
                    gas: 10
                })
                .expect(400)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body.result.Error).to.include('debitCheck failed');
                    done();
                });
        });

        it('should return an error if creditAddress is missing', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: 'sender123',
                    amount: 100,
                    gas: 10
                })
                .expect(400)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).to.have.property('error').that.includes("\"creditAddress\" is required");
                    done();
                });
        });

        it('should return an error if amount negative', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: 'sender123',
                    creditAddress: 'receiver123',
                    amount: -100, // Invalid negative amount
                    gas: 10
                })
                .expect(400)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).to.have.property('error').that.includes("\"amount\" must be a positive number");
                    done();
                });
        });

        it('should return an error if gas is missing', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: 'sender123',
                    creditAddress: 'receiver123',
                    amount: 100
                    // Missing gas
                })
                .expect(400)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).to.have.property('error').that.includes("\"gas\" is required");
                    done();
                });
        });

    });


});