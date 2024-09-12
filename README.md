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
  * gas fees
  * account nonces (to prevent double spending)
  * block "state root" header (merkle tree roots) to ensure each node can maintain a local copy of the *global* state
* Build a lightweight virtual machine that has a runtime environment isolated from the blockchain node that it runs on
* Allow ‘smart contracts’ to be deployed and executed on the VM to update the ‘state’

**V3 – offer different consensus options, experiment with cryptography**
* Experiment with adding cryptographic signatures
* Make the consensus algorithm modular, people can choose

---------------------------------------------------------------------------------------
Detailed Activity Log Of Completed Work:
---------------------------------------------------------------------------------------

**V1**

**Project & AWS infrastructure**
* Set up github repo
* Created initial EC2 build e.g. Apache, Node
* Implemented Apache Proxy to make blockchain (hosted on internal Express.js server) accessible from public internet
  * Apache configuration used to ensure non-public facing endpoints can not be reached from public internet (i.e. certain endpoints should only be accessible from a private IP)
* Created a Domain, implemented https and SSL certificates
* Implemented load balancing (and target groups), including health checks
* Added restrictive AWS Security Groups & IAM roles
* Added swapspace as a workaround for limited t2.micro RAM
* Private subnet and routing tables created for non-public facing EC2 instances
* Finalized AMI Image of master blockchain node
* Migrated from basic string based logging to 3rd party logger Winston
* Deployed Prometheus to collect metrics, and onboarded logs/metrics to centralized aggregator

**Additional Blockchain Features**
* Added multi host capability (initial version only supported multiples nodes on a single host)
* Fully automated the start and stop of a blockchain node. This means the blockchain network automatically scales as new EC2 instances/nodes are brought on/offline
  * Automated the start and registration of a new node with the blockchain network when a new EC2 instance starts
  * Automated the consensus check when a node starts so new nodes get the latest copy of the blockchain
  * Automated de-registration of “stopped/unhealthy” nodes from blockchain network 
    * ELB/Target Group healthcheck detects host/node is not responding -> 
    * CloudWatch Alarm fired -> invokes 1st Lambda (outside VPC)
    * Lambda 1 queries ELB to find a healthy node -> passes details to 2nd Lambda inside VPC
      * Note: Lambda created inside VPC do not get assigned a public IP, and therefore cannot call the AWS SDK without a VPC endpoint/NAT gateway - both cost $$
    * Lambda 2 contacts healthy node and makes request to deregister any unhealthy nodes
      * Note: Lambda created outside the VPC cannot communiate with the blockchain node to request the deregistration of unhealthy nodes. As a result workaround was 2 Lambda which pass data using the Lambda service
    * Unhealthy nodes identified and deregistered

**V2**

**Project & AWS Infrastructure**
TBC

**Blockchain Features**
* Implemented JSON schema validation for POST requests
* Implemented Account model to enabled “state” to be maintained on blockchain
* Account debit checks: Account address and debit validations
* Automate the creation of a node account at start up (for mining rewards)
