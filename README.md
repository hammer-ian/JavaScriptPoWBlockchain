A blockchain project to deepen my understanding of the inner workings of blockchain.

The foundation of this project was code developed on Eric Traub's "Learn Blockchain By Building Your Own In JavaScript" course:
https://www.udemy.com/course/build-a-blockchain-in-javascript/learn/lecture/10368238?start=0#overview

Eric's excellent course produced a lightweight proof of work Javascript blockchain network with the following features:
* Multi node blockchain (hosted on your desktop, listening on different ports)
* Accessible using APIs
* Create new transactions
* Mine blocks using a proof of work algorithm
* Maintain network synchronization by broadcasting transactions (or blocks) to other nodes on the network
* Longest chain consensus
* A Block explorer (client) to query by transaction id, block hash, or account id

Eric's course inspired me to continue developing the Javascript blockchain as a way of a) learning AWS, and b) experimenting with more advanced blockchain features.

---------------------------------------------------------------------------------------
High Level Roadmap
---------------------------------------------------------------------------------------

**V1 – mimics proof work Bitcoin – COMPLETED Sep-2024**
* Productionize the version of the blockchain network inherited from Eric
* Host on AWS with stop / start / scaling fully automated
* This version of the blockchain does not have a concept of 'state'

**V2  - mimic proof of work Ethereum**
* Introduce concept of 'state' via an account model
  * Account to support two types of transactions
    * ‘Cash’ transaction e.g. a credit/debit between accounts
    * ‘NFTs’ – moving a file between accounts
* New features will include:
  * account's which maintain a 'state', and account nonce's to prevent double spend
  * a transaction lifecyle
  * miners, gas fees, configurable block sizes and block rewards
  * state root and merkle trie roots in block header
  * automated testing framework

**V3 - Add a VM and Smart Contracts**
* Build a lightweight virtual machine that has a runtime environment isolated from the blockchain node that it runs on
* Allow ‘smart contracts’ to be deployed and executed on the VM to update the ‘state’

**V4 – offer different consensus options, experiment with cryptography**
* Experiment with adding cryptographic signatures
* Make the consensus algorithm modular, people can choose

---------------------------------------------------------------------------------------
Detailed Activity Log Of Completed Work:
---------------------------------------------------------------------------------------

**V1**

**New Project & AWS infrastructure Features**
* Set up github repo
* Created initial EC2 build e.g. Apache, Node, pm2
* Created a Domain, implemented https and SSL certificates
* Implemented Apache Proxy/Reverse Proxy to make blockchain (hosted on internal Express.js server) accessible from public internet
  * Apache configuration used to ensure non-public facing endpoints can not be reached from public internet (i.e. certain endpoints should only be accessible from a private IP)
* Implemented AWS load balancing (and target groups), including health checks
* Added restrictive AWS Security Groups & IAM roles
* Added swapspace as a workaround for limited t2.micro RAM
* Private subnet and routing tables created for non-public facing EC2 instances
* Environment variables
* Migrated from basic string logging to 3rd party logger Winston and JSON logs
* Deployed Prometheus (metrics), and onboarded logs/metrics to centralized aggregator

**New Blockchain Features**
* Added multi host capability
* Automated the start and stop of a blockchain node. This means the blockchain network automatically scales as new nodes are brought on/offline including the:
  * discovery of the blockchain network and registration of a new node when a new EC2 instance starts
  * consensus check when a node starts so new nodes get the latest copy of the blockchain
  * de-registration of “stopped/unhealthy” nodes from blockchain network 
    * ELB/Target Group healthcheck detects host/node is not responding -> 
    * CloudWatch Alarm fired -> invokes 1st Lambda (outside VPC)
    * Lambda 1 queries ELB to find a healthy node -> passes details to 2nd Lambda inside VPC
      * Note: Lambda created inside VPC do not get assigned a public IP, and therefore cannot call the AWS SDK without a VPC endpoint/NAT gateway - both cost $$
    * Lambda 2 contacts healthy node and makes request to deregister any unhealthy nodes
      * Note: Lambda created outside the VPC cannot communiate with the blockchain node to request the deregistration of unhealthy nodes. As a result workaround was 2 Lambda which exchange data using the Lambda service, bridging the VPC boundary
    * Unhealthy nodes identified and deregistered

**V2**

**Project & AWS Infrastructure**
* JSON schema validation for POST requests
* Migrated application to Docker
* Automated testing framework

**New Blockchain Features**
* Account model to enable “state” to be maintained on blockchain
  * Account validations include address/debit checks and accounts nonces to ensure txns processed in correct sequence
  * Like Ethereum the blockchain does not require the credit account to exist until a txn is processed which credits that address
  * Consensus algorithm updated to re-process all transactions in all blocks when it finds a longer chain, ensuring local account state consistent with global account state on other nodes
* Transaction lifecyle
  * txn created -> txn validated -> txn added to pending pool -> txn selected for block by miner -> txn re-validated -> txn state processed -> txn added to block -> txn removed from pending pool -> block broadcast to the network -> receiving block processes txn state
* Merkle trie and state root added to each block's header enabling the receiving nodes (after a new block is broadcast) to quickly validate the integrity of the block
* Miner algorithm to select transactions for new blocks
  * Algorithm prioritizes transactions based on their gas, whilst still ensuring txns for the same account are processed in the correct order (using account nonce)
