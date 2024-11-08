import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';

// Import the default export of networkNode.js as an object
import networkNode from '../../networkNode.js';
// Extract app and blockchain from the imported object
const { app, blockchain } = networkNode;

/**
 * Test cases validating the transaction endpoints gracefully handle the HTTP request/response cycle
 */
describe('Network Node Endpoints HTTP Request/Response Cycle', function () {

    before(function () {
        // Add mock network nodes to the blockchain to simlulate other nodes existing on the network
        blockchain.networkNodes.push('http://node1.com:3001');
        blockchain.networkNodes.push('http://node2.com:3001');

        // Mock the consensus checks that happen when a node starts to simulate node responses
        // We will explicitly test /consensus endpoint elsewhere
        blockchain.networkNodes.forEach((networkNodeUrl) => {
            nock(networkNodeUrl)
                .get('/consensus')
                .reply(200, { chain: [], pendingTransactions: [] });  // Simulate an empty blockchain for each node
        });
    });

    /*
        Test each of the endpoints
         - GET /blockchain
         - GET /healthcheck
         - POST /transaction/broadcast
         - POST /internal/receive-new-transaction
         - GET /mine
    */

    describe('GET /blockchain', function () {
        it('app should return JSON representing the blockchain instance', function (done) {
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
        it('app should return a 200 OK response', function (done) {
            request(app)
                .get('/healthcheck')
                .expect(200)
                .expect('OK', done);
        });
    });

    describe('POST /transaction/broadcast', function () {
        let createTxnStub;
        let nockScopes = []; // Array to hold all nock scopes

        //create random addresses for test transactions, to avoid clashing with other unit tests
        const debitAddress = uuidv4().split('-').join('');
        const creditAddress = uuidv4().split('-').join('');

        beforeEach(() => {
            createTxnStub = sinon.stub(blockchain, 'createNewTransaction').returns({
                txnID: 'testTxnID',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: 0
            });

            blockchain.networkNodes.forEach((networkNodeUrl) => {
                // Mock the POST request to /internal/receive-new-transaction
                const scope = nock(networkNodeUrl)
                    .post('/internal/receive-new-transaction')
                    .reply(200, { note: 'transaction added to pending pool' });

                // Store the scope for later verification
                nockScopes.push(scope);
            });
        });

        afterEach(() => {
            createTxnStub.restore();
            nock.cleanAll();  // Clear all nocks after each test
            nockScopes = []; // Clear nock scopes
        });

        it('app should broadcast a transaction to the network', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                    creditAddress: creditAddress,
                    amount: 100,
                    gas: 10
                })
                .expect(200)
                .end(function (err, res) {
                    if (err) {
                        return done(err);
                    }
                    expect(res.body.note, 'Failed to verify successfuly broadcast response').to.equal('new transaction created and broadcast successfully');

                    // Verify that nock intercepted the requests to `/internal/receive-new-transaction`
                    // Verify that each nock scope has been called exactly once
                    nockScopes.forEach((scope, index) => {
                        expect(scope.isDone(), `Network request to node ${index + 1} was not intercepted as expected`).to.be.true;
                    });

                    done();
                });
        });

        it('app should return an error if debitAddress is missing', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    creditAddress: creditAddress,
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

        it('app should return an error if debitAddress does not exist', function (done) {

            createTxnStub.restore();
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: debitAddress,
                    creditAddress: creditAddress,
                    amount: 100,
                    gas: 10
                })
                .expect(400)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).to.have.property('error').that.includes(`Account with address ${debitAddress} does not exist`);
                    done();
                });
        });

        it('app should return an error if debitAddress does not have sufficient funds', function (done) {

            /* Override the default stub for this specific test. restore() effectively removes 
             the createNewTransaction stub set in beforeEach() so the stubbed method returns to it's 
             original behaviour
             */
            createTxnStub.restore();

            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                    creditAddress: creditAddress,
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

        it('app should return an error if creditAddress is missing', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: debitAddress, //creditAddress is missing
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

        it('app should return an error if amount negative', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: debitAddress,
                    creditAddress: creditAddress,
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

        it('app should return an error if gas is missing', function (done) {
            request(app)
                .post('/transaction/broadcast')
                .send({
                    debitAddress: debitAddress,
                    creditAddress: creditAddress,
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

    describe('POST /internal/receive-new-transaction', function () {
        let validateTxnStub;


        beforeEach(() => {
            validateTxnStub = sinon.stub(blockchain, 'validateTransaction').returns({
                txnID: 'testTxnID',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: 0
            });

        });

        afterEach(() => {
            validateTxnStub.restore();

        });

        it('app should return a 200 OK response', function (done) {
            request(app)
                .get('/healthcheck')
                .expect(200)
                .expect('OK', done);
        });
    });

});